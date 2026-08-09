<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentEvent extends Model
{
    protected $fillable = ['source', 'gateway', 'type', 'reference_type', 'reference_id', 'status', 'payload', 'verify_result', 'error', 'ip'];

    protected function casts(): array
    {
        return ['payload' => 'array', 'verify_result' => 'array'];
    }
}
