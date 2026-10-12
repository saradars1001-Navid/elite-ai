<?php

namespace App\Http\Controllers;

use App\Models\Chapter;
use App\Models\Coupon;
use App\Models\DiscountRule;
use App\Models\Purchase;
use App\Models\WalletTransaction;
use App\Services\NotificationService;
use App\Services\PaymentEventLogger;
use App\Services\PaymentGateway;
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

        $pricing = $this->price($request->user()->id, $chapter, $data['couponCode'] ?? null);
        if ($pricing['finalPrice'] <= 0) {
            // Fully discounted (0 تومان) — grant access directly without a gateway.
            $purchase = DB::transaction(function () use ($request, $chapter, $pricing, $data) {
                $purchase = $this->newPurchase($request->user()->id, $chapter, $pricing, 'FREE', $data['couponCode'] ?? null);
                $purchase->update(['status' => 'paid', 'receipt_id' => 'FREE-'.strtoupper(Str::random(8)), 'refunded_at' => null]);
                $this->bumpCoupon($purchase->coupon_code);

                return $purchase;
            });

            return response()->json(['purchaseId' => $purchase->id, 'amount' => 0, 'checkoutUrl' => null]);
        }

        // Buy with wallet balance — server-side balance check + ledger entry.
        if (($data['paymentMethod'] ?? 'gateway') === 'wallet') {
            $user = $request->user();
            $balance = (int) $user->wallet_balance;
            if ($balance < $pricing['finalPrice']) {
                return response()->json(['message' => 'موجودی کیف پول کافی نیست. لطفاً ابتدا کیف پول را شارژ کنید.'], 422);
            }
            $purchase = DB::transaction(function () use ($request, $user, $balance, $chapter, $pricing, $data) {
                $newBalance = $balance - $pricing['finalPrice'];
                $user->update(['wallet_balance' => $newBalance]);
                $purchase = $this->newPurchase($request->user()->id, $chapter, $pricing, 'WALLET', $data['couponCode'] ?? null);
                $purchase->update(['status' => 'paid', 'receipt_id' => 'WLT-'.strtoupper(Str::random(8)), 'refunded_at' => null]);
                $this->bumpCoupon($purchase->coupon_code);
                WalletTransaction::create([
                    'user_id' => $request->user()->id,
                    'type' => 'purchase',
                    'amount' => $pricing['finalPrice'],
                    'balance_after' => $newBalance,
                    'status' => 'completed',
                    'purchase_id' => $purchase->id,
                    'description' => 'خرید فصل '.$chapter->title,
                ]);

                return $purchase;
            });

            return response()->json(['purchaseId' => $purchase->id, 'amount' => 0, 'checkoutUrl' => null, 'walletPaid' => true]);
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
            $existing->update(['gateway_ref' => $result['ref']]);

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
        if ($proof['ok'] && $proof['authority'] !== '') {
            try {
                $verify = $this->gateway->verify($proof['authority'], (int) $purchase->price, (string) $purchase->id);
                PaymentEventLogger::verify($eventId, $verify);
                if ($verify['ok']) {
                    DB::transaction(function () use ($purchase, $verify, $proof) {
                        $purchase->update([
                            'status' => 'paid',
                            'receipt_id' => 'REC-'.strtoupper(Str::random(10)),
                            'gateway_ref' => $verify['ref'] ?? $proof['ref'] ?? $purchase->gateway_ref,
                            'refunded_at' => null,
                        ]);
                        $coupon = $purchase->coupon_code ? Coupon::where('code', $purchase->coupon_code)->first() : null;
                        if ($coupon) {
                            $coupon->increment('used_count');
                        }
                    });
                    $status = 'success';
                }
            } catch (\Throwable $e) {
                report($e);
            }
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
        if ($purchase->status === 'refunded') {
            return response()->json(['message' => 'این خرید قبلاً مسترد شده است.'], 422);
        }
        if ($purchase->status !== 'paid') {
            return response()->json(['message' => 'فقط خرید موفق قابل بازگشت است.'], 422);
        }

        $gatewayOk = true;
        if ($purchase->gateway_ref) {
            $result = $this->gateway->refund((string) $purchase->gateway_ref, (int) $purchase->price);
            $gatewayOk = $result['ok'];
        }
        if ($gatewayOk) {
            $purchase->update(['status' => 'refunded', 'refunded_at' => now()]);
            $chapterTitle = $purchase->chapter?->title ?? 'فصل آموزشی';
            app(NotificationService::class)->send(
                $purchase->user,
                'payment',
                'بازگشت وجه',
                'مبلغ خرید فصل «'.$chapterTitle.'» به شما بازگردانده شد.',
                ['link' => '/profile']
            );

            return response()->json(['ok' => true, 'purchase' => $purchase]);
        }

        return response()->json(['message' => 'بازگشت وجه در درگاه ناموفق بود. مبلغ را به‌صورت دستی بررسی کنید.'], 502);
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
                $best = DB::table('exam_attempts')->where('user_id', $userId)->where('chapter_id', $previous->id)->max('score');
                if ($best !== null) {
                    $performance = (DiscountRule::first()?->percentFor((int) $best)) ?? 0;
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
    private function bumpCoupon(?string $couponCode): void
    {
        if (! $couponCode) {
            return;
        }
        $coupon = Coupon::where('code', $couponCode)->first();
        if ($coupon) {
            $coupon->increment('used_count');
        }
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
     * The unique [user_id, chapter_id, status] index allows a single failed row
     * per chapter, so an older failed attempt for the same chapter is removed
     * first; the payment-event log keeps the full audit trail either way.
     */
    private function markFailed(Purchase $purchase): void
    {
        DB::transaction(function () use ($purchase) {
            Purchase::where('user_id', $purchase->user_id)
                ->where('chapter_id', $purchase->chapter_id)
                ->where('status', 'failed')
                ->whereKeyNot($purchase->getKey())
                ->delete();
            $purchase->update(['status' => 'failed']);
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
