<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Scheduled retention job: `php artisan notifications:prune` deletes unread
 * notifications older than the window (default 90 days) while keeping read
 * notifications (history/receipts) and recent unread ones intact.
 */
class PruneNotificationsTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::create([
            'id' => (string) Str::uuid(),
            'name' => 'کاربر اعلان',
            'phone' => '0912'.str_pad((string) mt_rand(0, 99999999), 8, '0', STR_PAD_LEFT),
            'role' => 'user',
            'wallet_balance' => 0,
        ]);
    }

    private function notification(User $user, int $daysAgo, ?bool $read = false): UserNotification
    {
        $n = UserNotification::create([
            'user_id' => $user->id,
            'type' => 'support',
            'title' => 'اعلان تست',
            'body' => 'متن اعلان',
            'read_at' => $read ? now() : null,
        ]);
        // created_at is not fillable — force it so the row ages for the query.
        $n->forceFill(['created_at' => now()->subDays($daysAgo)])->save();

        return $n;
    }

    public function test_prunes_only_unread_notifications_older_than_default_window(): void
    {
        $user = $this->user();
        $this->notification($user, 120);       // unread, 120 days → deleted
        $this->notification($user, 91);        // unread, 91 days → deleted
        $oldRead = $this->notification($user, 200, true);   // read, 200 days → kept
        $recent = $this->notification($user, 10);           // unread, 10 days → kept

        $this->artisan('notifications:prune')->assertSuccessful();

        $remaining = UserNotification::pluck('id')->all();
        $this->assertContains($oldRead->id, $remaining);
        $this->assertContains($recent->id, $remaining);
        $this->assertCount(2, $remaining);
    }

    public function test_respects_custom_retention_window(): void
    {
        $user = $this->user();
        $this->notification($user, 30);        // unread, 30 days → deleted with --days=7
        $recent = $this->notification($user, 5); // unread, 5 days → kept

        $this->artisan('notifications:prune', ['--days' => 7])->assertSuccessful();

        $remaining = UserNotification::pluck('id')->all();
        $this->assertSame([$recent->id], $remaining);
    }

    public function test_idempotent_when_nothing_to_prune(): void
    {
        $user = $this->user();
        $this->notification($user, 5);

        $this->artisan('notifications:prune')->assertSuccessful();
        $this->artisan('notifications:prune')->assertSuccessful();

        $this->assertSame(1, UserNotification::count());
    }
}
