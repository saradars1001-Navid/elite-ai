<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WalletTransaction extends Model
{
    /** The reference the charge was opened with (authority or payment id). */
    public function expectedAuthority(): ?string
    {
        return $this->gateway_authority ?: $this->gateway_ref ?: null;
    }

    protected $fillable = ['user_id', 'type', 'amount', 'balance_after', 'status', 'gateway_ref', 'gateway_authority', 'purchase_id', 'description'];

    protected function casts(): array
    {
        return ['amount' => 'integer', 'balance_after' => 'integer', 'purchase_id' => 'integer'];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
