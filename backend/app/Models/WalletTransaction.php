<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WalletTransaction extends Model
{
    protected $fillable = ['user_id', 'type', 'amount', 'balance_after', 'status', 'gateway_ref', 'purchase_id', 'description'];

    protected function casts(): array
    {
        return ['amount' => 'integer', 'balance_after' => 'integer', 'purchase_id' => 'integer'];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
