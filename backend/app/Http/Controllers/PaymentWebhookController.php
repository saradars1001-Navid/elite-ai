<?php

namespace App\Http\Controllers;

use App\Models\Coupon;
use App\Models\Purchase;
use App\Models\WalletTransaction;
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
            return $this->applyRefund($entity, $isWallet, $eventId);
        }

        // 'payment' notification — failed payments are recorded as-is, paid
        // payments must survive a server-to-server verification first.
        if ($notification['status'] !== 'paid') {
            return $this->markFailed($entity, $isWallet, $eventId);
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

    /* ──────────────────────────── state changes ──────────────────────────── */

    private function applyPaid(WalletTransaction|Purchase $entity, bool $isWallet, ?string $ref, int $eventId, array $verify): JsonResponse
    {
        if ($isWallet) {
            /** @var WalletTransaction $entity */
            if ($entity->status === 'completed') {
                PaymentEventLogger::finish($eventId, 'idempotent', $verify);

                return response()->json(['ok' => true, 'idempotent' => true]);
            }
            DB::transaction(function () use ($entity, $ref) {
                $user = $entity->user;
                $balance = (int) $user->wallet_balance + (int) $entity->amount;
                $user->update(['wallet_balance' => $balance]);
                $entity->update([
                    'status' => 'completed',
                    'balance_after' => $balance,
                    'gateway_ref' => $ref ?? $entity->gateway_ref,
                ]);
            });
            app(NotificationService::class)->send(
                $entity->user,
                'payment',
                'کیف پول شما شارژ شد',
                number_format((int) $entity->amount).' تومان به کیف پول شما اضافه شد.',
                ['link' => '/profile']
            );
            PaymentEventLogger::finish($eventId, 'processed', $verify);

            return response()->json(['ok' => true, 'wallet' => true]);
        }

        /** @var Purchase $entity */
        if ($entity->status === 'paid') {
            PaymentEventLogger::finish($eventId, 'idempotent', $verify);

            return response()->json(['ok' => true, 'idempotent' => true]);
        }
        DB::transaction(function () use ($entity, $ref) {
            $entity->update([
                'status' => 'paid',
                'receipt_id' => $entity->receipt_id ?: 'REC-'.strtoupper(Str::random(10)),
                'gateway_ref' => $ref ?? $entity->gateway_ref,
                'refunded_at' => null,
            ]);
            $coupon = $entity->coupon_code ? Coupon::where('code', $entity->coupon_code)->first() : null;
            if ($coupon) {
                $coupon->increment('used_count');
            }
        });
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
            if ($entity->status !== 'completed') {
                PaymentEventLogger::finish($eventId, 'idempotent');

                return response()->json(['ok' => true, 'idempotent' => true]);
            }
            DB::transaction(function () use ($entity) {
                $user = $entity->user;
                $balance = max(0, (int) $user->wallet_balance - (int) $entity->amount);
                $user->update(['wallet_balance' => $balance]);
                $entity->update(['status' => 'failed', 'balance_after' => $balance, 'description' => 'شارژ کیف پول (بازگشت وجه از درگاه)']);
            });
            app(NotificationService::class)->send(
                $entity->user,
                'payment',
                'بازگشت وجه کیف پول',
                'مبلغ '.number_format((int) $entity->amount).' تومان از کیف پول شما کسر شد (بازگشت وجه از درگاه).',
                ['link' => '/profile']
            );
            PaymentEventLogger::finish($eventId, 'processed');

            return response()->json(['ok' => true, 'wallet_refunded' => true]);
        }

        /** @var Purchase $entity */
        if ($entity->status === 'refunded') {
            PaymentEventLogger::finish($eventId, 'idempotent');

            return response()->json(['ok' => true, 'idempotent' => true]);
        }
        $entity->update(['status' => 'refunded', 'refunded_at' => now()]);
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
            if ($entity->status === 'completed') {
                PaymentEventLogger::finish($eventId, 'idempotent');

                return response()->json(['ok' => true, 'idempotent' => true]);
            }
            $entity->update(['status' => 'failed']);
            PaymentEventLogger::finish($eventId, 'processed');

            return response()->json(['ok' => true, 'wallet_failed' => true]);
        }

        /** @var Purchase $entity */
        if ($entity->status === 'paid' || $entity->status === 'refunded') {
            PaymentEventLogger::finish($eventId, 'idempotent');

            return response()->json(['ok' => true, 'idempotent' => true]);
        }
        $entity->update(['status' => 'failed']);
        PaymentEventLogger::finish($eventId, 'processed');

        return response()->json(['ok' => true, 'purchase_failed' => true]);
    }
}
