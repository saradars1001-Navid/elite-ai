<?php

namespace Tests\Feature;

use App\Models\Chapter;
use App\Models\Coupon;
use App\Models\DiscountRule;
use App\Models\Purchase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Server-side pricing is the single source of truth: the client never sends a
 * price, so every discount must be recomputed and verified on the server. These
 * tests exercise the full checkout flow and assert the exact final price stored
 * on the purchase, the wallet deduction, and the discount labels.
 *
 * Tiers (seeded DiscountRule): >=90 → 30%, >=80 → 20%, >=70 → 10%.
 */
class PricingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        DiscountRule::updateOrCreate(['id' => 1], [
            'name' => 'پیش‌فرض',
            'high_min' => 90, 'high_percent' => 30,
            'mid_min' => 80, 'mid_percent' => 20,
            'low_min' => 70, 'low_percent' => 10,
        ]);
    }

    private function user(int $balance = 1_000_000): User
    {
        return User::create([
            'id' => (string) Str::uuid(),
            'name' => 'کاربر تست',
            'phone' => '0912'.str_pad((string) mt_rand(0, 99999999), 8, '0', STR_PAD_LEFT),
            'wallet_balance' => $balance,
        ]);
    }

    private function chapter(string $id, int $index, int $price): Chapter
    {
        return Chapter::create([
            'id' => $id,
            'index' => $index,
            'title' => 'فصل '.$index,
            'price' => $price,
            'free' => false,
        ]);
    }

    private function coupon(string $code, int $percent, ?int $maxUses = 500, bool $active = true, ?string $expiresAt = null): Coupon
    {
        return Coupon::create([
            'code' => $code,
            'percent' => $percent,
            'max_uses' => $maxUses,
            'active' => $active,
            'expires_at' => $expiresAt,
        ]);
    }

    private function exam(string $userId, string $chapterId, int $score): void
    {
        DB::table('exam_attempts')->insert([
            'user_id' => $userId,
            'chapter_id' => $chapterId,
            'score' => $score,
            'correct' => 0,
            'wrong' => 0,
            'passed' => $score >= 70,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /** Buy with wallet balance and return the created purchase. */
    private function buy(User $user, string $chapterId, ?string $couponCode = null, string $method = 'wallet'): Purchase
    {
        Sanctum::actingAs($user);
        $response = $this->postJson('/api/v1/checkout', [
            'chapterId' => $chapterId,
            'couponCode' => $couponCode,
            'paymentMethod' => $method,
        ]);
        $response->assertOk()->assertJson(['walletPaid' => true]);

        return Purchase::where('user_id', $user->id)->where('chapter_id', $chapterId)->firstOrFail();
    }

    public function test_base_price_without_discounts(): void
    {
        $user = $this->user();
        $this->chapter('ch1', 1, 100000);

        $purchase = $this->buy($user, 'ch1');

        $this->assertSame(100000, (int) $purchase->price);
        $this->assertSame(100000, (int) $purchase->base_price);
        $this->assertNull($purchase->discount_label);
        $this->assertNull($purchase->coupon_code);
        $this->assertSame(900000, (int) $user->fresh()->wallet_balance);
    }

    public function test_coupon_reduces_final_price_server_side(): void
    {
        $this->coupon('ELITE10', 10);
        $user = $this->user();
        $this->chapter('ch-c', 1, 100000);

        $purchase = $this->buy($user, 'ch-c', 'ELITE10');

        $this->assertSame(90000, (int) $purchase->price);
        $this->assertSame(100000, (int) $purchase->base_price);
        $this->assertSame('ELITE10', $purchase->coupon_code);
        $this->assertStringContainsString('٪10', (string) $purchase->discount_label);
        $this->assertSame(910000, (int) $user->fresh()->wallet_balance);

        // A redeemed coupon must count toward its max_uses (wallet flow too).
        $this->assertSame(1, (int) Coupon::where('code', 'ELITE10')->first()->used_count);
    }

    public function test_performance_discount_from_previous_exam(): void
    {
        $user = $this->user();
        $this->chapter('ch1', 1, 100000);
        $this->chapter('ch2', 2, 200000);
        // Best score 95 on chapter 1 → 30% off chapter 2.
        $this->exam($user->id, 'ch1', 95);

        $purchase = $this->buy($user, 'ch2');

        $this->assertSame(140000, (int) $purchase->price);
        $this->assertSame(200000, (int) $purchase->base_price);
        $this->assertStringContainsString('٪30', (string) $purchase->discount_label);
        $this->assertStringContainsString('عملکردی', (string) $purchase->discount_label);
        $this->assertSame(860000, (int) $user->fresh()->wallet_balance);
    }

    public function test_performance_uses_best_score_only(): void
    {
        $user = $this->user();
        $this->chapter('ch1', 1, 100000);
        $this->chapter('ch2', 2, 200000);
        $this->exam($user->id, 'ch1', 55);   // no tier
        $this->exam($user->id, 'ch1', 92);   // high tier (30%)

        $purchase = $this->buy($user, 'ch2');

        $this->assertSame(140000, (int) $purchase->price);
    }

    public function test_no_exam_on_previous_chapter_means_no_discount(): void
    {
        $user = $this->user();
        $this->chapter('ch1', 1, 100000);
        $this->chapter('ch2', 2, 200000);
        // No exam attempt at all.

        $purchase = $this->buy($user, 'ch2');

        $this->assertSame(200000, (int) $purchase->price);
        $this->assertNull($purchase->discount_label);
    }

    public function test_performance_and_coupon_stack_together(): void
    {
        $this->coupon('ELITE10', 10);
        $user = $this->user();
        $this->chapter('ch1', 1, 100000);
        $this->chapter('ch2', 2, 200000);
        $this->exam($user->id, 'ch1', 85); // mid tier → 20%

        // 20% + 10% = 30% → 200000 * 0.7 = 140000
        $purchase = $this->buy($user, 'ch2', 'ELITE10');

        $this->assertSame(140000, (int) $purchase->price);
        $this->assertStringContainsString('٪20', (string) $purchase->discount_label);
        $this->assertStringContainsString('٪10', (string) $purchase->discount_label);
    }

    public function test_expired_coupon_is_ignored(): void
    {
        $this->coupon('OLD', 50, 500, true, now()->subDay()->toDateTimeString());
        $user = $this->user();
        $this->chapter('ch-x', 1, 100000);

        $purchase = $this->buy($user, 'ch-x', 'OLD');

        $this->assertSame(100000, (int) $purchase->price);
        $this->assertNull($purchase->coupon_code);
        $this->assertSame(0, (int) Coupon::where('code', 'OLD')->first()->used_count);
    }

    public function test_exhausted_coupon_is_ignored_on_second_use(): void
    {
        $this->coupon('ONCE', 25, 1); // max_uses = 1
        $user = $this->user();
        $this->chapter('ch-a', 1, 100000);
        $this->chapter('ch-b', 2, 100000);

        // First purchase: coupon is valid → 25% off.
        $first = $this->buy($user, 'ch-a', 'ONCE');
        $this->assertSame(75000, (int) $first->price);

        // Second purchase: coupon exhausted → full price, no label.
        $second = $this->buy($user, 'ch-b', 'ONCE');
        $this->assertSame(100000, (int) $second->price);
        $this->assertNull($second->coupon_code);
    }

    public function test_unknown_coupon_code_is_ignored(): void
    {
        $user = $this->user();
        $this->chapter('ch-u', 1, 100000);

        $purchase = $this->buy($user, 'ch-u', 'NOT-A-CODE');

        $this->assertSame(100000, (int) $purchase->price);
        $this->assertNull($purchase->coupon_code);
    }

    public function test_hundred_percent_discount_grants_free_access_without_gateway(): void
    {
        $this->coupon('ELITE70', 70);
        $user = $this->user();
        $this->chapter('ch1', 1, 100000);
        $this->chapter('ch2', 2, 200000);
        $this->exam($user->id, 'ch1', 95); // 30%

        Http::fake();

        Sanctum::actingAs($user);
        $response = $this->postJson('/api/v1/checkout', [
            'chapterId' => 'ch2',
            'couponCode' => 'ELITE70',
        ]);

        $response->assertOk()->assertJson(['amount' => 0, 'checkoutUrl' => null]);

        Http::assertNothingSent();
        $purchase = Purchase::where('user_id', $user->id)->where('chapter_id', 'ch2')->firstOrFail();
        $this->assertSame(0, (int) $purchase->price);
        $this->assertSame('paid', $purchase->status);
        $this->assertStringStartsWith('FREE-', $purchase->receipt_id);
        // No wallet deduction for a free order.
        $this->assertSame(1000000, (int) $user->fresh()->wallet_balance);
        $this->assertSame(1, (int) Coupon::where('code', 'ELITE70')->first()->used_count);
    }

    /* ─────────────────── client price tampering (security) ─────────────────── */

    public function test_forged_client_price_is_ignored_in_wallet_flow(): void
    {
        $user = $this->user();
        $this->chapter('ch-secure', 1, 100000);
        Sanctum::actingAs($user);

        // A malicious client tries to buy the chapter for 1 toman. The
        // `price`/`finalPrice`/`amount` fields are not part of the validated
        // payload, so they must be stripped and the server price used instead.
        $response = $this->postJson('/api/v1/checkout', [
            'chapterId' => 'ch-secure',
            'paymentMethod' => 'wallet',
            'price' => 1,
            'finalPrice' => 1,
            'amount' => 1,
        ]);

        $response->assertOk()->assertJson(['walletPaid' => true]);

        $purchase = Purchase::where('user_id', $user->id)->where('chapter_id', 'ch-secure')->firstOrFail();
        $this->assertSame(100000, (int) $purchase->price);
        $this->assertSame(100000, (int) $purchase->base_price);
        // The wallet was deducted the real price, not the forged 1 toman.
        $this->assertSame(900000, (int) $user->fresh()->wallet_balance);
    }

    public function test_forged_zero_price_cannot_make_order_free_in_gateway_flow(): void
    {
        $user = $this->user();
        $this->chapter('ch-gw-secure', 1, 100000);
        Sanctum::actingAs($user);

        // Attempting to pass price=0 must NOT trigger the free-access path;
        // the gateway must still be initiated for the server-computed amount.
        Http::fake([
            '*/pg/v4/payment/request.json' => Http::response([
                'data' => ['code' => 100, 'authority' => 'AUTH-SECURE'],
            ], 200),
        ]);

        $response = $this->postJson('/api/v1/checkout', [
            'chapterId' => 'ch-gw-secure',
            'paymentMethod' => 'gateway',
            'price' => 0,
            'finalPrice' => 0,
        ]);

        $response->assertOk()->assertJson(['amount' => 100000]);

        $purchase = Purchase::where('user_id', $user->id)->where('chapter_id', 'ch-gw-secure')->firstOrFail();
        $this->assertSame(100000, (int) $purchase->price);
        $this->assertSame('pending', $purchase->status); // went to the gateway, not granted free
        $this->assertStringStartsWith('ORD-', $purchase->receipt_id); // placeholder until verified
    }

    public function test_forged_price_is_ignored_when_coupon_applied(): void
    {
        $this->coupon('ELITE10', 10);
        $user = $this->user();
        $this->chapter('ch-c-secure', 1, 100000);
        Sanctum::actingAs($user);

        Http::fake([
            '*/pg/v4/payment/request.json' => Http::response([
                'data' => ['code' => 100, 'authority' => 'AUTH-SECURE-2'],
            ], 200),
        ]);

        $response = $this->postJson('/api/v1/checkout', [
            'chapterId' => 'ch-c-secure',
            'couponCode' => 'ELITE10',
            'paymentMethod' => 'gateway',
            'price' => 1,
        ]);

        // Server recomputes 10% off the base price; the forged price is dropped.
        $response->assertOk()->assertJson(['amount' => 90000]);

        $purchase = Purchase::where('user_id', $user->id)->where('chapter_id', 'ch-c-secure')->firstOrFail();
        $this->assertSame(90000, (int) $purchase->price);
        $this->assertSame(100000, (int) $purchase->base_price);
    }
}
