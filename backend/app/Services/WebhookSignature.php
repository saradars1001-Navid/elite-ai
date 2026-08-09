<?php

namespace App\Services;

use Illuminate\Http\Request;

/**
 * Generic HMAC webhook signature verification for gateways that sign their
 * webhook payloads (e.g. Zibal-style integrations and custom providers).
 *
 * The signature is computed over the RAW request body (not the parsed array),
 * so the exact bytes the gateway signed are what we verify:
 *
 *   signature = hash_hmac(algo, rawBody, secret)
 *
 * Configuration is read from env so any gateway can opt in without code
 * changes. An empty secret disables the check (gateways without signatures
 * remain protected by the server-to-server re-verification in the controller).
 */
final class WebhookSignature
{
    public static function verify(
        Request $request,
        ?string $secret = null,
        string $header = 'X-Signature',
        string $algo = 'sha256'
    ): bool {
        $secret = $secret ?? (string) env('WEBHOOK_HMAC_SECRET', '');
        if ($secret === '') {
            return true;
        } // not configured — skip

        $provided = trim((string) $request->header($header, ''));
        if ($provided === '') {
            return false;
        }

        // Accept both common encodings: lowercase hex and base64 of the digest.
        $computed = hash_hmac($algo, (string) $request->getContent(), $secret);
        if (hash_equals($computed, $provided)) {
            return true;
        }
        $base64 = base64_encode(hex2bin($computed));

        return hash_equals($base64, $provided);
    }
}
