<?php

// One-time login codes. Read via config() everywhere — never env() — so the
// values survive `php artisan config:cache` in production.

return [

    // Only 'twilio' is implemented today; kept here so a future driver needs
    // no new environment plumbing.
    'driver' => env('OTP_DRIVER', 'twilio'),

    // Code length in digits (verifyOtp validation uses this too).
    'length' => (int) env('OTP_LENGTH', 5),

    // How long a code stays valid, in minutes.
    'ttl_minutes' => (int) env('OTP_TTL_MINUTES', 5),

    // Local/testing only: log the code instead of calling the SMS provider.
    'test_mode' => env('OTP_TEST_MODE', false),

];
