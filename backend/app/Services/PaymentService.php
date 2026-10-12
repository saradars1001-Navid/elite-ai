<?php

namespace App\Services;

use Illuminate\Support\ServiceProvider;

/**
 * Resolves the active payment gateway from PAYMENT_GATEWAY env:
 *   zarinpal (default) | idpay
 * Each gateway implements the same PaymentGateway interface, so checkout,
 * callback, verify and refund flows stay identical for every provider.
 */
class PaymentService extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(PaymentGateway::class, function () {
            return match (config('payment.gateway', 'zarinpal')) {
                'idpay' => new IDPayGateway,
                default => new ZarinpalGateway,
            };
        });
    }
}
