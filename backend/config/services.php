<?php

// Third-party service credentials. Values are frozen into the config cache
// by `php artisan config:cache`, so runtime code must read them via config()
// and never via env() directly (env() returns null with a cached config).

return [

    // Twilio — OTP login SMS (AuthController) and event notifications
    // (NotificationService). sms_enabled gates the notification SMS channel.
    'twilio' => [
        'account_sid' => env('TWILIO_ACCOUNT_SID'),
        'auth_token' => env('TWILIO_AUTH_TOKEN'),
        'from' => env('TWILIO_FROM'),
        'sms_enabled' => env('NOTIFY_SMS_ENABLED', false),
    ],

    'zarinpal' => [
        'merchant_id' => env('ZARINPAL_MERCHANT_ID', ''),
        'sandbox' => env('ZARINPAL_SANDBOX', false),
    ],

    'idpay' => [
        'api_key' => env('IDPAY_API_KEY', ''),
        'sandbox' => env('IDPAY_SANDBOX', false),
        // Dedicated IDPay webhook signing secret; falls back to
        // payment.hmac.secret when empty (see IDPayGateway).
        'webhook_secret' => env('IDPAY_WEBHOOK_SECRET', ''),
    ],

];
