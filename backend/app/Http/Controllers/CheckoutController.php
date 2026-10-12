<?php

namespace App\Http\Controllers;

use App\Models\Chapter;
use App\Models\Coupon;
use App\Models\Purchase;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Services\GatewayBinding;
use App\Services\NotificationService;
use App\Services\PaymentEventLogger;
use App\Services\PaymentGateway;
use App\Services\PurchaseRefunder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CheckoutController extends Controller
{
    public function __construct(private PaymentGateway $gateway) {}

    /** Create a pending order and return the payment-gateway redirect URL. Price is computed server-side only. */
    public function create(Request $request): JsonResponse
    {
        $data = $request->validate([
            'chapterId' => ['required', 'string', 'exists:chapters,id'],
            'couponCode' => ['nullable', 'string', 'max:40'],
            'paymentMethod' => ['nullable', 'in:gateway,wallet'],
        ]);
        $chapter = Chapter::findOrFail($data['chapterId']);
        if ($chapter->free) {
            return response()->json(['message' => 'این فصل رایگان است.'], 422);
        }
        if ($this->hasPaidAccess($request->user()->id, $chapter->id)) {
            return response()->json(['message' => 'شما قبلاً این فصل را خریده‌اید.'], 409);
        }

        $userId = $request->user()->id;
        $pricing = $this->price($userId, $chapter, $data['couponCode'] ?? null);
        $isFree = $pricing['finalPrice'] <= 0;
        $useWallet = ($data['paymentMethod'] ?? 'gateway') === 'wallet';

        // Free (fully discounted) and wallet orders settle immediately, so the whole
        // decision and the write happen under a row lock on the buyer: two concurrent
        // requests cannot both pass the balance check, both grant access, or both
        // take the last coupon use.
        if ($isFree || $useWallet) {
            $code = $data['couponCode'] ?? null;
            $outcome = DB::transaction(function () use ($userId, $chapter, $pricing, $code, $isFree) {
                $user = User::whereKey($userId)->lockForUpdate()->firstOrFail();

                if ($this->hasPaidAccess($userId, $chapter->id)) {
                    return ['error' => 'owned'];
                }
                if (! $isFree && (int) $user->wallet_balance < $pricing['finalPrice']) {
                    return ['error' => 'insufficient'];
                }
                if (! $this->claimCoupon($pricing, $code)) {
                    return ['error' => 'coupon'];
                }

                if ($isFree) {
                    $purchase = $this->newPurchase($userId, $chapter, $pricing, 'FREE', $code);
                    $purchase->update(['status' => 'paid', 'receipt_id' => 'FREE-'.strtoupper(Str::random(8)), 'refunded_at' => null]);

                    return ['purchase' => $purchase];
                }

                $newBalance = (int) $user->wallet_balance - $pricing['finalPrice'];
                $user->update(['wallet_balance' => $newBalance]);
                $purchase = $this->newPurchase($userId, $chapter, $pricing, 'WALLET', $code);
                $purchase->update(['status' => 'paid', 'receipt_id' => 'WLT-'.strtoupper(Str::random(8)), 'refunded_at' => null]);
                WalletTransaction::create([
                    'user_id' => $userId,
                    'type' => 'purchase',
                    'amount' => $pricing['finalPrice'],
                    'balance_after' => $newBalance,
                    'status' => 'completed',
                    'purchase_id' => $purchase->id,
                    'description' => 'خرید فصل '.$chapter->title,
                ]);

                return ['purchase' => $purchase];
            });

            if (isset($outcome['error'])) {
                return match ($outcome['error']) {
                    'owned' => response()->json(['message' => 'شما قبلاً این فصل را خریده‌اید.'], 409),
                    'insufficient' => response()->json(['message' => 'موجودی کیف پول کافی نیست. لطفاً ابتدا کیف پول را شارژ کنید.'], 422),
                    default => response()->json(['message' => 'کد تخفیف دیگر معتبر نیست.'], 422),
                };
            }

            /** @var Purchase $purchase */
            $purchase = $outcome['purchase'];

            return $isFree
                ? response()->json(['purchaseId' => $purchase->id, 'amount' => 0, 'checkoutUrl' => null])
                : response()->json(['purchaseId' => $purchase->id, 'amount' => 0, 'checkoutUrl' => null, 'walletPaid' => true]);
        }

        // A chapter holds at most one order per (user, status) — the schema has a
        // unique index on [user_id, chapter_id, status] — so a retry after a
        // failed attempt must reuse that order instead of inserting a second one
        // (which would collide the moment the gateway fails again).
        $existing = Purchase::where('user_id', $request->user()->id)
            ->where('chapter_id', $chapter->id)
            ->whereIn('status', ['pending', 'failed'])
            ->orderByRaw("CASE WHEN status = 'pending' THEN 0 ELSE 1 END")
            ->latest('id')
            ->first();
        if ($existing) {
            $existing->update([
                'checkout_id' => (string) Str::uuid(),
                'price' => $pricing['finalPrice'],
                'base_price' => $pricing['basePrice'],
                'discount_label' => $pricing['discountLabel'] ?: null,
                'coupon_code' => $pricing['couponPercent'] > 0 ? strtoupper(trim((string) ($data['couponCode'] ?? ''))) : null,
                'status' => 'pending',
            ]);
        } else {
            $existing = $this->newPurchase($request->user()->id, $chapter, $pricing, (string) Str::uuid(), $data['couponCode'] ?? null);
        }
        // The gateway must redirect back to OUR backend (not the SPA) so the
        // payment can be verified server-side before the browser is redirected
        // to the frontend status page.
        $callbackUrl = rtrim((string) config('app.url'), '/').'/api/v1/payment/callback?purchase='.$existing->id;
        try {
            $result = $this->gateway->initiate($pricing['finalPrice'], 'خرید فصل '.$chapter->title.' — آکادمی ایلیت', $callbackUrl, (string) $existing->id);
            $existing->update(['gateway_ref' => $result['ref'], 'gateway_authority' => $result['ref']]);

            return response()->json(['purchaseId' => $existing->id, 'amount' => $pricing['finalPrice'], 'checkoutUrl' => $result['url']]);
        } catch (\Throwable $e) {
            $this->markFailed($existing);
            report($e);

            return response()->json(['message' => 'درگاه پرداخت در دسترس نیست. کمی بعد دوباره تلاش کنید.'], 502);
        }
    }

    /** The gateway redirects here after payment; verify server-side and grant access. */
    public function callback(Request $request): RedirectResponse
    {
        $purchase = Purchase::find((int) $request->query('purchase'));
        $eventId = PaymentEventLogger::start('callback', 'payment', $purchase ? 'purchase' : null, $purchase ? (string) $purchase->id : null, $request->query());
        if (! $purchase) {
            PaymentEventLogger::finish($eventId, 'failed', null, 'purchase_not_found');

            return redirect()->to(rtrim((string) config('app.frontend_url'), '/').'/payment?status=failed');
        }
        // Only the backend is allowed to call verify; the gateway never sends a
        // Bearer token, so this route must stay outside the auth middleware.

        if ($purchase->status === 'paid') {
            PaymentEventLogger::finish($eventId, 'idempotent');

            return $this->redirectResult($purchase, 'success');
        }

        // Gateway-agnostic: each provider parses its own redirect query params
        // (Zarinpal Status/Authority, IDPay status/track_id) via verifyFromCallback.
        $status = 'failed';
        $proof = $this->gateway->verifyFromCallback($request);
        if (! $proof['ok']) {
            // The buyer cancelled or the gateway reported a failure.
            $this->markFailed($purchase);
            PaymentEventLogger::finish($eventId, 'failed');

            return $this->redirectResult($purchase, 'failed');
        }
        // The authority in the redirect must be the one this order was opened
        // with. Otherwise a paid authority from another order could be replayed.
        // A mismatched redirect leaves the order untouched.
        if (! GatewayBinding::matches($purchase->expectedAuthority(), $proof['authority'])) {
            PaymentEventLogger::finish($eventId, 'failed', null, 'authority_mismatch');

            return $this->redirectResult($purchase, 'failed');
        }
        try {
            $verify = $this->gateway->verify($proof['authority'], (int) $purchase->price, (string) $purchase->id);
            PaymentEventLogger::verify($eventId, $verify);
            if ($verify['ok']) {
                $granted = DB::transaction(function () use ($purchase, $verify, $proof) {
                    // Lock the order so a concurrent duplicate callback cannot
                    // grant twice (or flip an already-paid order back).
                    $locked = Purchase::whereKey($purchase->id)->lockForUpdate()->firstOrFail();
                    if ($locked->status === 'paid') {
                        return false;
                    }
                    $locked->update([
                        'status' => 'paid',
                        'receipt_id' => 'REC-'.strtoupper(Str::random(10)),
                        'gateway_authority' => $locked->expectedAuthority(),
                        'gateway_ref' => $verify['ref'] ?? $proof['ref'] ?? $locked->gateway_ref,
                        'refunded_at' => null,
                    ]);
                    $coupon = $locked->coupon_code ? Coupon::where('code', $locked->coupon_code)->first() : null;
                    if ($coupon) {
                        $coupon->increment('used_count');
                    }

                    return true;
                });
                $status = 'success';
                if (! $granted) {
                    // Another request already granted access; nothing more to do.
                    PaymentEventLogger::finish($eventId, 'idempotent');

                    return $this->redirectResult($purchase, 'success');
                }
            }
        } catch (\Throwable $e) {
            report($e);
        }
        if ($status !== 'success') {
            $this->markFailed($purchase);
        } else {
            $chapterTitle = $purchase->chapter?->title ?? 'فصل آموزشی';
            app(NotificationService::class)->send(
                $purchase->user,
                'payment',
                'پرداخت موفق',
                'دسترسی شما به فصل «'.$chapterTitle.'» فعال شد. یادگیری را ادامه دهید.',
                ['link' => '/chapter/'.$purchase->chapter_id]
            );
        }
        PaymentEventLogger::finish($eventId, $status === 'success' ? 'processed' : 'failed');

        return $this->redirectResult($purchase, $status);
    }

    /** Poll the order state from the frontend after redirect. */
    public function status(Request $request, Purchase $purchase): JsonResponse
    {
        abort_unless($purchase->user_id === $request->user()->id, 403);

        return response()->json(['purchase' => [
            'id' => $purchase->id,
            'chapterId' => $purchase->chapter_id,
            'status' => $purchase->status,
            'price' => $purchase->price,
            'basePrice' => $purchase->base_price,
            'discountLabel' => $purchase->discount_label,
            'receiptId' => $purchase->receipt_id,
            'refundStatus' => $purchase->refunded_at
                ? 'refunded'
                : ($purchase->refund_rejected_at
                    ? 'rejected'
                    : ($purchase->isRefundPending() ? 'pending' : 'none')),
            'refundReason' => $purchase->refund_reason,
            'refundRequestedAt' => $purchase->refund_requested_at?->toIso8601String(),
            'refundedAt' => $purchase->refunded_at?->toIso8601String(),
            'refundRejectedAt' => $purchase->refund_rejected_at?->toIso8601String(),
            'createdAt' => $purchase->created_at?->toIso8601String(),
        ]]);
    }

    /** Admin refund: reverse at the gateway and mark the order refunded. */
    public function refund(Request $request, Purchase $purchase): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate([
            'manual' => ['sometimes', 'boolean'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);
        $manual = (bool) ($data['manual'] ?? false);
        if ($manual && trim((string) ($data['note'] ?? '')) === '') {
            return response()->json(['message' => 'برای بازگشت دستی، یادداشت (مرجع بازگشت) الزامی است.'], 422);
        }

        $result = app(PurchaseRefunder::class)->refund($purchase, $manual, $data['note'] ?? null, $request->user()->id);
        if (! $result['ok']) {
            return response()->json(['message' => $result['message']], $result['status']);
        }

        $chapterTitle = $purchase->chapter?->title ?? 'فصل آموزشی';
        app(NotificationService::class)->send(
            $purchase->user,
            'payment',
            'بازگشت وجه',
            'مبلغ خرید فصل «'.$chapterTitle.'» به شما بازگردانده شد.',
            ['link' => '/profile']
        );

        return response()->json(['ok' => true, 'purchase' => $result['purchase']]);
    }

    /* ──────────────────────── pricing (server authority) ──────────────────────── */

    /** Compute the final price from performance discount + coupon; never trusts the client. */
    public function price(string $userId, Chapter $chapter, ?string $couponCode = null): array
    {
        $basePrice = max(0, (int) $chapter->price);
        $performance = 0;
        if ($chapter->index > 1) {
            $previous = Chapter::where('index', $chapter->index - 1)->first();
            if ($previous) {
                // Only the first attempt on the previous chapter can unlock the discount (the
                // one whose awarded_discount was recorded), so retaking the exam cannot raise it.
                $first = DB::table('exam_attempts')->where('user_id', $userId)->where('chapter_id', $previous->id)->orderBy('id')->first();
                if ($first) {
                    $performance = (int) ($first->awarded_discount ?? 0);
                }
            }
        }
        $coupon = null;
        $couponPercent = 0;
        if ($couponCode) {
            $coupon = Coupon::where('code', strtoupper(trim($couponCode)))->first();
            if ($coupon && $coupon->isValid()) {
                $couponPercent = (int) $coupon->percent;
            }
        }
        $totalPercent = min(100, $performance + $couponPercent);
        $finalPrice = (int) round($basePrice * (100 - $totalPercent) / 100);
        $labels = [];
        if ($performance > 0) {
            $labels[] = "٪{$performance} عملکردی";
        }
        if ($couponPercent > 0) {
            $labels[] = "٪{$couponPercent} کد {$couponCode}";
        }

        return [
            'basePrice' => $basePrice,
            'performancePercent' => $performance,
            'couponPercent' => $couponPercent,
            'couponValid' => (bool) ($coupon && $coupon->isValid()),
            'finalPrice' => $finalPrice,
            'discountLabel' => implode(' + ', $labels),
        ];
    }

    /** Count a redeemed coupon toward its max_uses (wallet / free flows). */
    /** Claims one use of the coupon for a settled (free/wallet) order. False = code no longer usable. */
    private function claimCoupon(array $pricing, ?string $couponCode): bool
    {
        if ($pricing['couponPercent'] <= 0 || ! $couponCode) {
            return true;
        }

        return Coupon::redeem(strtoupper(trim($couponCode)));
    }

    private function newPurchase(string $userId, Chapter $chapter, array $pricing, string $checkoutId, ?string $couponCode = null): Purchase
    {
        // receipt_id is NOT NULL + unique in the schema, so every order gets a
        // placeholder receipt at insert time (overwritten once paid).
        $receipt = 'ORD-'.strtoupper(Str::random(10));
        // Flow markers (FREE / WALLET) must stay globally unique on checkout_id.
        if ($checkoutId === 'FREE' || $checkoutId === 'WALLET') {
            $checkoutId .= '-'.(string) Str::uuid();
        }

        return Purchase::create([
            'checkout_id' => $checkoutId,
            'user_id' => $userId,
            'chapter_id' => $chapter->id,
            'price' => $pricing['finalPrice'],
            'base_price' => $pricing['basePrice'],
            'discount_label' => $pricing['discountLabel'] ?: null,
            'coupon_code' => $pricing['couponPercent'] > 0 ? strtoupper(trim((string) $couponCode)) : null,
            'receipt_id' => $receipt,
            'status' => 'pending',
        ]);
    }

    /**
     * Mark an order as failed.
     *
     * A paid or refunded order is never downgraded to failed (a late or
     * duplicate callback must not revoke access). The unique
     * [user_id, chapter_id, status] index allows a single failed row per
     * chapter, so an older failed attempt for the same chapter is removed first;
     * the payment-event log keeps the full audit trail either way.
     */
    private function markFailed(Purchase $purchase): void
    {
        DB::transaction(function () use ($purchase) {
            $current = Purchase::whereKey($purchase->getKey())->lockForUpdate()->first();
            if (! $current || in_array($current->status, ['paid', 'refunded'], true)) {
                return;
            }
            Purchase::where('user_id', $current->user_id)
                ->where('chapter_id', $current->chapter_id)
                ->where('status', 'failed')
                ->whereKeyNot($current->getKey())
                ->delete();
            $current->update(['status' => 'failed']);
        });
    }

    private function hasPaidAccess(string $userId, string $chapterId): bool
    {
        return Purchase::where('user_id', $userId)->where('chapter_id', $chapterId)->where('status', 'paid')->exists();
    }

    private function redirectResult(Purchase $purchase, string $status): RedirectResponse
    {
        $frontend = rtrim((string) config('app.frontend_url'), '/');
        $granted = $status === 'success';
        if ($granted) {
            // Access is derived from paid purchases (see AccessController / catalog),
            // so no extra grant row is needed here.
        }

        return redirect()->to($frontend."/payment?status={$status}&purchase={$purchase->id}");
    }
}
