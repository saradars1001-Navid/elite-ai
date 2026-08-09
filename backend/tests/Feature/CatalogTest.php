<?php

namespace Tests\Feature;

use App\Models\AiTool;
use App\Models\Chapter;
use App\Models\CommunityPost;
use App\Models\Lesson;
use App\Models\Purchase;
use App\Models\Quiz;
use App\Models\QuizQuestion;
use App\Models\ShortVideo;
use App\Models\TrendingPrompt;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Public catalog: chapter/lesson listing with paid-content stripping, the
 * discovery feed (short videos + trending prompts), and global search.
 */
class CatalogTest extends TestCase
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

    private function chapter(string $id, array $overrides = []): Chapter
    {
        return Chapter::create(array_merge([
            'id' => $id,
            'index' => 1,
            'title' => 'فصل کاتالوگ',
            'price' => 50000,
            'old_price' => 70000,
            'free' => false,
            'duration_minutes' => 90,
            'preview_count' => 1,
            'instructor_name' => 'مدرس نمونه',
            'instructor_role' => 'استاد',
        ], $overrides));
    }

    private function lesson(Chapter $chapter, string $id, bool $free = false): Lesson
    {
        return Lesson::create([
            'id' => $id,
            'chapter_id' => $chapter->id,
            'index' => 1,
            'title' => 'درس نمونه',
            'kind' => 'text',
            'duration' => 10,
            'summary' => 'خلاصه درس',
            'content' => ['blocks' => [['type' => 'p', 'text' => 'متن کامل درس']]],
            'captions' => ['fa'],
            'video_path' => '/videos/'.$id.'.mp4',
            'free' => $free,
        ]);
    }

    private function quiz(string $id, string $status = 'published'): Quiz
    {
        $quiz = Quiz::create([
            'id' => $id,
            'kind' => 'daily',
            'title' => 'کوییز روزانه',
            'difficulty' => 'آسان',
            'duration_seconds' => 90,
            'points_per_question' => 10,
            'status' => $status,
        ]);
        QuizQuestion::create([
            'id' => 'qq-'.$id,
            'quiz_id' => $quiz->id,
            'text' => 'سؤال نمونه؟',
            'options' => ['الف', 'ب', 'ج', 'د'],
            'correct' => 1,
            'position' => 1,
        ]);

        return $quiz;
    }

    private function tool(string $id, array $overrides = []): AiTool
    {
        return AiTool::create(array_merge([
            'id' => $id,
            'name' => 'ابزار نمونه',
            'tagline' => 'توضیح کوتاه',
            'category' => 'چت و دستیار هوشمند',
            'level' => 'مقدماتی',
            'pricing' => 'رایگان',
        ], $overrides));
    }

    /* ─────────────────────────── catalog ──────────────────────────── */

    public function test_catalog_strips_paid_lesson_content_for_guests(): void
    {
        $chapter = $this->chapter('ch-paid');
        $this->lesson($chapter, 'l-free', true);
        $this->lesson($chapter, 'l-locked', false);
        $this->quiz('q-pub');
        $this->tool('t-1');

        $response = $this->getJson('/api/v1/catalog')->assertOk()
            ->assertJsonStructure(['chapters', 'quizzes', 'aiTools']);

        $lessons = collect($response->json('chapters.0.lessons'));
        $free = $lessons->firstWhere('id', 'l-free');
        $locked = $lessons->firstWhere('id', 'l-locked');

        $this->assertNotEmpty($free['content']);
        $this->assertNotNull($free['video_path']);
        // Paid lesson must not leak its body, captions or video to guests.
        $this->assertSame([], $locked['content']);
        $this->assertNull($locked['captions']);
        $this->assertNull($locked['video_path']);
    }

    public function test_catalog_exposes_paid_content_to_owner(): void
    {
        $user = $this->user();
        $chapter = $this->chapter('ch-owned');
        $this->lesson($chapter, 'l-owned', false);
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

        $lessons = collect($this->getJson('/api/v1/catalog')->json('chapters.0.lessons'));
        $owned = $lessons->firstWhere('id', 'l-owned');

        $this->assertNotEmpty($owned['content']);
        $this->assertNotNull($owned['video_path']);
    }

    public function test_catalog_exposes_paid_content_to_admin(): void
    {
        $admin = $this->user(['role' => 'admin']);
        $chapter = $this->chapter('ch-admin');
        $this->lesson($chapter, 'l-admin', false);
        Sanctum::actingAs($admin);

        $lessons = collect($this->getJson('/api/v1/catalog')->json('chapters.0.lessons'));
        $this->assertNotEmpty($lessons->firstWhere('id', 'l-admin')['content']);
    }

    public function test_catalog_exposes_all_content_for_free_chapter(): void
    {
        $chapter = $this->chapter('ch-free', ['free' => true]);
        $this->lesson($chapter, 'l-free-ch', false);

        $lessons = collect($this->getJson('/api/v1/catalog')->json('chapters.0.lessons'));
        $this->assertNotEmpty($lessons->firstWhere('id', 'l-free-ch')['content']);
    }

    /* ─────────────────────────── discovery ─────────────────────────── */

    public function test_discovery_returns_only_published_media(): void
    {
        ShortVideo::create([
            'id' => 'v-1', 'title' => 'ویدیو کوتاه', 'creator' => 'ایلیت',
            'category' => 'آموزش', 'video_path' => '/videos/short-1.mp4', 'status' => 'published',
        ]);
        ShortVideo::create([
            'id' => 'v-2', 'title' => 'پیشنویس', 'creator' => 'ایلیت',
            'category' => 'آموزش', 'video_path' => '/videos/short-2.mp4', 'status' => 'draft',
        ]);
        TrendingPrompt::create([
            'id' => 'tp-1', 'title' => 'پرامپت نقاشی', 'prompt' => 'متن پرامپت', 'category' => 'تصویر',
            'tool' => 'Midjourney', 'author' => 'ایلیت', 'status' => 'published',
        ]);
        TrendingPrompt::create([
            'id' => 'tp-2', 'title' => 'پیشنویس', 'prompt' => 'متن', 'category' => 'متن',
            'tool' => 'ChatGPT', 'author' => 'ایلیت', 'status' => 'draft',
        ]);

        $this->getJson('/api/v1/discovery')->assertOk()
            ->assertJsonCount(1, 'shortVideos')
            ->assertJsonCount(1, 'trendingPrompts')
            ->assertJsonPath('shortVideos.0.id', 'v-1')
            ->assertJsonPath('trendingPrompts.0.id', 'tp-1');
    }

    /* ─────────────────────────── search ───────────────────────────── */

    public function test_search_short_query_returns_empty(): void
    {
        $this->getJson('/api/v1/search?q=a')->assertOk()->assertJson(['results' => []]);
    }

    public function test_search_finds_chapters_lessons_tools_and_posts(): void
    {
        $chapter = $this->chapter('ch-searcher', ['title' => 'فصل پرامپتنویسی حرفهای']);
        $this->lesson($chapter, 'l-searcher', true);
        Lesson::where('id', 'l-searcher')->update(['title' => 'پرامپت چیست؟']);
        $this->tool('t-gpt', ['name' => 'پرامپت هوشمند', 'tagline' => 'دستیار پرامپت']);
        CommunityPost::create([
            'user_id' => $this->user()->id,
            'category' => 'پرامپتهای کاربردی',
            'title' => 'بهترین پرامپتهای تولید عکس',
            'body' => 'این پست درباره پرامپت است',
            'status' => 'open',
        ]);

        $results = $this->getJson('/api/v1/search?q=پرامپت')->assertOk()->json('results');

        $types = collect($results)->pluck('type')->unique()->sort()->values()->all();
        $this->assertSame(['chapter', 'lesson', 'post', 'tool'], $types);
        $this->assertLessThanOrEqual(30, count($results));
    }
}
