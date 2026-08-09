<?php

namespace Tests\Feature;

use App\Models\Chapter;
use App\Models\Purchase;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Services\IDPayGateway;
use App\Services\PaymentGateway;
use App\Services\ZarinpalGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * End-to-end payment flow tests:
 *  - gateway redirect callbacks (Zarinpal + IDPay) — success and failure
 *  - wallet charge initiation + callback credit
 *  - chapter purchase with wallet balance (success + insufficient balance)
 *
 * The gateway's HTTP calls are faked with Http::fake; the server-side verify
 * step is what decides paid/failed, never the callback query params alone.
 */
class PaymentFlowTest extends TestCase
{
    use RefreshDatabase;

    private const FRONTEND = 'https://app.example.test';

    private function user(array $overrides = []): User
    {
        return User::create(array_merge([
            'id' => (string) Str::uuid(),
            'name' => 'کاربر تست',
            'phone' => '09120000001',
            'wallet_balance' => 0,
        ], $overrides));
    }

    private function chapter(string $id = 'ch-pay', int $price = 50000): Chapter
    {
        return Chapter::create([
            'id' => $id,
            'index' => 1,
            'title' => 'فصل پرداخت تست',
            'price' => $price,
            'free' => false,
        ]);
    }

    private function pendingPurchase(User $user, Chapter $chapter, int $price = 50000): Purchase
    {
        return Purchase::create([
            'checkout_id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'chapter_id' => $chapter->id,
            'price' => $price,
            'base_price' => $price,
            'receipt_id' => 'TMP-'.Str::upper(Str::random(6)),
            'status' => 'pending',
        ]);
    }

    /* ─────────────────────────── Zarinpal callback ─────────────────────────── */

    public function test_zarinpal_callback_verifies_and_grants_access(): void
    {
        // The default gateway bound by PaymentService is Zarinpal.
        $this->assertInstanceOf(ZarinpalGateway::class, app(PaymentGateway::class));

        $user = $this->user();
        $chapter = $this->chapter();
        $purchase = $this->pendingPurchase($user, $chapter);

        // Fake the Zarinpal v4 verify API: code 100 = paid, with a ref_id.
        Http::fake([
            '*/pg/v4/payment/verify.json' => Http::response([
                'data' => ['code' => 100, 'ref_id' => 'REF-ZARINPAL-1'],
            ], 200),
        ]);

        $this->get('/api/v1/payment/callback?purchase='.$purchase->id.'&Status=OK&Authority=AUTH-123')
            ->assertRedirect(self::FRONTEND.'/payment?status=success&purchase='.$purchase->id);

        $this->assertSame('paid', $purchase->fresh()->status);
        $this->assertSame('REF-ZARINPAL-1', $purchase->fresh()->gateway_ref);
        $this->assertStringStartsWith('REC-', $purchase->fresh()->receipt_id);

        // A replayed redirect must be idempotent — no double processing.
        $this->get('/api/v1/payment/callback?purchase='.$purchase->id.'&Status=OK&Authority=AUTH-123')
            ->assertRedirect(self::FRONTEND.'/payment?status=success&purchase='.$purchase->id);
        $this->assertSame('paid', $purchase->fresh()->status);
    }

    public function test_zarinpal_callback_marks_failed_when_verify_api_rejects(): void
    {
        $user = $this->user();
        $chapter = $this->chapter();
        $purchase = $this->pendingPurchase($user, $chapter);

        // Verify API says the authority was never paid (code != 100).
        Http::fake([
            '*/pg/v4/payment/verify.json' => Http::response([
                'data' => ['code' => 101, 'ref_id' => null],
            ], 200),
        ]);

        $this->get('/api/v1/payment/callback?purchase='.$purchase->id.'&Status=OK&Authority=AUTH-FAKE')
            ->assertRedirect(self::FRONTEND.'/payment?status=failed&purchase='.$purchase->id);

        $this->assertSame('failed', $purchase->fresh()->status);
    }

    public function test_zarinpal_callback_cancelled_redirect_never_calls_verify(): void
    {
        $user = $this->user();
        $purchase = $this->pendingPurchase($user, $this->chapter());

        // Status != OK: the buyer cancelled — no gateway call may be made.
        Http::fake();

        $this->get('/api/v1/payment/callback?purchase='.$purchase->id.'&Status=NOK')
            ->assertRedirect(self::FRONTEND.'/payment?status=failed&purchase='.$purchase->id);

        Http::assertNothingSent();
        $this->assertSame('failed', $purchase->fresh()->status);
    }

    /* ──────────────────────────── IDPay callback ──────────────────────────── */

    public function test_idpay_callback_verifies_purchase(): void
    {
        $this->app->instance(PaymentGateway::class, new IDPayGateway);
        $user = $this->user();
        $chapter = $this->chapter();
        $purchase = $this->pendingPurchase($user, $chapter);

        Http::fake([
            'api.idpay.ir/*' => Http::response(['status' => 100, 'track_id' => 'TRACK-PUR-1'], 200),
        ]);

        $this->get('/api/v1/payment/callback?purchase='.$purchase->id.'&id=pay-9&track_id=TRACK-PUR-1&status=1')
            ->assertRedirect(self::FRONTEND.'/payment?status=success&purchase='.$purchase->id);

        $this->assertSame('paid', $purchase->fresh()->status);
        $this->assertSame('TRACK-PUR-1', $purchase->fresh()->gateway_ref);
    }

    public function test_idpay_callback_marks_failed_when_verify_rejects(): void
    {
        $this->app->instance(PaymentGateway::class, new IDPayGateway);
        $user = $this->user();
        $purchase = $this->pendingPurchase($user, $this->chapter());

        // Verify API returns status 2 (failed) although the redirect said status=1.
        Http::fake([
            'api.idpay.ir/*' => Http::response(['status' => 2, 'track_id' => null], 200),
        ]);

        $this->get('/api/v1/payment/callback?purchase='.$purchase->id.'&id=pay-10&track_id=TRACK-X&status=1')
            ->assertRedirect(self::FRONTEND.'/payment?status=failed&purchase='.$purchase->id);

        $this->assertSame('failed', $purchase->fresh()->status);
    }

    /* ─────────────────────────── Wallet charging ──────────────────────────── */

    public function test_wallet_charge_opens_gateway_with_pending_transaction(): void
    {
        $user = $this->user();
        Sanctum::actingAs($user);

        Http::fake([
            '*/pg/v4/payment/request.json' => Http::response([
                'data' => ['code' => 100, 'authority' => 'AUTH-CHARGE-1'],
            ], 200),
        ]);

        $response = $this->postJson('/api/v1/wallet/charge', ['amount' => 200000])
            ->assertOk()
            ->assertJson(['amount' => 200000])
            ->assertJsonStructure(['transactionId', 'checkoutUrl']);

        $tx = WalletTransaction::first();
        $this->assertNotNull($tx);
        $this->assertSame('pending', $tx->status);
        $this->assertSame(200000, (int) $tx->amount);
        $this->assertSame('AUTH-CHARGE-1', $tx->gateway_ref);
        $this->assertStringContainsString('AUTH-CHARGE-1', $response->json('checkoutUrl'));
        $this->assertSame(0, (int) $user->fresh()->wallet_balance);
    }

    public function test_idpay_wallet_charge_callback_credits_balance(): void
    {
        $this->app->instance(PaymentGateway::class, new IDPayGateway);
        $user = $this->user(['wallet_balance' => 1000]);

        $tx = WalletTransaction::create([
            'user_id' => $user->id,
            'type' => 'charge',
            'amount' => 200000,
            'balance_after' => 1000,
            'status' => 'pending',
            'description' => 'شارژ کیف پول',
        ]);

        Http::fake([
            'api.idpay.ir/*' => Http::response(['status' => 100, 'track_id' => 'TRACK-W-1'], 200),
        ]);

        $this->get('/api/v1/wallet/callback?tx='.$tx->id.'&id=pay-20&track_id=TRACK-W-1&status=1')
            ->assertRedirect(self::FRONTEND.'/profile?wallet=success');

        $this->assertSame(201000, (int) $user->fresh()->wallet_balance);
        $tx->refresh();
        $this->assertSame('completed', $tx->status);
        $this->assertSame(201000, (int) $tx->balance_after);
        $this->assertSame('TRACK-W-1', $tx->gateway_ref);
    }

    public function test_replayed_wallet_callback_does_not_double_credit(): void
    {
        $this->app->instance(PaymentGateway::class, new IDPayGateway);
        $user = $this->user(['wallet_balance' => 0]);

        $tx = WalletTransaction::create([
            'user_id' => $user->id,
            'type' => 'charge',
            'amount' => 100000,
            'balance_after' => 0,
            'status' => 'pending',
            'description' => 'شارژ کیف پول',
        ]);

        Http::fake([
            'api.idpay.ir/*' => Http::response(['status' => 100, 'track_id' => 'TRACK-W-2'], 200),
        ]);

        $url = '/api/v1/wallet/callback?tx='.$tx->id.'&id=pay-21&track_id=TRACK-W-2&status=1';

        $this->get($url)->assertRedirect(self::FRONTEND.'/profile?wallet=success');
        $this->assertSame(100000, (int) $user->fresh()->wallet_balance);

        // Replay: the transaction is no longer pending — balance must not change.
        $this->get($url)->assertRedirect(self::FRONTEND.'/profile?wallet=failed');
        $this->assertSame(100000, (int) $user->fresh()->wallet_balance);
        $this->assertSame('completed', $tx->fresh()->status);
    }

    public function test_wallet_charge_callback_marks_failed_when_verify_rejects(): void
    {
        $this->app->instance(PaymentGateway::class, new IDPayGateway);
        $user = $this->user(['wallet_balance' => 1000]);

        $tx = WalletTransaction::create([
            'user_id' => $user->id,
            'type' => 'charge',
            'amount' => 50000,
            'balance_after' => 1000,
            'status' => 'pending',
            'description' => 'شارژ کیف پول',
        ]);

        Http::fake([
            'api.idpay.ir/*' => Http::response(['status' => 2, 'track_id' => null], 200),
        ]);

        $this->get('/api/v1/wallet/callback?tx='.$tx->id.'&id=pay-22&track_id=TRACK-X&status=1')
            ->assertRedirect(self::FRONTEND.'/profile?wallet=failed');

        $this->assertSame(1000, (int) $user->fresh()->wallet_balance);
        $this->assertSame('failed', $tx->fresh()->status);
    }

    /* ─────────────────── Purchase with wallet balance ─────────────────────── */

    public function test_wallet_purchase_deducts_balance_and_writes_ledger(): void
    {
        $user = $this->user(['wallet_balance' => 200000]);
        $chapter = $this->chapter('ch-wallet', 50000);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/checkout', [
            'chapterId' => $chapter->id,
            'paymentMethod' => 'wallet',
        ])->assertOk()
            ->assertJson(['walletPaid' => true, 'amount' => 0, 'checkoutUrl' => null]);

        $this->assertSame(150000, (int) $user->fresh()->wallet_balance);

        $purchase = Purchase::first();
        $this->assertNotNull($purchase);
        $this->assertSame('paid', $purchase->status);
        $this->assertStringStartsWith('WLT-', $purchase->receipt_id);

        $ledger = WalletTransaction::where('type', 'purchase')->first();
        $this->assertNotNull($ledger);
        $this->assertSame(50000, (int) $ledger->amount);
        $this->assertSame(150000, (int) $ledger->balance_after);
        $this->assertSame('completed', $ledger->status);
    }

    public function test_wallet_purchase_rejected_when_balance_is_insufficient(): void
    {
        $user = $this->user(['wallet_balance' => 10000]);
        $chapter = $this->chapter('ch-poor', 50000);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/checkout', [
            'chapterId' => $chapter->id,
            'paymentMethod' => 'wallet',
        ])->assertStatus(422)
            ->assertJson(['message' => 'موجودی کیف پول کافی نیست. لطفاً ابتدا کیف پول را شارژ کنید.']);

        // Nothing may change: no purchase, no deduction, no ledger row.
        $this->assertSame(10000, (int) $user->fresh()->wallet_balance);
        $this->assertSame(0, Purchase::count());
        $this->assertSame(0, WalletTransaction::count());
    }

    public function test_wallet_purchase_with_exact_balance_succeeds(): void
    {
        $user = $this->user(['wallet_balance' => 50000]);
        $chapter = $this->chapter('ch-exact', 50000);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/checkout', [
            'chapterId' => $chapter->id,
            'paymentMethod' => 'wallet',
        ])->assertOk()->assertJson(['walletPaid' => true]);

        $this->assertSame(0, (int) $user->fresh()->wallet_balance);
        $this->assertSame(1, Purchase::where('chapter_id', $chapter->id)->where('status', 'paid')->count());
    }
}
