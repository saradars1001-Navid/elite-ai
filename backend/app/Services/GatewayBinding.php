<?php

namespace App\Services;

/**
 * Ties a gateway redirect/webhook to the order it was opened for.
 *
 * The authority/payment id that the gateway reports must equal the reference
 * stored on the order when checkout started (`gateway_authority`, falling back to `gateway_ref` for older rows). Without this
 * check, a paid authority from one order could be replayed against any other
 * pending order with the same amount, because the gateway verify API only
 * checks the authority and the amount.
 */
final class GatewayBinding
{
    public static function matches(?string $gatewayRef, ?string $authority): bool
    {
        if ($gatewayRef === null || $gatewayRef === '' || $authority === null || $authority === '') {
            return false;
        }

        return hash_equals((string) $gatewayRef, (string) $authority);
    }
}
