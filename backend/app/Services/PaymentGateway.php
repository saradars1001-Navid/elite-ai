<?php

namespace App\Services;

use Illuminate\Http\Request;

interface PaymentGateway
{
    /** Create a payment and return ['url' => redirect URL, 'ref' => transaction/payment id]. */
    public function initiate(int $amountToman, string $description, string $callbackUrl, string $referenceId): array;

    /** Verify a payment after the gateway redirects back. Returns ['ok' => bool, 'ref' => string|null]. */
    public function verify(string $authority, int $amountToman, ?string $orderId = null): array;

    /** Reverse a paid transaction. Returns ['ok' => bool, 'ref' => string|null]. */
    public function refund(string $authority, int $amountToman): array;

    /**
     * Read the gateway's redirect query parameters and return the proof needed
     * for verify(): ['ok' => bool, 'authority' => string, 'ref' => string|null].
     * Each gateway parses its own query shape here so the controller stays
     * gateway-agnostic.
     */
    public function verifyFromCallback(Request $request): array;

    /**
     * Parse a server-to-server webhook POST into a normalized notification:
     * [
     *   'supported'   => bool,          // false when the gateway has no webhook
     *   'type'        => 'payment'|'refund',
     *   'status'      => 'paid'|'failed'|'refunded',
     *   'referenceId' => string,        // purchase id or 'wallet-{id}'
     *   'authority'   => string,        // payment/transaction id for re-verification
     *   'ref'         => string|null,   // gateway reference/track id
     * ]
     * The payload is always re-verified server-to-server by the handler, so a
     * forged webhook without a real gateway transaction can never succeed.
     */
    public function parseWebhook(Request $request): array;

    /**
     * Verify the gateway's HMAC webhook signature over the raw request body.
     * Gateways that do not sign their webhooks return true (they stay protected
     * by the server-to-server re-verification in the webhook handler).
     */
    public function verifyWebhookSignature(Request $request): bool;
}
