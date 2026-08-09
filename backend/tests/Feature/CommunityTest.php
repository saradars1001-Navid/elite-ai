<?php

namespace Tests\Feature;

use App\Models\CommunityPost;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Community: paginated post listing (open posts only), authenticated post
 * creation with the author relation, and post detail.
 */
class CommunityTest extends TestCase
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

    private function makePost(User $author, array $overrides = []): CommunityPost
    {
        return CommunityPost::create(array_merge([
            'user_id' => $author->id,
            'category' => 'پرسش و پاسخ',
            'title' => 'سؤال نمونه',
            'body' => 'متن کامل سؤال',
            'tags' => ['پرامپت'],
            'status' => 'open',
        ], $overrides));
    }

    public function test_index_lists_only_open_posts(): void
    {
        $author = $this->user();
        $this->makePost($author, ['title' => 'باز']);
        $this->makePost($author, ['title' => 'بسته', 'status' => 'closed']);
        $this->makePost($author, ['title' => 'گزارششده', 'status' => 'reported']);

        $this->getJson('/api/v1/community/posts')->assertOk()
            ->assertJsonStructure(['data', 'total'])
            ->assertJsonCount(1, 'data');
    }

    public function test_index_respects_per_page_boundaries(): void
    {
        $author = $this->user();
        foreach (range(1, 3) as $i) {
            $this->makePost($author, ['title' => 'پست '.$i]);
        }

        $this->assertCount(2, $this->getJson('/api/v1/community/posts?perPage=2')->json('data'));
        $this->assertCount(1, $this->getJson('/api/v1/community/posts?perPage=1')->json('data'));
        // perPage is clamped to at least 1 / at most 50.
        $this->assertCount(1, $this->getJson('/api/v1/community/posts?perPage=0')->json('data'));
        $this->assertCount(3, $this->getJson('/api/v1/community/posts?perPage=999')->json('data'));
    }

    public function test_store_requires_authentication(): void
    {
        $this->postJson('/api/v1/community/posts', [
            'category' => 'ابزارها',
            'title' => 'تجربه من',
            'body' => 'متن',
        ])->assertStatus(401);
    }

    public function test_store_validates_required_fields(): void
    {
        Sanctum::actingAs($this->user());

        $this->postJson('/api/v1/community/posts', ['title' => 'بدون دسته'])
            ->assertStatus(422);

        $this->assertSame(0, CommunityPost::count());
    }

    public function test_store_creates_post_with_author(): void
    {
        $user = $this->user();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/community/posts', [
            'category' => 'تجربه استفاده از ابزارها',
            'title' => 'تجربه من با ChatGPT',
            'body' => 'این تجربه من بود...',
            'tags' => ['chatgpt', 'بهرهوری'],
        ])->assertStatus(201)
            ->assertJsonPath('post.author.id', $user->id)
            ->assertJsonPath('post.title', 'تجربه من با ChatGPT');

        $post = CommunityPost::first();
        $this->assertSame(['chatgpt', 'بهرهوری'], $post->tags);
        $this->assertSame('open', $post->status);
    }

    public function test_show_returns_post_with_author(): void
    {
        $author = $this->user(['name' => 'علی رضایی']);
        $post = $this->makePost($author);

        $this->getJson('/api/v1/community/posts/'.$post->id)->assertOk()
            ->assertJsonPath('post.id', $post->id)
            ->assertJsonPath('post.author.name', 'علی رضایی');
    }
}
