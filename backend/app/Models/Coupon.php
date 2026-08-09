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

    public function isValid(): bool
    {
        return $this->active && (! $this->expires_at || now()->lt($this->expires_at)) && ($this->max_uses === null || $this->used_count < $this->max_uses);
    }
}
