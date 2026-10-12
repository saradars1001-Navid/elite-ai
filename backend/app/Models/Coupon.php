<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Coupon extends Model
{
    protected $fillable = ['code', 'percent', 'max_uses', 'used_count', 'expires_at', 'active'];

    protected function casts(): array
    {
        return ['percent' => 'integer', 'max_uses' => 'integer', 'used_count' => 'integer', 'expires_at' => 'datetime', 'active' => 'boolean'];
    }

    /**
     * Atomically claim one use of a coupon. The usage check and the increment are
     * a single conditional UPDATE, so two concurrent checkouts cannot both take the
     * last use. Returns false when the code is unknown, inactive, expired or used up.
     */
    public static function redeem(string $code): bool
    {
        return static::query()
            ->where('code', $code)
            ->where('active', true)
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->where(fn ($q) => $q->whereNull('max_uses')->orWhereColumn('used_count', '<', 'max_uses'))
            ->increment('used_count') > 0;
    }

    public function isValid(): bool
    {
        return $this->active && (! $this->expires_at || now()->lt($this->expires_at)) && ($this->max_uses === null || $this->used_count < $this->max_uses);
    }
}
