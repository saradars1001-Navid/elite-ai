<?php

namespace App\Services;

use App\Models\Purchase;
use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * The single place where a paid purchase is returned to the buyer.
 *
 *  - Wallet purchases are credited back to the wallet balance (ledger entry).
 *  - Gateway purchases are refunded at the gateway using the authority they were
 *    opened with. If the gateway refuses, nothing changes and the caller gets 502.
 *  - Free purchases had no payment, so they are only closed.
 *  - A paid purchase with no gateway reference can only be closed with an explicit
 *    manual refund (the money was returned outside the system). That is logged.
 *
 * The purchase row is locked for the whole operation, so a double click or two
 * admins cannot refund (or credit) the same purchase twice.
 */
final class PurchaseRefunder
{
    public function __construct(private PaymentGateway $gateway) {}

    /**
     * @return array{ok: bool, status: int, message?: string, purchase?: Purchase}
     */
    public function refund(Purchase $purchase, bool $manual = false, ?string $note = null, ?string $adminId = null): array
    {
        $result = DB::transaction(function () use ($purchase, $manual) {
            $locked = Purchase::whereKey($purchase->id)->lockForUpdate()->firstOrFail();

            if ($locked->status === 'refunded') {
                return ['ok' => false, 'status' => 422, 'message' => 'این خرید قبلاً مسترد شده است.'];
            }
            if ($locked->status !== 'paid') {
                return ['ok' => false, 'status' => 422, 'message' => 'فقط خرید موفق قابل بازگشت است.'];
            }

            if ($locked->isWalletPurchase()) {
                $this->creditWallet($locked);
            } elseif ($locked->isFreePurchase() || (int) $locked->price <= 0) {
                // Nothing was charged, so there is nothing to return.
            } elseif ($manual) {
                // Returned outside the system by an admin; recorded by the caller.
            } elseif ($locked->expectedAuthority()) {
                $gateway = $this->gateway->refund((string) $locked->expectedAuthority(), (int) $locked->price);
                if (! ($gateway['ok'] ?? false)) {
                    return [
                        'ok' => false,
                        'status' => 502,
                        'message' => 'بازگشت وجه در درگاه ناموفق بود. مبلغ را بررسی کنید یا با «بازگشت دستی» ثبت کنید.',
                    ];
                }
            } else {
                return [
                    'ok' => false,
                    'status' => 422,
                    'message' => 'این خرید به درگاه پرداخت متصل نیست. برای ثبت بازگشت دستی، یادداشت را وارد کنید.',
                ];
            }

            $locked->update(['status' => 'refunded', 'refunded_at' => now()]);

            return ['ok' => true, 'status' => 200, 'purchase' => $locked];
        });

        if ($result['ok'] && $manual) {
            Log::warning('manual purchase refund', [
                'purchase_id' => $purchase->id,
                'admin_id' => $adminId,
                'note' => $note,
            ]);
        }

        return $result;
    }

    private function creditWallet(Purchase $purchase): void
    {
        $user = User::whereKey($purchase->user_id)->lockForUpdate()->firstOrFail();
        $balance = (int) $user->wallet_balance + (int) $purchase->price;
        $user->update(['wallet_balance' => $balance]);

        WalletTransaction::create([
            'user_id' => $user->id,
            'type' => 'refund',
            'amount' => (int) $purchase->price,
            'balance_after' => $balance,
            'status' => 'completed',
            'purchase_id' => $purchase->id,
            'description' => 'بازگشت وجه خرید فصل '.($purchase->chapter?->title ?? ''),
        ]);
    }
}
