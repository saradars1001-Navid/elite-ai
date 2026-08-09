<?php

namespace Tests\Feature;

use App\Models\Chapter;
use App\Models\Purchase;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Admin broadcast notifications (POST /admin/notifications): one in-app row
 * per active non-admin user via NotificationService::broadcast, scoped by
 * audience (all / chapter buyers / active 30d / no purchase). Admins and
 * blocked users never receive announcements.
 */
class NotificationBroadcastTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'user', ?string $phone = null, ?string $activeDate = null): User
    {
        return User::create([
            'id' => (string) Str::uuid(),
            'name' => $role === 'admin' ? 'مدیر تست' : 'کاربر تست',
            'phone' => $phone ?? '0912'.str_pad((string) mt_rand(0, 99999999), 8, '0', STR_PAD_LEFT),
            'role' => $role,
            'status' => 'active',
            'last_active_date' => $activeDate ?? now()->toDateString(),
            'wallet_balance' => 0,
        ]);
    }

    private function paidPurchase(User $user, string $chapterId = 'ch2'): void
    {
        Purchase::create([
            'checkout_id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'chapter_id' => $chapterId,
            'price' => 100000,
            'base_price' => 100000,
            'receipt_id' => 'REC-'.Str::upper(Str::random(8)),
            'status' => 'paid',
        ]);
    }

    private function seedChapters(): void
    {
        Chapter::create(['id' => 'ch1', 'index' => 1, 'title' => 'فصل ۱', 'free' => true]);
        Chapter::create(['id' => 'ch2', 'index' => 2, 'title' => 'فصل ۲', 'free' => false, 'price' => 100000]);
    }

    /* ─────────────────────────── all users ─────────────────────────── */

    public function test_broadcast_to_all_active_users_excludes_admins_and_blocked(): void
    {
        $admin = $this->user('admin');
        $alice = $this->user();
        $bob = $this->user();
        $blocked = $this->user();
        $blocked->update(['status' => 'blocked']);
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/admin/notifications', [
            'type' => 'chapter',
            'title' => 'فصل جدید منتشر شد',
            'body' => 'فصل ۷ با موضوع رباتها منتشر شد.',
            'link' => '/chapters/ch7',
        ])->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('recipients', 2);

        // One row per active non-admin user (admin + blocked excluded).
        $this->assertSame(2, UserNotification::count());
        $this->assertSame(1, UserNotification::where('user_id', $alice->id)->count());
        $this->assertSame(1, UserNotification::where('user_id', $bob->id)->count());
        $this->assertSame(0, UserNotification::where('user_id', $admin->id)->count());
        $this->assertSame(0, UserNotification::where('user_id', $blocked->id)->count());

        $row = UserNotification::where('user_id', $alice->id)->first();
        $this->assertSame('chapter', $row->type);
        $this->assertNull($row->read_at);
        $this->assertSame('/chapters/ch7', $row->data['link'] ?? null);
    }

    /* ─────────────────────────── audiences ─────────────────────────── */

    public function test_audience_chapter_buyers_reaches_only_those_with_paid_purchase(): void
    {
        $admin = $this->user('admin');
        $buyer = $this->user();
        $other = $this->user();
        $this->seedChapters();
        $this->paidPurchase($buyer, 'ch2');
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/admin/notifications', [
            'type' => 'discount',
            'title' => 'تخفیف ویژه خریداران',
            'body' => '۳۰٪ تخفیف برای فصل بعد.',
            'audience' => 'chapter-buyers',
            'chapterId' => 'ch2',
        ])->assertOk()
            ->assertJsonPath('recipients', 1);

        $this->assertSame(1, UserNotification::where('user_id', $buyer->id)->count());
        $this->assertSame(0, UserNotification::where('user_id', $other->id)->count());
    }

    public function test_audience_active_30d_reaches_only_recently_active_users(): void
    {
        $admin = $this->user('admin');
        $active = $this->user('user', null, now()->toDateString());
        $stale = $this->user('user', null, now()->subDays(60)->toDateString());
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/admin/notifications', [
            'type' => 'quiz',
            'title' => 'کوییز هفتگی',
            'body' => 'کوییز جدید منتشر شد.',
            'audience' => 'active-30d',
        ])->assertOk()
            ->assertJsonPath('recipients', 1);

        $this->assertSame(1, UserNotification::where('user_id', $active->id)->count());
        $this->assertSame(0, UserNotification::where('user_id', $stale->id)->count());
    }

    public function test_audience_no_purchase_reaches_only_users_without_paid_purchase(): void
    {
        $admin = $this->user('admin');
        $buyer = $this->user();
        $fresh = $this->user();
        $this->seedChapters();
        $this->paidPurchase($buyer, 'ch2');
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/admin/notifications', [
            'type' => 'support',
            'title' => 'شروع یادگیری',
            'body' => 'اولین فصل را رایگان شروع کنید.',
            'audience' => 'no-purchase',
        ])->assertOk()
            ->assertJsonPath('recipients', 1);

        $this->assertSame(0, UserNotification::where('user_id', $buyer->id)->count());
        $this->assertSame(1, UserNotification::where('user_id', $fresh->id)->count());
    }

    /* ─────────────────────────── guards ─────────────────────────── */

    public function test_non_admin_cannot_broadcast(): void
    {
        $user = $this->user();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/admin/notifications', [
            'type' => 'chapter',
            'title' => 'عنوان',
            'body' => 'متن',
        ])->assertForbidden();

        $this->assertSame(0, UserNotification::count());
    }

    public function test_validation_requires_title_body_and_valid_type(): void
    {
        $admin = $this->user('admin');
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/admin/notifications', ['type' => 'unknown', 'title' => '', 'body' => ''])
            ->assertStatus(422);

        $this->assertSame(0, UserNotification::count());
    }

    public function test_chapter_buyers_audience_requires_chapter_id(): void
    {
        $admin = $this->user('admin');
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/admin/notifications', [
            'type' => 'chapter',
            'title' => 'عنوان',
            'body' => 'متن',
            'audience' => 'chapter-buyers',
        ])->assertStatus(422);

        $this->assertSame(0, UserNotification::count());
    }

    public function test_broadcast_with_zero_recipients_is_still_successful(): void
    {
        $admin = $this->user('admin');
        Sanctum::actingAs($admin); // no other users exist

        $this->postJson('/api/v1/admin/notifications', [
            'type' => 'chapter',
            'title' => 'عنوان',
            'body' => 'متن',
        ])->assertOk()
            ->assertJsonPath('recipients', 0);
    }
}
