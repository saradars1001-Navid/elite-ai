<?php

namespace Tests\Feature;

use App\Models\Chapter;
use App\Models\Purchase;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\IDPayGateway;
use App\Services\PaymentGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Admin refund flow (POST /checkout/{purchase}/refund):
 * only admins may refund, only paid purchases are refundable, a successful
 * gateway refund flips the order to refunded + notifies the user, and a
 * gateway failure leaves the order paid and returns 502.
 */
class RefundTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'user'): User
    {
        return User::create([
            'id' => (string) Str::uuid(),
            'name' => $role === 'admin' ? 'مدیر تست' : 'کاربر تست',
            'phone' => '0912'.str_pad((string) mt_rand(0, 99999999), 8, '0', STR_PAD_LEFT),
            'role' => $role,
            'wallet_balance' => 0,
        ]);
    }

    private function paidPurchase(User $user, ?string $gatewayRef = 'AUTH-REFUND-1'): Purchase
    {
        Chapter::create([
            'id' => 'ch-refund',
            'index' => 1,
            'title' => 'فصل بازگشت وجه',
            'price' => 50000,
            'free' => false,
        ]);

        return Purchase::create([
            'checkout_id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'chapter_id' => 'ch-refund',
            'price' => 50000,
            'base_price' => 50000,
            'receipt_id' => 'REC-'.Str::upper(Str::random(8)),
            'gateway_ref' => $gatewayRef,
            'status' => 'paid',
        ]);
    }

    /* ─────────────────────────── authorization ─────────────────────────── */

    public function test_non_admin_cannot_refund(): void
    {
        $user = $this->user('user');
        $purchase = $this->paidPurchase($user);
        Sanctum::actingAs($user);

        $this->postJson("/api/v1/checkout/{$purchase->id}/refund")->assertForbidden();
        $this->assertSame('paid', $purchase->fresh()->status);
    }

    public function test_pending_purchase_is_not_refundable(): void
    {
        $admin = $this->user('admin');
        $buyer = $this->user();
        Chapter::create([
            'id' => 'ch-pending',
            'index' => 1,
            'title' => 'فصل تست',
            'price' => 50000,
            'free' => false,
        ]);
        $purchase = Purchase::create([
            'checkout_id' => (string) Str::uuid(),
            'user_id' => $buyer->id,
            'chapter_id' => 'ch-pending',
            'price' => 50000,
            'base_price' => 50000,
            'receipt_id' => 'ORD-'.Str::upper(Str::random(8)),
            'status' => 'pending',
        ]);
        Sanctum::actingAs($admin);

        $this->postJson("/api/v1/checkout/{$purchase->id}/refund")
            ->assertStatus(422)
            ->assertJson(['message' => 'فقط خرید موفق قابل بازگشت است.']);
        $this->assertSame('pending', $purchase->fresh()->status);
    }

    public function test_already_refunded_purchase_is_rejected(): void
    {
        $admin = $this->user('admin');
        $buyer = $this->user();
        $purchase = $this->paidPurchase($buyer);
        $purchase->update(['status' => 'refunded', 'refunded_at' => now()]);
        Sanctum::actingAs($admin);

        $this->postJson("/api/v1/checkout/{$purchase->id}/refund")
            ->assertStatus(422)
            ->assertJson(['message' => 'این خرید قبلاً مسترد شده است.']);
    }

    /* ─────────────────────────── gateway outcomes ─────────────────────────── */

    public function test_refund_succeeds_when_gateway_accepts(): void
    {
        $admin = $this->user('admin');
        $buyer = $this->user();
        $purchase = $this->paidPurchase($buyer);
        Sanctum::actingAs($admin);

        // Zarinpal refund API: code 100 = accepted, returns a ref_id.
        Http::fake([
            '*/pg/v4/payment/refund.json' => Http::response([
                'data' => ['code' => 100, 'ref_id' => 'REF-OK-1'],
            ], 200),
        ]);

        $this->postJson("/api/v1/checkout/{$purchase->id}/refund")
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('purchase.status', 'refunded');

        $purchase->refresh();
        $this->assertSame('refunded', $purchase->status);
        $this->assertNotNull($purchase->refunded_at);

        // The buyer must receive an in-app refund notification.
        $notification = UserNotification::where('user_id', $buyer->id)->first();
        $this->assertNotNull($notification);
        $this->assertSame('بازگشت وجه', $notification->title);
        $this->assertStringContainsString('بازگشت وجه', (string) $notification->body);
    }

    public function test_refund_without_gateway_reference_succeeds_offline(): void
    {
        $admin = $this->user('admin');
        $buyer = $this->user();
        // Orders without a gateway ref (e.g. wallet purchases) are refunded
        // without calling the gateway at all.
        $purchase = $this->paidPurchase($buyer, null);
        Sanctum::actingAs($admin);

        Http::fake();

        $this->postJson("/api/v1/checkout/{$purchase->id}/refund")
            ->assertOk()
            ->assertJsonPath('purchase.status', 'refunded');

        Http::assertNothingSent();
        $this->assertSame('refunded', $purchase->fresh()->status);
    }

    public function test_refund_fails_when_gateway_rejects_and_order_stays_paid(): void
    {
        $admin = $this->user('admin');
        $buyer = $this->user();
        $purchase = $this->paidPurchase($buyer);
        Sanctum::actingAs($admin);

        // Zarinpal refund API rejects (code != 100).
        Http::fake([
            '*/pg/v4/payment/refund.json' => Http::response([
                'data' => ['code' => -11, 'ref_id' => null],
            ], 200),
        ]);

        $this->postJson("/api/v1/checkout/{$purchase->id}/refund")
            ->assertStatus(502)
            ->assertJson(['message' => 'بازگشت وجه در درگاه ناموفق بود. مبلغ را به‌صورت دستی بررسی کنید.']);

        $purchase->refresh();
        $this->assertSame('paid', $purchase->status);
        $this->assertNull($purchase->refunded_at);
        $this->assertSame(0, UserNotification::where('user_id', $buyer->id)->count());
    }

    public function test_refund_with_idpay_always_fails_and_prompts_manual_fallback(): void
    {
        // IDPay v1.1 exposes no public REST refund API — its refund() always
        // returns ok=false without any HTTP call, so the admin flow must fall
        // back to the manual-verification prompt and keep the order paid.
        $this->app->instance(PaymentGateway::class, new IDPayGateway);

        $admin = $this->user('admin');
        $buyer = $this->user();
        $purchase = $this->paidPurchase($buyer);
        Sanctum::actingAs($admin);

        Http::fake();

        $this->postJson("/api/v1/checkout/{$purchase->id}/refund")
            ->assertStatus(502)
            ->assertJson(['message' => 'بازگشت وجه در درگاه ناموفق بود. مبلغ را به‌صورت دستی بررسی کنید.']);

        // Unlike Zarinpal, IDPay's refund fails locally — no HTTP request is made.
        Http::assertNothingSent();

        $purchase->refresh();
        $this->assertSame('paid', $purchase->status);
        $this->assertNull($purchase->refunded_at);
        $this->assertSame(0, UserNotification::where('user_id', $buyer->id)->count());
    }
}
