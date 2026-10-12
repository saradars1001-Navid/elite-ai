<?php

namespace Tests\Feature;

use App\Models\Chapter;
use App\Models\Purchase;
use App\Models\User;
use App\Services\PaymentGateway;
use App\Services\ZarinpalGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Gateway refunds must use the authority the order was opened with, never the bank
 * reference (ref_id/track_id) that is stored after a successful payment.
 */
class GatewayRefundAuthorityTest extends TestCase
{
    use RefreshDatabase;

    public function test_zarinpal_refund_is_sent_with_the_authority_not_the_bank_ref(): void
    {
        config(['services.zarinpal.merchant_id' => 'merchant-test', 'services.zarinpal.sandbox' => true]);
        $this->app->instance(PaymentGateway::class, new ZarinpalGateway);
        Http::fake(['*refund.json' => Http::response(['data' => ['code' => 100, 'ref_id' => 'REF-9']], 200)]);

        $admin = User::create(['id' => (string) Str::uuid(), 'name' => 'مدیر', 'phone' => '09120000001', 'role' => 'admin']);
        $buyer = User::create(['id' => (string) Str::uuid(), 'name' => 'خریدار', 'phone' => '09120000002']);
        Chapter::create(['id' => 'ch-zp', 'index' => 1, 'title' => 'فصل زرین', 'price' => 50000, 'free' => false]);
        $purchase = Purchase::create([
            'checkout_id' => (string) Str::uuid(), 'user_id' => $buyer->id, 'chapter_id' => 'ch-zp',
            'price' => 50000, 'base_price' => 50000, 'receipt_id' => 'REC-ZP', 'status' => 'paid',
            'gateway_authority' => 'A0000AUTHORITY', 'gateway_ref' => 'BANK-REF-123',
        ]);
        Sanctum::actingAs($admin);

        $this->postJson("/api/v1/checkout/{$purchase->id}/refund")->assertOk()->assertJsonPath('purchase.status', 'refunded');

        Http::assertSent(fn ($request) => str_ends_with($request->url(), 'refund.json')
            && $request['authority'] === 'A0000AUTHORITY'
            && $request['authority'] !== 'BANK-REF-123');
    }

    public function test_refused_gateway_refund_leaves_the_order_paid_and_points_to_manual_refund(): void
    {
        config(['services.zarinpal.merchant_id' => 'merchant-test', 'services.zarinpal.sandbox' => true]);
        $this->app->instance(PaymentGateway::class, new ZarinpalGateway);
        Http::fake(['*refund.json' => Http::response(['data' => ['code' => -9]], 200)]);

        $admin = User::create(['id' => (string) Str::uuid(), 'name' => 'مدیر', 'phone' => '09120000003', 'role' => 'admin']);
        $buyer = User::create(['id' => (string) Str::uuid(), 'name' => 'خریدار', 'phone' => '09120000004']);
        Chapter::create(['id' => 'ch-zp2', 'index' => 1, 'title' => 'فصل', 'price' => 50000, 'free' => false]);
        $purchase = Purchase::create([
            'checkout_id' => (string) Str::uuid(), 'user_id' => $buyer->id, 'chapter_id' => 'ch-zp2',
            'price' => 50000, 'base_price' => 50000, 'receipt_id' => 'REC-ZP2', 'status' => 'paid',
            'gateway_authority' => 'A0000AUTH2', 'gateway_ref' => 'BANK-REF-2',
        ]);
        Sanctum::actingAs($admin);

        $this->postJson("/api/v1/checkout/{$purchase->id}/refund")
            ->assertStatus(502)
            ->assertJsonFragment(['message' => 'بازگشت وجه در درگاه ناموفق بود. مبلغ را بررسی کنید یا با «بازگشت دستی» ثبت کنید.']);
        $this->assertSame('paid', $purchase->fresh()->status);
    }
}
