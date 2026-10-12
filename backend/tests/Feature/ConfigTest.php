<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * Runtime code must read settings through config(), never env(): after
 * `php artisan config:cache` (the production deploy step) env() returns null
 * outside config files. These assertions pin the config contract used by the
 * controllers and services.
 */
class ConfigTest extends TestCase
{
    public function test_otp_config_resolves_with_defaults(): void
    {
        $this->assertSame('twilio', config('otp.driver'));
        $this->assertSame(5, config('otp.length'));
        $this->assertSame(5, config('otp.ttl_minutes'));
        $this->assertIsBool(config('otp.test_mode'));
    }

    public function test_twilio_config_resolves(): void
    {
        $this->assertFalse((bool) config('services.twilio.sms_enabled'));
        $this->assertArrayHasKey('account_sid', (array) config('services.twilio'));
    }

    public function test_payment_config_resolves_with_defaults(): void
    {
        $this->assertSame('zarinpal', config('payment.gateway'));
        $this->assertSame('X-Signature', config('payment.hmac.header'));
        $this->assertSame('sha256', config('payment.hmac.algo'));
        $this->assertIsString(config('payment.webhook_secret'));
    }

    public function test_urls_resolved_from_environment(): void
    {
        // phpunit.xml pins these so redirect targets stay deterministic.
        $this->assertSame('https://api.example.test', config('app.url'));
        $this->assertSame('https://app.example.test', config('app.frontend_url'));
    }
}
