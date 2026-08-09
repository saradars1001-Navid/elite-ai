<?php

namespace Tests\Feature;

use App\Models\Chapter;
use App\Models\Purchase;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * User-requested refund flow:
 *   POST /checkout/{purchase}/refund-request  — buyer asks for a refund
 *   GET  /admin/refunds                        — admin lists pending requests
 *   POST /admin/refunds/{purchase}/approve     — refund at gateway + close
 *   POST /admin/refunds/{purchase}/reject      — close request, keep access
 *
 * The pending state is derived from refund_requested_at (set) while
 * refund_rejected_at and refunded_at are null.
 */
class RefundRequestTest extends TestCase
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

    private function paidPurchase(User $user, ?string $gatewayRef = 'AUTH-REQ-1'): Purchase
    {
        Chapter::firstOrCreate(['id' => 'ch-refreq'], [
            'index' => 1,
            'title' => 'فصل درخواست بازگشت وجه',
            'price' => 75000,
            'free' => false,
        ]);

        return Purchase::create([
            'checkout_id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'chapter_id' => 'ch-refreq',
            'price' => 75000,
            'base_price' => 75000,
            'receipt_id' => 'REC-'.Str::upper(Str::random(8)),
            'gateway_ref' => $gatewayRef,
            'status' => 'paid',
        ]);
    }

    /* ──────────────────────── user request ──────────────────────── */

    public function test_buyer_can_request_a_refund(): void
    {
        $buyer = $this->user();
        $purchase = $this->paidPurchase($buyer);
        Sanctum::actingAs($buyer);

        $this->postJson("/api/v1/checkout/{$purchase->id}/refund-request", [
            'reason' => 'محتوای فصل انتظارم را برآورده نکرد.',
        ])->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('purchase.refundStatus', 'pending');

        $purchase->refresh();
        $this->assertNotNull($purchase->refund_requested_at);
        $this->assertNull($purchase->refund_rejected_at);
        $this->assertSame('paid', $purchase->status); // access stays granted
        $this->assertStringContainsString('انتظارم', (string) $purchase->refund_reason);
    }

    public function test_another_user_cannot_request_a_refund(): void
    {
        $buyer = $this->user();
        $other = $this->user();
        $purchase = $this->paidPurchase($buyer);
        Sanctum::actingAs($other);

        $this->postJson("/api/v1/checkout/{$purchase->id}/refund-request")
            ->assertForbidden();

        $this->assertNull($purchase->fresh()->refund_requested_at);
    }

    public function test_duplicate_request_is_rejected_while_pending(): void
    {
        $buyer = $this->user();
        $purchase = $this->paidPurchase($buyer);
        $purchase->update(['refund_requested_at' => now()]);
        Sanctum::actingAs($buyer);

        $this->postJson("/api/v1/checkout/{$purchase->id}/refund-request")
            ->assertStatus(409)
            ->assertJson(['message' => 'درخواست بازگشت وجه شما در انتظار بررسی است.']);
    }

    public function test_pending_and_refunded_purchases_cannot_be_requested(): void
    {
        $buyer = $this->user();
        Chapter::create([
            'id' => 'ch-refreq-p',
            'index' => 1,
            'title' => 'فصل تست',
            'price' => 1000,
            'free' => false,
        ]);
        $pending = Purchase::create([
            'checkout_id' => (string) Str::uuid(),
            'user_id' => $buyer->id,
            'chapter_id' => 'ch-refreq-p',
            'price' => 1000,
            'base_price' => 1000,
            'receipt_id' => 'ORD-'.Str::upper(Str::random(8)),
            'status' => 'pending',
        ]);
        $refunded = $this->paidPurchase($buyer, 'AUTH-REQ-2');
        $refunded->update(['status' => 'refunded', 'refunded_at' => now()]);
        Sanctum::actingAs($buyer);

        $this->postJson("/api/v1/checkout/{$pending->id}/refund-request")
            ->assertStatus(422)
            ->assertJson(['message' => 'فقط خرید موفق قابل درخواست بازگشت وجه است.']);

        // A refunded purchase has status=refunded, so it hits the paid-only guard.
        $this->postJson("/api/v1/checkout/{$refunded->id}/refund-request")
            ->assertStatus(422)
            ->assertJson(['message' => 'فقط خرید موفق قابل درخواست بازگشت وجه است.']);
    }

    /* ──────────────────────── admin list ──────────────────────── */

    public function test_admin_sees_pending_and_done_requests(): void
    {
        $admin = $this->user('admin');
        $buyerPending = $this->user();
        $buyerDone = $this->user();
        $pending = $this->paidPurchase($buyerPending, 'AUTH-REQ-3');
        $pending->update(['refund_requested_at' => now(), 'refund_reason' => 'دلیل تست']);
        // Separate buyer: (user_id, chapter_id, status) is unique.
        $done = $this->paidPurchase($buyerDone, 'AUTH-REQ-4');
        $done->update(['refund_requested_at' => now()->subDay(), 'refund_rejected_at' => now()]);
        Sanctum::actingAs($admin);

        $this->getJson('/api/v1/admin/refunds?status=pending')
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.refundStatus', 'pending')
            ->assertJsonPath('items.0.userName', 'کاربر تست')
            ->assertJsonPath('items.0.chapterTitle', 'فصل درخواست بازگشت وجه');

        $this->getJson('/api/v1/admin/refunds?status=done')
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.refundStatus', 'rejected');
    }

    public function test_non_admin_cannot_list_requests(): void
    {
        $user = $this->user();
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/admin/refunds')->assertForbidden();
    }

    /* ──────────────────────── admin approve ──────────────────────── */

    public function test_approve_refunds_at_gateway_and_notifies(): void
    {
        $admin = $this->user('admin');
        $buyer = $this->user();
        $purchase = $this->paidPurchase($buyer);
        $purchase->update(['refund_requested_at' => now(), 'refund_reason' => 'خرید اشتباهی']);
        Sanctum::actingAs($admin);

        Http::fake([
            '*/pg/v4/payment/refund.json' => Http::response([
                'data' => ['code' => 100, 'ref_id' => 'REF-REQ-1'],
            ], 200),
        ]);

        $this->postJson("/api/v1/admin/refunds/{$purchase->id}/approve")
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('purchase.refundStatus', 'refunded');

        $purchase->refresh();
        $this->assertSame('refunded', $purchase->status);
        $this->assertNotNull($purchase->refunded_at);

        $notification = UserNotification::where('user_id', $buyer->id)->first();
        $this->assertNotNull($notification);
        $this->assertSame('بازگشت وجه تأیید شد', $notification->title);
    }

    public function test_approve_fails_when_gateway_rejects_and_request_stays_pending(): void
    {
        $admin = $this->user('admin');
        $buyer = $this->user();
        $purchase = $this->paidPurchase($buyer);
        $purchase->update(['refund_requested_at' => now()]);
        Sanctum::actingAs($admin);

        Http::fake([
            '*/pg/v4/payment/refund.json' => Http::response([
                'data' => ['code' => -11, 'ref_id' => null],
            ], 200),
        ]);

        $this->postJson("/api/v1/admin/refunds/{$purchase->id}/approve")
            ->assertStatus(502)
            ->assertJson(['message' => 'بازگشت وجه در درگاه ناموفق بود. مبلغ را به‌صورت دستی بررسی کنید.']);

        $purchase->refresh();
        $this->assertSame('paid', $purchase->status);
        $this->assertNull($purchase->refunded_at);
        $this->assertNotNull($purchase->refund_requested_at); // still pending
        $this->assertSame(0, UserNotification::where('user_id', $buyer->id)->count());
    }

    /* ──────────────────────── admin reject ──────────────────────── */

    public function test_reject_closes_request_and_keeps_access(): void
    {
        $admin = $this->user('admin');
        $buyer = $this->user();
        $purchase = $this->paidPurchase($buyer);
        $purchase->update(['refund_requested_at' => now(), 'refund_reason' => 'دلیل اولیه']);
        Sanctum::actingAs($admin);

        Http::fake();

        $this->postJson("/api/v1/admin/refunds/{$purchase->id}/reject", [
            'reason' => 'محتوای دوره طبق توضیحات ارائه شده است.',
        ])->assertOk()
            ->assertJsonPath('purchase.refundStatus', 'rejected');

        $purchase->refresh();
        $this->assertSame('paid', $purchase->status);
        $this->assertNotNull($purchase->refund_rejected_at);
        $this->assertStringContainsString('طبق توضیحات', (string) $purchase->refund_reason);

        Http::assertNothingSent();

        $notification = UserNotification::where('user_id', $buyer->id)->first();
        $this->assertNotNull($notification);
        $this->assertSame('درخواست بازگشت وجه رد شد', $notification->title);
    }

    public function test_approve_reject_on_inactive_request_returns_422(): void
    {
        $admin = $this->user('admin');
        $buyer = $this->user();
        $purchase = $this->paidPurchase($buyer); // no request made
        Sanctum::actingAs($admin);

        $this->postJson("/api/v1/admin/refunds/{$purchase->id}/approve")
            ->assertStatus(422)
            ->assertJson(['message' => 'درخواست بازگشت وجه فعالی برای این خرید وجود ندارد.']);

        $this->postJson("/api/v1/admin/refunds/{$purchase->id}/reject")
            ->assertStatus(422)
            ->assertJson(['message' => 'درخواست بازگشت وجه فعالی برای این خرید وجود ندارد.']);
    }
}
