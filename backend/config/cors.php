<?php

// Local dev servers (Vite) run on these origins; they are only allowed when
// APP_ENV=local so a production deployment stays locked to its own domains.
$localOrigins = env('APP_ENV') === 'local'
    ? ['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://localhost:4173']
    : [];

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_values(array_filter(array_merge([
        env('FRONTEND_URL'),
        env('APP_URL'),
    ], $localOrigins))),
    // In local development the Vite dev server can pick any free port, so allow
    // any loopback origin there and keep production pinned to its own domains.
    'allowed_origins_patterns' => env('APP_ENV') === 'local'
        ? ['#^http://(127\.0\.0\.1|localhost):\d+$#']
        : [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 86400,
    'supports_credentials' => false,
];
