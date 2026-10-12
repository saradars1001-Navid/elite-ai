<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class ZarinpalGateway implements PaymentGateway
{
    private string $merchant;

    private bool $sandbox;

    private string $endpoint;

    private string $gatewayUrl;

    public function __construct()
    {
        $this->merchant = (string) config('services.zarinpal.merchant_id', '');
        $this->sandbox = filter_var(config('services.zarinpal.sandbox', false), FILTER_VALIDATE_BOOL);
        $this->endpoint = $this->sandbox ? 'https://sandbox.zarinpal.com/pg/v4/payment/' : 'https://payment.zarinpal.com/pg/v4/payment/';
        $this->gatewayUrl = $this->sandbox ? 'https://sandbox.zarinpal.com/pg/StartPay/' : 'https://payment.zarinpal.com/pg/StartPay/';
    }

    public function initiate(int $amountToman, string $description, string $callbackUrl, string $referenceId): array
    {
        if (! $this->merchant) {
            throw new \RuntimeException('Zarinpal merchant is not configured.');
        }
        $response = Http::asJson()->post($this->endpoint.'request.json', [
            'merchant_id' => $this->merchant,
            'amount' => $amountToman * 10, // Zarinpal works in Rial
            'description' => mb_substr($description, 0, 200),
            'callback_url' => $callbackUrl,
            'metadata' => ['reference_id' => $referenceId, 'mobile' => ''],
        ]);
        $data = $response->json() ?? [];
        if (($data['data']['code'] ?? 0) !== 100 || empty($data['data']['authority'])) {
            throw new \RuntimeException('Zarinpal request failed: '.($data['errors']['message'] ?? $response->body()));
        }
        $authority = (string) $data['data']['authority'];

        return ['url' => $this->gatewayUrl.$authority, 'ref' => $authority];
    }

    public function verify(string $authority, int $amountToman, ?string $orderId = null): array
    {
        $response = Http::asJson()->post($this->endpoint.'verify.json', [
            'merchant_id' => $this->merchant,
            'amount' => $amountToman * 10,
            'authority' => $authority,
        ]);
        $data = $response->json() ?? [];
        $ok = ($data['data']['code'] ?? 0) === 100;

        return ['ok' => $ok, 'ref' => $ok ? (string) ($data['data']['ref_id'] ?? $authority) : null];
    }

    public function refund(string $authority, int $amountToman): array
    {
        // Zarinpal refunds are issued through the panel for v4; attempt the API and
        // fall back to a recorded admin refund so the order state stays consistent.
        try {
            $response = Http::asJson()->post($this->endpoint.'refund.json', [
                'merchant_id' => $this->merchant,
                'amount' => $amountToman * 10,
                'authority' => $authority,
            ]);
            $data = $response->json() ?? [];
            if (($data['data']['code'] ?? 0) === 100) {
                return ['ok' => true, 'ref' => (string) ($data['data']['ref_id'] ?? $authority)];
            }
        } catch (\Throwable $e) {
            // fall through
        }

        return ['ok' => false, 'ref' => null];
    }

    public function verifyFromCallback(Request $request): array
    {
        // Zarinpal redirects back with ?Status=OK&Authority=... (or lowercase
        // authority from some setups). Verification itself is done in verify().
        $status = (string) $request->query('Status', '');
        $authority = (string) $request->query('Authority', $request->query('authority', ''));

        return ['ok' => $status === 'OK' && $authority !== '', 'authority' => $authority, 'ref' => null];
    }

    public function parseWebhook(Request $request): array
    {
        // Zarinpal v4 has no server-to-server webhook — confirmations arrive via
        // the redirect callback + verify API. Webhook requests are ignored.
        return ['supported' => false];
    }

    public function verifyWebhookSignature(Request $request): bool
    {
        return true; // no webhook to sign
    }
}
