<?php

// Payment gateway + webhook security settings. Read via config() everywhere —
// never env() — so the values survive `php artisan config:cache` in production.

return [

    // Active gateway: zarinpal (default) or idpay.
    'gateway' => env('PAYMENT_GATEWAY', 'zarinpal'),

    // Layer 1 webhook protection: shared secret the gateway sends in the
    // X-Webhook-Secret header. Empty = disabled.
    'webhook_secret' => env('PAYMENT_WEBHOOK_SECRET', ''),

    // Layer 2 webhook protection: HMAC signature over the raw body
    // (signature = hash_hmac(algo, rawBody, secret) sent in `header`).
    'hmac' => [
        'secret' => env('WEBHOOK_HMAC_SECRET', ''),
        'header' => env('WEBHOOK_HMAC_HEADER', 'X-Signature'),
        'algo' => env('WEBHOOK_HMAC_ALGO', 'sha256'),
    ],

];
