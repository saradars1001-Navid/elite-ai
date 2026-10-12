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
 * Configuration is read from config (payment.hmac.*). This helper FAILS CLOSED:
 * with no secret nothing can be authenticated, so verification returns false.
 * A gateway that does not sign its webhooks must decide that itself (it returns
 * true and the notification is trusted only after server-to-server verification).
 */
final class WebhookSignature
{
    public static function verify(
        Request $request,
        ?string $secret = null,
        string $header = 'X-Signature',
        string $algo = 'sha256'
    ): bool {
        $secret = $secret ?? (string) config('payment.hmac.secret', '');
        if ($secret === '') {
            return false; // no secret configured: nothing can be verified, so reject
        }

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
