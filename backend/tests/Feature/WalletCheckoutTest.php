<?php

namespace Tests\Feature;

use App\Models\Chapter;
use App\Models\Coupon;
use App\Models\DiscountRule;
use App\Models\Purchase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Wallet and free checkouts settle immediately, so the balance check, the debit,
 * the access grant and the coupon claim must be one locked unit. These tests cover
 * the observable outcomes (no double debit, no double grant, atomic coupon use).
 */
class WalletCheckoutTest extends TestCase
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
        Chapter::create(['id' => 'ch-wallet', 'index' => 2, 'title' => 'فصل کیف پول', 'price' => 100000, 'free' => false]);
    }

    private function user(int $balance): User
    {
        return User::create([
            'id' => (string) Str::uuid(),
            'name' => 'کاربر تست',
            'phone' => '0912'.str_pad((string) mt_rand(0, 99999999), 8, '0', STR_PAD_LEFT),
            'wallet_balance' => $balance,
        ]);
    }

    private function walletBuy(User $user, ?string $coupon = null)
    {
        Sanctum::actingAs($user);

        return $this->postJson('/api/v1/checkout', array_filter([
            'chapterId' => 'ch-wallet',
            'paymentMethod' => 'wallet',
            'couponCode' => $coupon,
        ]));
    }

    public function test_wallet_purchase_debits_once_and_grants_access(): void
    {
        $user = $this->user(200000);

        $this->walletBuy($user)->assertOk()->assertJsonPath('walletPaid', true);

        $this->assertSame(100000, (int) $user->fresh()->wallet_balance);
        $this->assertSame(1, Purchase::where('user_id', $user->id)->where('status', 'paid')->count());
    }

    public function test_second_wallet_purchase_of_the_same_chapter_is_rejected_without_a_second_debit(): void
    {
        $user = $this->user(500000);

        $this->walletBuy($user)->assertOk();
        $this->walletBuy($user)->assertStatus(409);

        $this->assertSame(400000, (int) $user->fresh()->wallet_balance);
        $this->assertSame(1, Purchase::where('user_id', $user->id)->where('status', 'paid')->count());
    }

    public function test_insufficient_balance_does_not_debit_or_grant(): void
    {
        $user = $this->user(99999);

        $this->walletBuy($user)->assertStatus(422);

        $this->assertSame(99999, (int) $user->fresh()->wallet_balance);
        $this->assertSame(0, Purchase::where('user_id', $user->id)->count());
    }

    public function test_last_coupon_use_is_claimed_by_one_buyer_only(): void
    {
        Coupon::create(['code' => 'LASTONE', 'percent' => 50, 'max_uses' => 1, 'used_count' => 0, 'active' => true]);
        $first = $this->user(1_000_000);
        $second = $this->user(1_000_000);

        $this->walletBuy($first, 'LASTONE')->assertOk();
        $this->assertSame(950000, (int) $first->fresh()->wallet_balance);
        $this->assertSame(1, (int) Coupon::where('code', 'LASTONE')->value('used_count'));

        // The coupon is used up: the second buyer pays full price, not the discount.
        $this->walletBuy($second, 'LASTONE')->assertOk();
        $this->assertSame(900000, (int) $second->fresh()->wallet_balance);
        $this->assertSame(1, (int) Coupon::where('code', 'LASTONE')->value('used_count'));
    }

    public function test_coupon_redeem_never_exceeds_max_uses(): void
    {
        Coupon::create(['code' => 'TWICE', 'percent' => 10, 'max_uses' => 2, 'used_count' => 0, 'active' => true]);

        $this->assertTrue(Coupon::redeem('TWICE'));
        $this->assertTrue(Coupon::redeem('TWICE'));
        $this->assertFalse(Coupon::redeem('TWICE'));
        $this->assertSame(2, (int) Coupon::where('code', 'TWICE')->value('used_count'));
    }

    public function test_coupon_redeem_respects_active_and_expiry(): void
    {
        Coupon::create(['code' => 'OFF', 'percent' => 10, 'max_uses' => null, 'used_count' => 0, 'active' => false]);
        Coupon::create(['code' => 'OLD', 'percent' => 10, 'max_uses' => null, 'used_count' => 0, 'active' => true, 'expires_at' => now()->subDay()]);

        $this->assertFalse(Coupon::redeem('OFF'));
        $this->assertFalse(Coupon::redeem('OLD'));
        $this->assertFalse(Coupon::redeem('UNKNOWN'));
    }
}
