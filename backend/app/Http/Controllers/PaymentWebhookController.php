<?php

namespace App\Http\Controllers;

use App\Models\Coupon;
use App\Models\Purchase;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Services\GatewayBinding;
use App\Services\NotificationService;
use App\Services\PaymentEventLogger;
use App\Services\PaymentGateway;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Server-to-server webhook: the payment gateway notifies this endpoint about a
 * successful payment or a refund. The payload is never trusted as-is — the
 * transaction is re-verified against the gateway's verify API (server-side)
 * before any state change. Handles both chapter purchases and wallet charges,
 * idempotently. Every incoming event (including rejected ones) is recorded in
 * the payment_events audit log for review in the admin panel.
 *
 * Trust levels:
 *  - Authenticated delivery (a shared secret or HMAC is configured and matched):
 *    may mark an order failed, and may apply a refund notification.
 *  - Unauthenticated delivery (no secret configured): may only activate an
 *    order, and only after the gateway confirms it. Anyone can POST to this
 *    URL, so failure/refund notifications from it are ignored.
 */
class PaymentWebhookController extends Controller
{
    public function __construct(private PaymentGateway $gateway) {}

    public function handle(Request $request): JsonResponse
    {
        // Record every incoming attempt first, so even rejected/forged calls
        // are reviewable in the admin log.
        $eventId = PaymentEventLogger::start('webhook', 'payment', null, null, $request->input() ?: $request->query());
        $fail = function (string $error, int $status) use ($eventId): JsonResponse {
            PaymentEventLogger::finish($eventId, 'failed', null, $error);

            return response()->json(['error' => $error], $status);
        };

        // Layer 1 — optional plain shared secret for gateways that can send a
        // custom header (X-Webhook-Secret).
        $secret = (string) config('payment.webhook_secret', '');
        if ($secret !== '' && ! hash_equals($secret, (string) $request->header('X-Webhook-Secret', ''))) {
            return $fail('unauthorized', 401);
        }

        // Layer 2 — HMAC signature over the raw body (Zibal-style gateways).
        // Each gateway declares how (and whether) it signs; an unsigned gateway
        // returns true and stays protected by the re-verification below.
        if (! $this->gateway->verifyWebhookSignature($request)) {
            return $fail('invalid_signature', 401);
        }
        $authenticated = $this->deliveryIsAuthenticated();

        $notification = $this->gateway->parseWebhook($request);
        if (empty($notification['supported'])) {
            // The active gateway has no webhook — nothing to do here.
            PaymentEventLogger::finish($eventId, 'ignored');

            return response()->json(['ok' => true, 'ignored' => true]);
        }

        $referenceId = (string) $notification['referenceId'];
        $isWallet = str_starts_with($referenceId, 'wallet-');
        $entity = $isWallet
            ? WalletTransaction::find((int) substr($referenceId, 7))
            : Purchase::find((int) $referenceId);
        if (! $entity) {
            return $fail('reference_not_found', 404);
        }

        // Attach the resolved reference to the log row for review.
        PaymentEventLogger::reference($eventId, $isWallet ? 'wallet' : 'purchase', $referenceId);
        PaymentEventLogger::type($eventId, $notification['type']);

        if ($notification['type'] === 'refund') {
            // Refund notifications change money state, so they must be authenticated.
            // No active gateway emits them today; this keeps it safe if one does.
            if (! $authenticated) {
                PaymentEventLogger::finish($eventId, 'ignored', null, 'unauthenticated_refund');

                return response()->json(['ok' => true, 'ignored' => true]);
            }

            return $this->applyRefund($entity, $isWallet, $eventId);
        }

        // 'payment' notification — failed payments are recorded as-is, paid
        // payments must survive a server-to-server verification first.
        if ($notification['status'] !== 'paid') {
            if (! $authenticated) {
                // Anyone can send an unsigned "failed" notification for a guessed
                // id; ignore it rather than changing the order.
                PaymentEventLogger::finish($eventId, 'ignored', null, 'unauthenticated_failure');

                return response()->json(['ok' => true, 'ignored' => true]);
            }

            return $this->markFailed($entity, $isWallet, $eventId);
        }

        // The payment id must be the one this order was opened with (see GatewayBinding).
        // A replayed delivery for an order that is already settled is a no-op.
        if ($this->alreadySettled($entity, $isWallet)) {
            PaymentEventLogger::finish($eventId, 'idempotent');

            return response()->json(['ok' => true, 'idempotent' => true]);
        }

        // The payment id must be the one this order was opened with (see GatewayBinding).
        if (! GatewayBinding::matches($entity->expectedAuthority(), (string) $notification['authority'])) {
            return $fail('authority_mismatch', 422);
        }

        $amount = $isWallet ? (int) $entity->amount : (int) $entity->price;
        try {
            $verify = $this->gateway->verify((string) $notification['authority'], $amount, $referenceId);
        } catch (\Throwable $e) {
            report($e);

            return $fail('verify_unavailable', 502);
        }
        PaymentEventLogger::verify($eventId, $verify);
        if (empty($verify['ok'])) {
            return $fail('verification_failed', 422);
        }

        return $this->applyPaid($entity, $isWallet, $verify['ref'] ?? $notification['ref'], $eventId, $verify);
    }

    private function alreadySettled(WalletTransaction|Purchase $entity, bool $isWallet): bool
    {
        return $isWallet
            ? $entity->status === 'completed'
            : $entity->status === 'paid';
    }

    /** True when the delivery carries a secret or HMAC signature that was checked. */
    private function deliveryIsAuthenticated(): bool
    {
        return (string) config('payment.webhook_secret', '') !== ''
            || (string) config('payment.hmac.secret', '') !== ''
            || (string) config('services.idpay.webhook_secret', '') !== '';
    }

    /* ──────────────────────────── state changes ──────────────────────────── */

    private function applyPaid(WalletTransaction|Purchase $entity, bool $isWallet, ?string $ref, int $eventId, array $verify): JsonResponse
    {
        if ($isWallet) {
            /** @var WalletTransaction $entity */
            $credited = DB::transaction(function () use ($entity, $ref) {
                // Lock the charge and the user so a concurrent callback/webhook
                // cannot credit the same charge twice or lose a balance update.
                $tx = WalletTransaction::whereKey($entity->getKey())->lockForUpdate()->firstOrFail();
                if ($tx->status === 'completed') {
                    return null;
                }
                $user = User::whereKey($tx->user_id)->lockForUpdate()->firstOrFail();
                $balance = (int) $user->wallet_balance + (int) $tx->amount;
                $user->update(['wallet_balance' => $balance]);
                $tx->update([
                    'status' => 'completed',
                    'balance_after' => $balance,
                    'gateway_authority' => $tx->expectedAuthority(),
                    'gateway_ref' => $ref ?? $tx->gateway_ref,
                ]);

                return $user;
            });
            if ($credited === null) {
                PaymentEventLogger::finish($eventId, 'idempotent', $verify);

                return response()->json(['ok' => true, 'idempotent' => true]);
            }
            app(NotificationService::class)->send(
                $credited,
                'payment',
                'کیف پول شما شارژ شد',
                number_format((int) $entity->amount).' تومان به کیف پول شما اضافه شد.',
                ['link' => '/profile']
            );
            PaymentEventLogger::finish($eventId, 'processed', $verify);

            return response()->json(['ok' => true, 'wallet' => true]);
        }

        /** @var Purchase $entity */
        $granted = DB::transaction(function () use ($entity, $ref) {
            $locked = Purchase::whereKey($entity->getKey())->lockForUpdate()->firstOrFail();
            if ($locked->status === 'paid') {
                return false;
            }
            $locked->update([
                'status' => 'paid',
                'receipt_id' => $locked->receipt_id ?: 'REC-'.strtoupper(Str::random(10)),
                'gateway_authority' => $locked->expectedAuthority(),
                'gateway_ref' => $ref ?? $locked->gateway_ref,
                'refunded_at' => null,
            ]);
            $coupon = $locked->coupon_code ? Coupon::where('code', $locked->coupon_code)->first() : null;
            if ($coupon) {
                $coupon->increment('used_count');
            }

            return true;
        });
        if (! $granted) {
            PaymentEventLogger::finish($eventId, 'idempotent', $verify);

            return response()->json(['ok' => true, 'idempotent' => true]);
        }
        $chapterTitle = $entity->chapter?->title ?? 'فصل آموزشی';
        app(NotificationService::class)->send(
            $entity->user,
            'payment',
            'پرداخت موفق',
            'دسترسی شما به فصل «'.$chapterTitle.'» فعال شد. یادگیری را ادامه دهید.',
            ['link' => '/chapter/'.$entity->chapter_id]
        );
        PaymentEventLogger::finish($eventId, 'processed', $verify);

        return response()->json(['ok' => true, 'purchase' => true]);
    }

    private function applyRefund(WalletTransaction|Purchase $entity, bool $isWallet, int $eventId): JsonResponse
    {
        if ($isWallet) {
            /** @var WalletTransaction $entity */
            $debited = DB::transaction(function () use ($entity) {
                $tx = WalletTransaction::whereKey($entity->getKey())->lockForUpdate()->firstOrFail();
                if ($tx->status !== 'completed') {
                    return null;
                }
                $user = User::whereKey($tx->user_id)->lockForUpdate()->firstOrFail();
                $balance = max(0, (int) $user->wallet_balance - (int) $tx->amount);
                $user->update(['wallet_balance' => $balance]);
                $tx->update(['status' => 'failed', 'balance_after' => $balance, 'description' => 'شارژ کیف پول (بازگشت وجه از درگاه)']);

                return $user;
            });
            if ($debited === null) {
                PaymentEventLogger::finish($eventId, 'idempotent');

                return response()->json(['ok' => true, 'idempotent' => true]);
            }
            app(NotificationService::class)->send(
                $debited,
                'payment',
                'بازگشت وجه کیف پول',
                'مبلغ '.number_format((int) $entity->amount).' تومان از کیف پول شما کسر شد (بازگشت وجه از درگاه).',
                ['link' => '/profile']
            );
            PaymentEventLogger::finish($eventId, 'processed');

            return response()->json(['ok' => true, 'wallet_refunded' => true]);
        }

        /** @var Purchase $entity */
        $refunded = DB::transaction(function () use ($entity) {
            $locked = Purchase::whereKey($entity->getKey())->lockForUpdate()->firstOrFail();
            if ($locked->status === 'refunded') {
                return false;
            }
            $locked->update(['status' => 'refunded', 'refunded_at' => now()]);

            return true;
        });
        if (! $refunded) {
            PaymentEventLogger::finish($eventId, 'idempotent');

            return response()->json(['ok' => true, 'idempotent' => true]);
        }
        $chapterTitle = $entity->chapter?->title ?? 'فصل آموزشی';
        app(NotificationService::class)->send(
            $entity->user,
            'payment',
            'بازگشت وجه',
            'مبلغ خرید فصل «'.$chapterTitle.'» به شما بازگردانده شد.',
            ['link' => '/profile']
        );
        PaymentEventLogger::finish($eventId, 'processed');

        return response()->json(['ok' => true, 'purchase_refunded' => true]);
    }

    private function markFailed(WalletTransaction|Purchase $entity, bool $isWallet, int $eventId): JsonResponse
    {
        if ($isWallet) {
            /** @var WalletTransaction $entity */
            WalletTransaction::whereKey($entity->getKey())->where('status', 'pending')->update(['status' => 'failed']);
            PaymentEventLogger::finish($eventId, 'processed');

            return response()->json(['ok' => true, 'wallet_failed' => true]);
        }

        /** @var Purchase $entity */
        // Only a pending order can fail; a paid or refunded one is never downgraded.
        $changed = DB::transaction(function () use ($entity) {
            $locked = Purchase::whereKey($entity->getKey())->lockForUpdate()->first();
            if (! $locked || $locked->status !== 'pending') {
                return false;
            }
            // The unique [user, chapter, status] index allows one failed row per chapter.
            Purchase::where('user_id', $locked->user_id)
                ->where('chapter_id', $locked->chapter_id)
                ->where('status', 'failed')
                ->whereKeyNot($locked->getKey())
                ->delete();
            $locked->update(['status' => 'failed']);

            return true;
        });
        PaymentEventLogger::finish($eventId, $changed ? 'processed' : 'idempotent');

        return response()->json(['ok' => true, 'purchase_failed' => $changed]);
    }
}
