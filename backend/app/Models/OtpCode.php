<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Hash;

class OtpCode extends Model
{
    public $timestamps = false;

    protected $fillable = ['phone', 'code_hash', 'expires_at', 'attempts', 'used_at'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'used_at' => 'datetime', 'attempts' => 'integer'];
    }

    public function matches(string $code): bool
    {
        return ! $this->used_at && now()->lt($this->expires_at) && Hash::check($code, $this->code_hash);
    }
}
