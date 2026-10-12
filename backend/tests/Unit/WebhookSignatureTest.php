<?php

namespace Tests\Unit;

use App\Services\IDPayGateway;
use App\Services\WebhookSignature;
use Illuminate\Http\Request;
use Tests\TestCase;

/**
 * HMAC webhook verification fails closed: with no secret nothing is trusted. The
 * IDPay gateway (which does not sign webhooks) opts out explicitly.
 */
class WebhookSignatureTest extends TestCase
{
    private function request(string $body, ?string $signature = null): Request
    {
        $request = Request::create('/api/v1/payment/webhook', 'POST', [], [], [], [], $body);
        if ($signature !== null) {
            $request->headers->set('X-Signature', $signature);
        }

        return $request;
    }

    public function test_empty_secret_rejects_everything_even_a_matching_signature(): void
    {
        $body = '{"status":100}';
        $signature = hash_hmac('sha256', $body, '');

        $this->assertFalse(WebhookSignature::verify($this->request($body, $signature), ''));
        $this->assertFalse(WebhookSignature::verify($this->request($body), ''));
    }

    public function test_valid_hex_and_base64_signatures_are_accepted_with_a_secret(): void
    {
        $body = '{"status":100,"id":"x"}';
        $hex = hash_hmac('sha256', $body, 's3cret');
        $base64 = base64_encode(hex2bin($hex));

        $this->assertTrue(WebhookSignature::verify($this->request($body, $hex), 's3cret'));
        $this->assertTrue(WebhookSignature::verify($this->request($body, $base64), 's3cret'));
    }

    public function test_tampered_body_or_wrong_secret_or_missing_header_is_rejected(): void
    {
        $body = '{"status":100}';
        $hex = hash_hmac('sha256', $body, 's3cret');

        $this->assertFalse(WebhookSignature::verify($this->request('{"status":1}', $hex), 's3cret'));
        $this->assertFalse(WebhookSignature::verify($this->request($body, $hex), 'other'));
        $this->assertFalse(WebhookSignature::verify($this->request($body), 's3cret'));
    }

    public function test_unsigned_idpay_gateway_defers_to_server_side_verification(): void
    {
        config(['services.idpay.webhook_secret' => '', 'payment.hmac.secret' => '']);

        $this->assertTrue((new IDPayGateway)->verifyWebhookSignature($this->request('{}')));
    }

    public function test_idpay_with_a_configured_secret_requires_a_valid_signature(): void
    {
        config(['services.idpay.webhook_secret' => 'idpay-secret', 'payment.hmac.header' => 'X-Signature', 'payment.hmac.algo' => 'sha256']);
        $body = '{"status":100}';

        $this->assertFalse((new IDPayGateway)->verifyWebhookSignature($this->request($body)));
        $this->assertTrue((new IDPayGateway)->verifyWebhookSignature($this->request($body, hash_hmac('sha256', $body, 'idpay-secret'))));
    }
}
