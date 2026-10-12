<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Purchase extends Model
{
    protected $fillable = ['checkout_id', 'user_id', 'chapter_id', 'price', 'base_price', 'discount_label', 'coupon_code', 'receipt_id', 'gateway_ref', 'gateway_authority', 'status', 'refunded_at', 'refund_requested_at', 'refund_rejected_at', 'refund_reason'];

    protected function casts(): array
    {
        return [
            'price' => 'integer',
            'base_price' => 'integer',
            'refunded_at' => 'datetime',
            'refund_requested_at' => 'datetime',
            'refund_rejected_at' => 'datetime',
        ];
    }

    /** The reference the order was opened with (authority or payment id). */
    public function expectedAuthority(): ?string
    {
        return $this->gateway_authority ?: $this->gateway_ref ?: null;
    }

    /**
     * Derived access status exposed to the API: a pending user refund request
     * is represented by refund_requested_at set while refund_rejected_at is null.
     */
    /** Bought with wallet balance (checkout id is prefixed by the flow marker). */
    public function isWalletPurchase(): bool
    {
        return str_starts_with((string) $this->checkout_id, 'WALLET-');
    }

    /** Fully discounted, granted without a payment. */
    public function isFreePurchase(): bool
    {
        return str_starts_with((string) $this->checkout_id, 'FREE-');
    }

    public function isRefundPending(): bool
    {
        return $this->refund_requested_at !== null && $this->refund_rejected_at === null && $this->refunded_at === null;
    }

    public function chapter()
    {
        return $this->belongsTo(Chapter::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
