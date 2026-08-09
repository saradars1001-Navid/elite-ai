<?php

namespace Tests\Feature;

use App\Models\Chapter;
use App\Models\PaymentEvent;
use App\Models\Purchase;
use App\Models\User;
use App\Services\IDPayGateway;
use App\Services\PaymentGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Server-to-server webhook security: the payload is never trusted as-is — it is
 * re-verified against the gateway's verify API (faked here with Http::fake).
 * A forged webhook without a real gateway transaction must be rejected, and a
 * genuine notification must activate the purchase (idempotently).
 */
class PaymentWebhookTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // The webhook flow needs a gateway that parses webhooks; IDPay is used
        // as the concrete gateway under test.
        $this->app->instance(PaymentGateway::class, new IDPayGateway);
    }

    private function user(): User
    {
        return User::create([
            'id' => (string) Str::uuid(),
            'name' => 'کاربر تست',
            'phone' => '09120000000',
            'wallet_balance' => 0,
        ]);
    }

    private function pendingPurchase(User $user): Purchase
    {
        Chapter::create([
            'id' => 'ch-test',
            'index' => 1,
            'title' => 'فصل تست',
            'price' => 50000,
            'free' => false,
        ]);

        return Purchase::create([
            'checkout_id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'chapter_id' => 'ch-test',
            'price' => 50000,
            'base_price' => 50000,
            'receipt_id' => 'TMP-'.Str::upper(Str::random(6)),
            'status' => 'pending',
        ]);
    }

    /** IDPay-style webhook payload (JSON body with id / order_id / track_id / status). */
    private function payload(Purchase $purchase, array $overrides = []): array
    {
        return array_merge([
            'id' => 'fake-payment-1',
            'order_id' => (string) $purchase->id,
            'track_id' => 'fake-track',
            'status' => 100,
        ], $overrides);
    }

    public function test_forged_webhook_without_real_transaction_is_rejected(): void
    {
        $user = $this->user();
        $purchase = $this->pendingPurchase($user);

        // The gateway verify API says this payment id was never paid — the
        // forged webhook claims status=100 but no real transaction exists.
        Http::fake([
            'api.idpay.ir/*' => Http::response(['status' => 2, 'track_id' => null], 200),
        ]);

        $response = $this->postJson('/api/v1/payment/webhook', $this->payload($purchase));

        $response->assertStatus(422)->assertJson(['error' => 'verification_failed']);
        $this->assertSame('pending', $purchase->fresh()->status);
    }

    public function test_valid_webhook_marks_purchase_paid(): void
    {
        $user = $this->user();
        $purchase = $this->pendingPurchase($user);

        // Genuine notification: the gateway verify API confirms the payment.
        Http::fake([
            'api.idpay.ir/*' => Http::response(['status' => 100, 'track_id' => '12345678'], 200),
        ]);

        $response = $this->postJson('/api/v1/payment/webhook', $this->payload($purchase, [
            'id' => 'real-payment-1',
            'track_id' => '12345678',
        ]));

        $response->assertOk()->assertJson(['ok' => true, 'purchase' => true]);
        $this->assertSame('paid', $purchase->fresh()->status);
        $this->assertSame('12345678', $purchase->fresh()->gateway_ref);

        // The audit log row must record the event with payload + verify result.
        $event = PaymentEvent::where('source', 'webhook')->first();
        $this->assertNotNull($event);
        $this->assertSame('processed', $event->status);
        $this->assertSame('purchase', $event->reference_type);
        $this->assertSame((string) $purchase->id, $event->reference_id);
        $this->assertSame(['ok' => true, 'ref' => '12345678'], $event->verify_result);
    }

    public function test_replayed_valid_webhook_is_idempotent(): void
    {
        $user = $this->user();
        $purchase = $this->pendingPurchase($user);

        Http::fake([
            'api.idpay.ir/*' => Http::response(['status' => 100, 'track_id' => '99999999'], 200),
        ]);

        $payload = $this->payload($purchase, ['id' => 'real-payment-2', 'track_id' => '99999999']);

        $this->postJson('/api/v1/payment/webhook', $payload)->assertOk();
        $receipt = $purchase->fresh()->receipt_id;

        // A replayed delivery must not double-process the purchase.
        $this->postJson('/api/v1/payment/webhook', $payload)
            ->assertOk()
            ->assertJson(['ok' => true, 'idempotent' => true]);

        $this->assertSame('paid', $purchase->fresh()->status);
        $this->assertSame($receipt, $purchase->fresh()->receipt_id);
    }
}
