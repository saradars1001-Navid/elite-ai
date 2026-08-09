<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

/**
 * IDPay (idpay.ir) payment gateway — v1.1 REST API.
 *
 * Amounts are passed in Toman by the interface and converted to Rial here
 * (IDPay works in Rial, like Zarinpal). The callback redirect carries
 * ?id={payment_id}&track_id={transaction}&order_id={order_id}&status={1|2}.
 * Refunds are issued from the IDPay panel in v1.1 (no public REST endpoint),
 * so refund() records the failure and lets the admin mark it manually.
 */
class IDPayGateway implements PaymentGateway
{
    private string $apiKey;

    private bool $sandbox;

    private string $endpoint = 'https://api.idpay.ir/v1.1/';

    public function __construct()
    {
        $this->apiKey = (string) env('IDPAY_API_KEY', '');
        $this->sandbox = (bool) env('IDPAY_SANDBOX', false);
    }

    private function headers(): array
    {
        // The X-Sanbox header must only be present in sandbox mode; production
        // requests must not send it.
        $headers = ['X-API-Key' => $this->apiKey];
        if ($this->sandbox) {
            $headers['X-Sanbox'] = '1';
        }

        return $headers;
    }

    public function initiate(int $amountToman, string $description, string $callbackUrl, string $referenceId): array
    {
        if (! $this->apiKey) {
            throw new \RuntimeException('IDPay API key is not configured.');
        }
        $response = Http::withHeaders($this->headers())->asJson()->post($this->endpoint.'payment', [
            'order_id' => (string) $referenceId,
            'amount' => $amountToman * 10, // Rial
            'name' => mb_substr($description, 0, 120),
            'desc' => mb_substr($description, 0, 240),
            'callback' => $callbackUrl,
            'payer_mail' => '',
            'payer_desc' => '',
        ]);
        $data = $response->json() ?? [];
        if (! in_array($response->status(), [200, 201], true) || empty($data['id']) || empty($data['link'])) {
            throw new \RuntimeException('IDPay request failed: '.($data['error_message'] ?? $response->body()));
        }

        return ['url' => (string) $data['link'], 'ref' => (string) $data['id']];
    }

    public function verify(string $authority, int $amountToman, ?string $orderId = null): array
    {
        $response = Http::withHeaders($this->headers())->asJson()->post($this->endpoint.'payment/verify', [
            'id' => $authority,
            'order_id' => (string) ($orderId ?? $authority),
        ]);
        $data = $response->json() ?? [];
        $ok = in_array((int) ($data['status'] ?? 0), [100, 101], true);

        return ['ok' => $ok, 'ref' => $ok ? (string) ($data['track_id'] ?? $authority) : null];
    }

    public function refund(string $authority, int $amountToman): array
    {
        // IDPay v1.1 does not expose a public REST refund endpoint — refunds
        // are issued from the panel. Return false so the admin flow prompts a
        // manual verification (same fallback as Zarinpal v4).
        return ['ok' => false, 'ref' => null];
    }

    public function verifyFromCallback(Request $request): array
    {
        // IDPay redirects with ?status=1 (success) / 2 (failed), track_id and id.
        $status = (int) $request->query('status', 0);
        $trackId = (string) $request->query('track_id', '');
        $paymentId = (string) $request->query('id', '');

        return ['ok' => $status === 1 && $trackId !== '', 'authority' => $paymentId, 'ref' => $trackId];
    }

    public function parseWebhook(Request $request): array
    {
        // IDPay may POST payment results (JSON or form) with id, order_id,
        // track_id and status. The payload is re-verified server-to-server by
        // the handler, so the exact trust level of the POST itself is irrelevant.
        $body = $request->isJson() ? ($request->json()->all() ?? []) : $request->all();
        $body = is_array($body) ? $body : [];
        $paymentId = (string) ($body['id'] ?? $request->query('id', ''));
        $orderId = (string) ($body['order_id'] ?? $request->query('order_id', ''));
        $trackId = (string) ($body['track_id'] ?? $request->query('track_id', ''));
        $status = (int) ($body['status'] ?? $request->query('status', 0));

        if ($paymentId === '' || $orderId === '') {
            return ['supported' => false];
        }

        return [
            'supported' => true,
            'type' => 'payment',
            'status' => in_array($status, [100, 101], true) ? 'paid' : 'failed',
            'referenceId' => $orderId,
            'authority' => $paymentId,
            'ref' => $trackId !== '' ? $trackId : null,
        ];
    }

    public function verifyWebhookSignature(Request $request): bool
    {
        // IDPay v1.1 does not sign webhooks itself; opt in to HMAC verification
        // with IDPAY_WEBHOOK_SECRET (or the global WEBHOOK_HMAC_SECRET) when a
        // shared secret is configured. Without a secret the check is skipped and
        // security stays with the server-to-server re-verification.
        $secret = (string) env('IDPAY_WEBHOOK_SECRET', env('WEBHOOK_HMAC_SECRET', ''));
        $header = (string) env('WEBHOOK_HMAC_HEADER', 'X-Signature');
        $algo = (string) env('WEBHOOK_HMAC_ALGO', 'sha256');

        return WebhookSignature::verify($request, $secret, $header, $algo);
    }
}
