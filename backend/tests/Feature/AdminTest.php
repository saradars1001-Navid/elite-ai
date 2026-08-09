<?php

namespace Tests\Feature;

use App\Models\AiTool;
use App\Models\Chapter;
use App\Models\Coupon;
use App\Models\DiscountRule;
use App\Models\PaymentEvent;
use App\Models\Purchase;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\QuizQuestion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Admin panel: every endpoint is guarded by EnsureAdmin (403 for regular
 * users), user management, payment-event log review, resource upsert/delete
 * (chapters, quizzes, tools, videos, prompts) and the real-time stats feed.
 */
class AdminTest extends TestCase
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

    private function admin(): User
    {
        return $this->user(['role' => 'admin']);
    }

    private function chapter(string $id, array $overrides = []): Chapter
    {
        return Chapter::create(array_merge([
            'id' => $id,
            'index' => 1,
            'title' => 'فصل تست',
            'price' => 50000,
            'free' => false,
        ], $overrides));
    }

    private function quiz(string $id): Quiz
    {
        $quiz = Quiz::create([
            'id' => $id,
            'kind' => 'daily',
            'title' => 'کوییز تست',
            'status' => 'published',
        ]);
        QuizQuestion::create([
            'id' => 'qq-'.$id,
            'quiz_id' => $quiz->id,
            'text' => 'سؤال؟',
            'options' => ['الف', 'ب'],
            'correct' => 0,
            'position' => 1,
        ]);

        return $quiz;
    }

    private function paidPurchase(User $user, Chapter $chapter): Purchase
    {
        return Purchase::create([
            'checkout_id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'chapter_id' => $chapter->id,
            'price' => 50000,
            'base_price' => 70000,
            'discount_label' => '٪30 عملکردی',
            'receipt_id' => 'REC-'.Str::upper(Str::random(6)),
            'status' => 'paid',
        ]);
    }

    /* ─────────────────────────── access guard ─────────────────────────── */

    public function test_admin_routes_reject_regular_users(): void
    {
        Sanctum::actingAs($this->user());

        $this->getJson('/api/v1/admin/users')->assertStatus(403);
        $this->getJson('/api/v1/admin/stats')->assertStatus(403);
        $this->getJson('/api/v1/admin/payment-events')->assertStatus(403);
        $this->postJson('/api/v1/admin/users', ['name' => 'x', 'phone' => '09120000000'])->assertStatus(403);
    }

    /* ─────────────────────────── user management ──────────────────────── */

    public function test_admin_lists_users_and_filters_by_query(): void
    {
        Sanctum::actingAs($this->admin());
        $this->user(['name' => 'علی رضایی']);
        $this->user(['name' => 'مریم احمدی']);

        $rows = $this->getJson('/api/v1/admin/users?q=علی')->assertOk()->json('users.data');
        $this->assertCount(1, $rows);
        $this->assertSame('علی رضایی', $rows[0]['name']);
    }

    public function test_admin_creates_user(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/v1/admin/users', [
            'name' => 'کاربر جدید',
            'phone' => '09350000000',
            'role' => 'instructor',
        ])->assertStatus(201)
            ->assertJsonPath('user.role', 'instructor');

        $user = User::where('phone', '09350000000')->first();
        $this->assertNotNull($user);
        $this->assertSame('instructor', $user->role);
    }

    public function test_admin_updates_user_role_and_status(): void
    {
        Sanctum::actingAs($this->admin());
        $target = $this->user(['role' => 'user', 'status' => 'active']);

        $this->patchJson('/api/v1/admin/users/'.$target->id, [
            'role' => 'instructor',
            'status' => 'blocked',
        ])->assertOk()
            ->assertJsonPath('user.status', 'blocked');

        $this->assertSame('instructor', $target->fresh()->role);
    }

    /* ─────────────────────── payment event log ────────────────────────── */

    public function test_admin_lists_payment_events_with_filters(): void
    {
        Sanctum::actingAs($this->admin());
        PaymentEvent::create([
            'source' => 'webhook', 'gateway' => 'zarinpal', 'type' => 'payment',
            'reference_type' => 'purchase', 'reference_id' => '10', 'status' => 'processed',
            'payload' => ['status' => 100], 'verify_result' => ['ok' => true],
        ]);
        PaymentEvent::create([
            'source' => 'callback', 'gateway' => 'idpay', 'type' => 'payment',
            'reference_type' => 'wallet', 'reference_id' => '5', 'status' => 'processed',
            'payload' => ['status' => 1], 'verify_result' => ['ok' => true],
        ]);

        $events = $this->getJson('/api/v1/admin/payment-events?source=webhook&status=processed')
            ->assertOk()->json('events');

        $this->assertCount(1, $events);
        $this->assertSame('webhook', $events[0]['source']);
        $this->assertSame('zarinpal', $events[0]['gateway']);
        $this->assertArrayHasKey('payload', $events[0]);
        $this->assertArrayHasKey('createdAt', $events[0]);
    }

    /* ─────────────────────────── resource CRUD ────────────────────────── */

    public function test_admin_upserts_and_updates_tool(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/v1/admin/resources/tools', [
            'id' => 'tool-admin',
            'name' => 'ابزار جدید',
            'category' => 'چت و دستیار هوشمند',
            'useCases' => ['پرامپت'],
            'pricing' => 'رایگان',
        ])->assertOk()->assertJsonPath('item.name', 'ابزار جدید');

        $tool = AiTool::find('tool-admin');
        $this->assertSame('چت و دستیار هوشمند', $tool->category);
        $this->assertSame(['پرامپت'], $tool->use_cases);

        // Same id → updateOrCreate updates the existing row.
        $this->postJson('/api/v1/admin/resources/tools', ['id' => 'tool-admin', 'name' => 'ویرایششده'])
            ->assertOk();
        $this->assertSame('ویرایششده', $tool->fresh()->name);
    }

    public function test_admin_upserts_chapter(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/v1/admin/resources/chapters', [
            'id' => 'ch-admin',
            'index' => 5,
            'title' => 'فصل مدیریتی',
            'price' => 120000,
        ])->assertOk()->assertJsonPath('item.title', 'فصل مدیریتی');

        $this->assertSame(120000, (int) Chapter::find('ch-admin')->price);
    }

    public function test_admin_upserts_quiz(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/v1/admin/resources/quizzes', [
            'id' => 'qz-admin',
            'kind' => 'weekly',
            'title' => 'کوییز هفتگی',
            'durationSeconds' => 120,
            'pointsPerQuestion' => 20,
        ])->assertOk()->assertJsonPath('item.kind', 'weekly');

        $this->assertSame(120, (int) Quiz::find('qz-admin')->duration_seconds);
    }

    public function test_admin_destroys_resource(): void
    {
        Sanctum::actingAs($this->admin());
        $this->chapter('ch-del');

        $this->deleteJson('/api/v1/admin/resources/chapters/ch-del')
            ->assertOk()->assertJson(['ok' => true]);

        $this->assertNull(Chapter::find('ch-del'));
    }

    public function test_admin_rejects_unknown_resource(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/v1/admin/resources/unknown', ['id' => 'x'])->assertStatus(404);
        $this->deleteJson('/api/v1/admin/resources/unknown/x')->assertStatus(404);
    }

    /* ─────────────────────── pricing preview ──────────────────────────── */

    #[DataProvider('performanceBoundaries')]
    public function test_pricing_preview_performance_tier_boundaries(int $score, int $percent, int $finalPrice): void
    {
        DiscountRule::updateOrCreate(['id' => 1], [
            'name' => 'پیش‌فرض',
            'high_min' => 90, 'high_percent' => 30,
            'mid_min' => 80, 'mid_percent' => 20,
            'low_min' => 70, 'low_percent' => 10,
        ]);
        $this->chapter('ch-bd-a', ['index' => 1, 'price' => 100000]);
        $this->chapter('ch-bd-b', ['index' => 2, 'price' => 100000]);
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/v1/admin/pricing/preview', [
            'chapterId' => 'ch-bd-b',
            'examScore' => $score,
        ])->assertOk()
            ->assertJsonPath('performancePercent', $percent)
            ->assertJsonPath('totalPercent', $percent)
            ->assertJsonPath('finalPrice', $finalPrice);
    }

    public static function performanceBoundaries(): array
    {
        return [
            'زیر کف (۶۹) → بدون تخفیف' => [69, 0, 100000],
            'کف tier پایین (۷۰) → ٪۱۰' => [70, 10, 90000],
            'سقف tier پایین (۷۹) → ٪۱۰' => [79, 10, 90000],
            'کف tier متوسط (۸۰) → ٪۲۰' => [80, 20, 80000],
            'سقف tier متوسط (۸۹) → ٪۲۰' => [89, 20, 80000],
            'کف tier بالا (۹۰) → ٪۳۰' => [90, 30, 70000],
            'نمره کامل (۱۰۰) → ٪۳۰' => [100, 30, 70000],
        ];
    }

    /* ─────────────────────── pricing preview ──────────────────────────── */

    public function test_pricing_preview_applies_performance_tier(): void
    {
        DiscountRule::updateOrCreate(['id' => 1], [
            'name' => 'پیش‌فرض',
            'high_min' => 90, 'high_percent' => 30,
            'mid_min' => 80, 'mid_percent' => 20,
            'low_min' => 70, 'low_percent' => 10,
        ]);
        $this->chapter('ch-a', ['index' => 1, 'price' => 100000]);
        $this->chapter('ch-b', ['index' => 2, 'price' => 200000]);
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/v1/admin/pricing/preview', [
            'chapterId' => 'ch-b',
            'examScore' => 95,
        ])->assertOk()
            ->assertJsonPath('basePrice', 200000)
            ->assertJsonPath('performancePercent', 30)
            ->assertJsonPath('finalPrice', 140000)
            ->assertJsonPath('discountLabel', '٪30 عملکردی')
            ->assertJsonPath('tiers.0.percent', 30);
    }

    public function test_pricing_preview_combines_score_and_coupon(): void
    {
        DiscountRule::updateOrCreate(['id' => 1], [
            'high_min' => 90, 'high_percent' => 30,
            'mid_min' => 80, 'mid_percent' => 20,
            'low_min' => 70, 'low_percent' => 10,
        ]);
        Coupon::create(['code' => 'ELITE10', 'percent' => 10]);
        $this->chapter('ch-a', ['index' => 1, 'price' => 100000]);
        $this->chapter('ch-b', ['index' => 2, 'price' => 200000]);
        Sanctum::actingAs($this->admin());

        // 20% (score 85) + 10% coupon = 30% → 140000.
        $this->postJson('/api/v1/admin/pricing/preview', [
            'chapterId' => 'ch-b',
            'examScore' => 85,
            'couponCode' => 'ELITE10',
        ])->assertOk()
            ->assertJsonPath('performancePercent', 20)
            ->assertJsonPath('couponPercent', 10)
            ->assertJsonPath('couponValid', true)
            ->assertJsonPath('totalPercent', 30)
            ->assertJsonPath('finalPrice', 140000);
    }

    public function test_pricing_preview_rejects_invalid_coupon_without_changing_price(): void
    {
        $this->chapter('ch-a', ['index' => 1, 'price' => 100000]);
        $this->chapter('ch-b', ['index' => 2, 'price' => 200000]);
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/v1/admin/pricing/preview', [
            'chapterId' => 'ch-b',
            'couponCode' => 'NOPE',
        ])->assertOk()
            ->assertJsonPath('couponValid', false)
            ->assertJsonPath('couponPercent', 0)
            ->assertJsonPath('finalPrice', 200000);
    }

    public function test_pricing_preview_chapter_one_is_not_performance_eligible(): void
    {
        DiscountRule::updateOrCreate(['id' => 1], [
            'high_min' => 90, 'high_percent' => 30,
            'mid_min' => 80, 'mid_percent' => 20,
            'low_min' => 70, 'low_percent' => 10,
        ]);
        $this->chapter('ch-a', ['index' => 1, 'price' => 100000]);
        Sanctum::actingAs($this->admin());

        // First chapter has no previous chapter → no performance discount even with a high score.
        $this->postJson('/api/v1/admin/pricing/preview', [
            'chapterId' => 'ch-a',
            'examScore' => 95,
        ])->assertOk()
            ->assertJsonPath('performanceEligible', false)
            ->assertJsonPath('performancePercent', 0)
            ->assertJsonPath('finalPrice', 100000);
    }

    /* ──────────────────────────── stats feed ──────────────────────────── */

    public function test_admin_stats_aggregate_sales_progress_and_quizzes(): void
    {
        Sanctum::actingAs($this->admin());

        $buyer = $this->user();
        $chapter = $this->chapter('ch-stats');
        $this->paidPurchase($buyer, $chapter);
        $this->paidPurchase($this->user(), $chapter);

        $quiz = $this->quiz('qz-stats');
        QuizAttempt::create([
            'user_id' => $buyer->id, 'quiz_id' => $quiz->id,
            'score' => 10, 'total' => 10, 'correct_count' => 1,
        ]);

        $this->getJson('/api/v1/admin/stats')->assertOk()
            ->assertJsonStructure([
                'sales' => ['revenue', 'baseRevenue', 'orders', 'paidOrders', 'avgOrder', 'daily', 'recent'],
                'progress' => ['users', 'newUsers30d', 'completedLessons', 'avgXp', 'perChapter', 'topLearners'],
                'quizzes' => ['attempts', 'avgScore', 'passRate', 'perQuiz', 'topScorers'],
            ])
            ->assertJsonPath('sales.revenue', 100000)
            ->assertJsonPath('sales.orders', 2)
            ->assertJsonPath('progress.users', 3) // admin + 2 buyers
            ->assertJsonPath('quizzes.attempts', 1)
            ->assertJsonPath('quizzes.passRate', 100);

        // Recent orders carry the chapter title and buyer name.
        $recent = $this->getJson('/api/v1/admin/stats')->json('sales.recent');
        $this->assertSame('فصل تست', $recent[0]['chapterTitle']);
        $this->assertArrayHasKey('receiptId', $recent[0]);
    }
}
