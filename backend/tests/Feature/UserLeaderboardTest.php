<?php

namespace Tests\Feature;

use App\Models\Chapter;
use App\Models\Purchase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * User-facing profile & social endpoints: real-user search (live-match queue),
 * the global XP leaderboard, chapter access list, and profile updates.
 */
class UserLeaderboardTest extends TestCase
{
    use RefreshDatabase;

    private function user(array $overrides = []): User
    {
        return User::create(array_merge([
            'id' => (string) Str::uuid(),
            'name' => 'کاربر تست',
            'phone' => '0912'.random_int(1000000, 9999999),
        ], $overrides));
    }

    private function chapter(string $id): Chapter
    {
        return Chapter::create([
            'id' => $id,
            'index' => 1,
            'title' => 'فصل تست',
            'price' => 50000,
            'free' => false,
        ]);
    }

    /* ─────────────────────────── user search ─────────────────────────── */

    public function test_search_requires_authentication(): void
    {
        $this->getJson('/api/v1/users/search')->assertStatus(401);
    }

    public function test_search_empty_query_returns_active_users_for_match_queue(): void
    {
        $me = $this->user(['name' => 'من', 'xp' => 10]);
        $this->user(['name' => 'فعال برتر', 'xp' => 900]);
        $this->user(['name' => 'مسدود', 'xp' => 500, 'status' => 'blocked']);
        Sanctum::actingAs($me);

        $users = $this->getJson('/api/v1/users/search')->assertOk()->json('users');

        // Active users only (blocked excluded), ordered by XP desc.
        $this->assertCount(2, $users);
        $this->assertSame(900, $users[0]['xp']);
        $this->assertContains('فعال برتر', array_column($users, 'name'));
    }

    public function test_search_query_filters_by_name_and_excludes_self(): void
    {
        $me = $this->user(['name' => 'من هستم']);
        $target = $this->user(['name' => 'علی محمدی']);
        $this->user(['name' => 'مریم احمدی']);
        Sanctum::actingAs($me);

        $users = $this->getJson('/api/v1/users/search?q=علی')->assertOk()->json('users');

        $this->assertCount(1, $users);
        $this->assertSame($target->id, $users[0]['id']);
    }

    /* ─────────────────────── global leaderboard ──────────────────────── */

    public function test_leaderboard_orders_active_users_by_xp(): void
    {
        $this->user(['name' => 'کمترین', 'xp' => 10]);
        $this->user(['name' => 'بیشترین', 'xp' => 900]);
        $this->user(['name' => 'مسدود ولی پرامتیاز', 'xp' => 9999, 'status' => 'blocked']);

        $users = $this->getJson('/api/v1/leaderboard')->assertOk()->json('users');

        $this->assertCount(2, $users);
        $this->assertSame('بیشترین', $users[0]['name']);
        $this->assertSame(900, $users[0]['xp']);
    }

    /* ─────────────────────────── chapter access ──────────────────────── */

    public function test_access_returns_paid_chapter_ids(): void
    {
        $user = $this->user();
        $chapter = $this->chapter('ch-access');
        Purchase::create([
            'checkout_id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'chapter_id' => $chapter->id,
            'price' => 50000,
            'base_price' => 50000,
            'receipt_id' => 'REC-'.Str::upper(Str::random(6)),
            'status' => 'paid',
        ]);
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/access')->assertOk()
            ->assertJson(['chapterIds' => [$chapter->id]]);
    }

    public function test_access_is_empty_without_purchases(): void
    {
        Sanctum::actingAs($this->user());

        $this->getJson('/api/v1/access')->assertOk()->assertJson(['chapterIds' => []]);
    }

    /* ─────────────────────────── profile ─────────────────────────────── */

    public function test_profile_update_renames_user(): void
    {
        $user = $this->user();
        Sanctum::actingAs($user);

        $this->patchJson('/api/v1/profile', ['name' => 'نام بهروزشده'])
            ->assertOk()->assertJsonPath('user.name', 'نام بهروزشده');

        $this->assertSame('نام بهروزشده', $user->fresh()->name);
    }

    public function test_profile_update_rejects_short_name(): void
    {
        Sanctum::actingAs($this->user());

        $this->patchJson('/api/v1/profile', ['name' => 'ab'])->assertStatus(422);
    }
}
