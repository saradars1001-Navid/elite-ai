<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserNotification;
use App\Models\WalletTransaction;
use App\Services\PaymentGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Wallet-charge refund through the server-to-server webhook: when the gateway
 * announces a refund for 'wallet-{id}', the handler deducts the charged amount
 * from the user's balance, rewrites the ledger transaction (status + balance_after),
 * and notifies the user — all idempotently. A stub gateway is bound in place of
 * IDPay because IDPay's parseWebhook only emits 'payment' notifications.
 */
class WalletRefundTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->app->instance(PaymentGateway::class, new class implements PaymentGateway
        {
            public function initiate(int $amountToman, string $description, string $callbackUrl, string $referenceId): array
            {
                return ['url' => 'https://gateway.test/pay', 'ref' => 'GATE-1'];
            }

            public function verify(string $authority, int $amountToman, ?string $orderId = null): array
            {
                return ['ok' => false, 'ref' => null];
            }

            public function refund(string $authority, int $amountToman): array
            {
                return ['ok' => true, 'ref' => 'REF-1'];
            }

            public function verifyFromCallback(Request $request): array
            {
                return ['ok' => false, 'authority' => '', 'ref' => null];
            }

            /** Emits a refund notification referencing 'wallet-{id}' — the case IDPay itself never sends. */
            public function parseWebhook(Request $request): array
            {
                $body = $request->isJson() ? ($request->json()->all() ?? []) : $request->all();
                $body = is_array($body) ? $body : [];

                return [
                    'supported' => true,
                    'type' => 'refund',
                    'status' => 'refunded',
                    'referenceId' => (string) ($body['order_id'] ?? ''),
                    'authority' => (string) ($body['id'] ?? ''),
                    'ref' => (string) ($body['track_id'] ?? '') ?: null,
                ];
            }

            public function verifyWebhookSignature(Request $request): bool
            {
                return true;
            }
        });

        // Refund notifications change money state, so they are only accepted from
        // an authenticated delivery (shared secret). Send it on every request.
        config(['payment.webhook_secret' => 'test-secret']);
        $this->withHeaders(['X-Webhook-Secret' => 'test-secret']);
    }

    private function user(int $balance = 500000): User
    {
        return User::create([
            'id' => (string) Str::uuid(),
            'name' => 'کاربر تست',
            'phone' => '0912'.random_int(1000000, 9999999),
            'wallet_balance' => $balance,
        ]);
    }

    private function completedCharge(User $user, int $amount = 200000): WalletTransaction
    {
        return WalletTransaction::create([
            'user_id' => $user->id,
            'type' => 'charge',
            'amount' => $amount,
            'balance_after' => $amount,
            'status' => 'completed',
            'gateway_ref' => 'GATE-CHARGE-1',
            'description' => 'شارژ کیف پول',
        ]);
    }

    private function refundPayload(WalletTransaction $tx, string $id): array
    {
        return [
            'id' => $id,
            'order_id' => 'wallet-'.$tx->id,
            'track_id' => 'track-'.$id,
            'status' => 3,
        ];
    }

    public function test_wallet_refund_webhook_deducts_balance_and_rewrites_ledger(): void
    {
        $user = $this->user(500000);
        $tx = $this->completedCharge($user, 200000);

        $this->postJson('/api/v1/payment/webhook', $this->refundPayload($tx, 'refund-1'))
            ->assertOk()
            ->assertJson(['ok' => true, 'wallet_refunded' => true]);

        // Balance: 500,000 charged → 200,000 refunded = 300,000.
        $this->assertSame(300000, (int) $user->fresh()->wallet_balance);

        $tx->refresh();
        $this->assertSame('failed', $tx->status);
        $this->assertSame(300000, (int) $tx->balance_after);
        $this->assertStringContainsString('بازگشت وجه', (string) $tx->description);

        // The user was notified about the refund.
        $notification = UserNotification::first();
        $this->assertNotNull($notification);
        $this->assertSame($user->id, $notification->user_id);
        $this->assertSame('payment', $notification->type);
        $this->assertSame('بازگشت وجه کیف پول', $notification->title);
        $this->assertSame(['link' => '/profile'], $notification->data);
    }

    public function test_replayed_wallet_refund_webhook_is_idempotent(): void
    {
        $user = $this->user(500000);
        $tx = $this->completedCharge($user, 200000);
        $payload = $this->refundPayload($tx, 'refund-2');

        $this->postJson('/api/v1/payment/webhook', $payload)->assertOk();
        $this->assertSame(300000, (int) $user->fresh()->wallet_balance);
        $this->assertSame(1, UserNotification::count());

        // A replayed delivery must not deduct the balance a second time.
        $this->postJson('/api/v1/payment/webhook', $payload)
            ->assertOk()
            ->assertJson(['ok' => true, 'idempotent' => true]);

        $this->assertSame(300000, (int) $user->fresh()->wallet_balance);
        $this->assertSame('failed', $tx->fresh()->status);
        $this->assertSame(1, UserNotification::count());
    }

    public function test_wallet_refund_never_drives_balance_negative(): void
    {
        // The charged 200,000 was already spent — only 100,000 is left. The
        // refund must clamp the balance at zero, never go negative.
        $user = $this->user(100000);
        $tx = $this->completedCharge($user, 200000);

        $this->postJson('/api/v1/payment/webhook', $this->refundPayload($tx, 'refund-3'))
            ->assertOk()
            ->assertJson(['ok' => true, 'wallet_refunded' => true]);

        $this->assertSame(0, (int) $user->fresh()->wallet_balance);
        $this->assertSame(0, (int) $tx->fresh()->balance_after);
    }

    public function test_refund_for_unknown_wallet_reference_returns_404(): void
    {
        $this->postJson('/api/v1/payment/webhook', [
            'id' => 'pay-x',
            'order_id' => 'wallet-999999',
            'track_id' => 'track-x',
            'status' => 3,
        ])->assertStatus(404)
            ->assertJson(['error' => 'reference_not_found']);
    }
}
