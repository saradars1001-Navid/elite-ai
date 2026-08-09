<?php

use App\Services\PaymentService;
use Illuminate\Support\ServiceProvider;

return [
    'name' => env('APP_NAME', 'Elite AI Academy API'),
    'env' => env('APP_ENV', 'production'),
    'debug' => (bool) env('APP_DEBUG', false),
    'url' => env('APP_URL', 'http://localhost'),
    'timezone' => 'Asia/Tehran',
    'locale' => 'fa',
    'fallback_locale' => 'en',
    'faker_locale' => 'fa_IR',
    'cipher' => 'AES-256-CBC',
    'key' => env('APP_KEY'),
    'maintenance' => ['driver' => 'file'],
    'previous_keys' => [...array_filter(explode(',', (string) env('APP_PREVIOUS_KEYS', '')))],
    'providers' => ServiceProvider::defaultProviders()->merge([PaymentService::class])->toArray(),
];
