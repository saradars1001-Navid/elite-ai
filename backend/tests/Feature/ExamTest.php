<?php

namespace Tests\Feature;

use App\Models\Chapter;
use App\Models\DiscountRule;
use App\Models\Exam;
use App\Models\ExamQuestion;
use App\Models\Purchase;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Chapter exam submission (POST /exams/{chapter}/submit):
 * the client only sends answer indices — the server grades against the DB
 * question bank, records the attempt, awards the performance discount via
 * DiscountRule and sends the result notification (in-app + SMS) through
 * NotificationService. A forged score is never accepted.
 */
class ExamTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'user'): User
    {
        return User::create([
            'id' => (string) Str::uuid(),
            'name' => $role === 'admin' ? 'مدیر تست' : 'کاربر آزمون',
            'phone' => '0912'.str_pad((string) mt_rand(0, 99999999), 8, '0', STR_PAD_LEFT),
            'role' => $role,
            'wallet_balance' => 0,
        ]);
    }

    private function seedChapter(string $id, int $index, bool $free = true, int $price = 0): Chapter
    {
        return Chapter::create([
            'id' => $id,
            'index' => $index,
            'title' => 'فصل آزمون '.$index,
            'price' => $price,
            'free' => $free,
        ]);
    }

    /** ch1 (free, 8 q) + ch2 (paid, 8 q) with the same structure the seeder produces. */
    private function seedExams(): void
    {
        $this->seedChapter('ch1', 1, true);
        $this->seedChapter('ch2', 2, false, 100000);
        $exam = Exam::create(['id' => 'ex-ch1', 'chapter_id' => 'ch1', 'title' => 'آزمون پایان فصل ۱', 'duration_minutes' => 20, 'pass_score' => 70]);
        ExamQuestion::create(['id' => 'ch1-q1', 'exam_id' => 'ex-ch1', 'text' => 'سؤال ۱', 'options' => ['الف', 'ب', 'ج', 'د'], 'correct' => 0, 'topic' => 'مفاهیم']);
        ExamQuestion::create(['id' => 'ch1-q2', 'exam_id' => 'ex-ch1', 'text' => 'سؤال ۲', 'options' => ['الف', 'ب', 'ج', 'د'], 'correct' => 1, 'topic' => 'مفاهیم']);
        ExamQuestion::create(['id' => 'ch1-q3', 'exam_id' => 'ex-ch1', 'text' => 'سؤال ۳', 'options' => ['الف', 'ب', 'ج', 'د'], 'correct' => 2, 'topic' => 'مفاهیم']);
        ExamQuestion::create(['id' => 'ch1-q4', 'exam_id' => 'ex-ch1', 'text' => 'سؤال ۴', 'options' => ['الف', 'ب', 'ج', 'د'], 'correct' => 3, 'topic' => 'مفاهیم']);
        ExamQuestion::create(['id' => 'ch1-q5', 'exam_id' => 'ex-ch1', 'text' => 'سؤال ۵', 'options' => ['الف', 'ب', 'ج', 'د'], 'correct' => 0, 'topic' => 'مفاهیم']);
        ExamQuestion::create(['id' => 'ch1-q6', 'exam_id' => 'ex-ch1', 'text' => 'سؤال ۶', 'options' => ['الف', 'ب', 'ج', 'د'], 'correct' => 1, 'topic' => 'مفاهیم']);
        ExamQuestion::create(['id' => 'ch1-q7', 'exam_id' => 'ex-ch1', 'text' => 'سؤال ۷', 'options' => ['الف', 'ب', 'ج', 'د'], 'correct' => 2, 'topic' => 'مفاهیم']);
        ExamQuestion::create(['id' => 'ch1-q8', 'exam_id' => 'ex-ch1', 'text' => 'سؤال ۸', 'options' => ['الف', 'ب', 'ج', 'د'], 'correct' => 3, 'topic' => 'مفاهیم']);
        $exam2 = Exam::create(['id' => 'ex-ch2', 'chapter_id' => 'ch2', 'title' => 'آزمون پایان فصل ۲', 'duration_minutes' => 20, 'pass_score' => 70]);
        ExamQuestion::create(['id' => 'ch2-q1', 'exam_id' => 'ex-ch2', 'text' => 'سؤال ۱', 'options' => ['الف', 'ب'], 'correct' => 0, 'topic' => 'مفاهیم']);
        ExamQuestion::create(['id' => 'ch2-q2', 'exam_id' => 'ex-ch2', 'text' => 'سؤال ۲', 'options' => ['الف', 'ب'], 'correct' => 1, 'topic' => 'مفاهیم']);
        ExamQuestion::create(['id' => 'ch2-q3', 'exam_id' => 'ex-ch2', 'text' => 'سؤال ۳', 'options' => ['الف', 'ب'], 'correct' => 0, 'topic' => 'مفاهیم']);
        ExamQuestion::create(['id' => 'ch2-q4', 'exam_id' => 'ex-ch2', 'text' => 'سؤال ۴', 'options' => ['الف', 'ب'], 'correct' => 1, 'topic' => 'مفاهیم']);
        ExamQuestion::create(['id' => 'ch2-q5', 'exam_id' => 'ex-ch2', 'text' => 'سؤال ۵', 'options' => ['الف', 'ب'], 'correct' => 0, 'topic' => 'مفاهیم']);
        ExamQuestion::create(['id' => 'ch2-q6', 'exam_id' => 'ex-ch2', 'text' => 'سؤال ۶', 'options' => ['الف', 'ب'], 'correct' => 1, 'topic' => 'مفاهیم']);
        ExamQuestion::create(['id' => 'ch2-q7', 'exam_id' => 'ex-ch2', 'text' => 'سؤال ۷', 'options' => ['الف', 'ب'], 'correct' => 0, 'topic' => 'مفاهیم']);
        ExamQuestion::create(['id' => 'ch2-q8', 'exam_id' => 'ex-ch2', 'text' => 'سؤال ۸', 'options' => ['الف', 'ب'], 'correct' => 1, 'topic' => 'مفاهیم']);
        DiscountRule::create(['id' => 1, 'name' => 'پیش‌فرض', 'high_min' => 90, 'high_percent' => 30, 'mid_min' => 80, 'mid_percent' => 20, 'low_min' => 70, 'low_percent' => 10]);
    }

    /* ─────────────────────────── grading ─────────────────────────── */

    public function test_perfect_score_awards_high_discount_and_notifies(): void
    {
        $user = $this->user();
        $this->seedExams();
        Sanctum::actingAs($user);

        $answers = [0, 1, 2, 3, 0, 1, 2, 3]; // 8/8 correct
        $this->postJson('/api/v1/exams/ch1/submit', ['answers' => $answers])
            ->assertOk()
            ->assertJsonPath('score', 100)
            ->assertJsonPath('correct', 8)
            ->assertJsonPath('passed', true)
            ->assertJsonPath('awardedDiscount', 30)
            ->assertJsonPath('discountChapterId', 'ch2');

        $this->assertSame(1, DB::table('exam_attempts')->count());
        $row = DB::table('exam_attempts')->first();
        $this->assertSame(100, (int) $row->score);
        $this->assertSame(30, (int) $row->awarded_discount);
        $this->assertSame(1, (int) $row->passed);

        // The discount must arrive as an in-app notification (→ SMS via NotificationService).
        $notification = UserNotification::where('user_id', $user->id)->first();
        $this->assertNotNull($notification);
        $this->assertSame('discount', $notification->type);
        $this->assertSame('تخفیف عملکردی فعال شد', $notification->title);
        $this->assertStringContainsString('٪30', (string) $notification->body);
        $this->assertStringContainsString('فصل آزمون 2', (string) $notification->body);
        $this->assertSame('/chapters/ch2', $notification->data['link'] ?? null);

        // XP is credited server-side.
        $this->assertSame(100, (int) $user->fresh()->xp);
    }

    public function test_mid_score_awards_mid_discount_tier(): void
    {
        $user = $this->user();
        $this->seedExams();
        Sanctum::actingAs($user);

        $answers = [0, 1, 2, 3, 0, 1, 2, 3];
        $answers[7] = 0; // 7/8 → 88% → mid tier (20%)
        $this->postJson('/api/v1/exams/ch1/submit', ['answers' => $answers])
            ->assertOk()
            ->assertJsonPath('score', 88)
            ->assertJsonPath('awardedDiscount', 20);
    }

    public function test_borderline_pass_awards_low_tier(): void
    {
        $user = $this->user();
        $this->seedExams();
        Sanctum::actingAs($user);

        // 6/8 → 75% → low tier (10%).
        $answers = [0, 1, 2, 3, 0, 1, 2, 3];
        $answers[6] = 0;
        $answers[7] = 0;
        $this->postJson('/api/v1/exams/ch1/submit', ['answers' => $answers])
            ->assertOk()
            ->assertJsonPath('score', 75)
            ->assertJsonPath('awardedDiscount', 10);
    }

    public function test_failing_score_gets_no_discount_and_plain_notice(): void
    {
        $user = $this->user();
        $this->seedExams();
        Sanctum::actingAs($user);

        // 5/8 → 63% → below pass (70) → no discount.
        $answers = [0, 1, 2, 3, 0, 0, 0, 0];
        $this->postJson('/api/v1/exams/ch1/submit', ['answers' => $answers])
            ->assertOk()
            ->assertJsonPath('score', 63)
            ->assertJsonPath('passed', false)
            ->assertJsonPath('awardedDiscount', 0);

        $notification = UserNotification::where('user_id', $user->id)->first();
        $this->assertNotNull($notification);
        $this->assertSame('exam', $notification->type);
        $this->assertStringNotContainsString('تخفیف', (string) $notification->title);
        $this->assertStringContainsString('دوباره تلاش کنید', (string) $notification->body);
    }

    public function test_answers_are_graded_server_side_not_from_client_score(): void
    {
        $user = $this->user();
        $this->seedExams();
        Sanctum::actingAs($user);

        // A malicious client sends a fake score of 100 — the server must ignore
        // it and grade the actual answers (2/8 → 25% → failed, no discount).
        $this->postJson('/api/v1/exams/ch1/submit', [
            'answers' => [0, 0, 0, 0, 0, 0, 0, 0],
            'score' => 100,
            'passed' => true,
            'awardedDiscount' => 30,
        ])->assertOk()
            ->assertJsonPath('score', 25)
            ->assertJsonPath('passed', false)
            ->assertJsonPath('awardedDiscount', 0);

        $notification = UserNotification::where('user_id', $user->id)->first();
        $this->assertNotNull($notification);
        $this->assertSame('exam', $notification->type);
        $this->assertStringNotContainsString('تخفیف', (string) $notification->title);
    }

    /* ─────────────────────────── access ─────────────────────────── */

    public function test_paid_chapter_exam_requires_paid_access(): void
    {
        $user = $this->user();
        $this->seedExams();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/exams/ch2/submit', ['answers' => [0, 1, 0, 1, 0, 1, 0, 1]])
            ->assertForbidden();

        $this->assertSame(0, DB::table('exam_attempts')->count());
        $this->assertSame(0, UserNotification::count());
    }

    public function test_paid_chapter_exam_allowed_for_buyer_and_admin(): void
    {
        $buyer = $this->user();
        $this->seedExams();
        Purchase::create([
            'checkout_id' => (string) Str::uuid(),
            'user_id' => $buyer->id,
            'chapter_id' => 'ch2',
            'price' => 100000,
            'base_price' => 100000,
            'receipt_id' => 'REC-'.Str::upper(Str::random(8)),
            'status' => 'paid',
        ]);
        Sanctum::actingAs($buyer);

        $this->postJson('/api/v1/exams/ch2/submit', ['answers' => [0, 1, 0, 1, 0, 1, 0, 1]])
            ->assertOk()
            ->assertJsonPath('passed', true);

        $admin = $this->user('admin');
        Sanctum::actingAs($admin);
        $this->postJson('/api/v1/exams/ch2/submit', ['answers' => [0, 1, 0, 1, 0, 1, 0, 1]])
            ->assertOk();
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->seedExams();

        $this->postJson('/api/v1/exams/ch1/submit', ['answers' => [0, 1, 2, 3, 0, 1, 2, 3]])
            ->assertUnauthorized();
    }

    public function test_missing_exam_for_chapter_returns_404(): void
    {
        $user = $this->user();
        $this->seedChapter('ch9', 9, true);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/exams/ch9/submit', ['answers' => [0]])
            ->assertStatus(404);
    }

    /* ─────────────────────────── seeder ─────────────────────────── */

    public function test_seeder_creates_exams_and_questions_for_all_chapters(): void
    {
        $this->seed(); // DatabaseSeeder — works on a fresh host with no chapters.

        $this->assertSame(6, Exam::count());
        $this->assertSame(48, ExamQuestion::count());
        // Chapter shells were created so the exam FK holds.
        $this->assertSame(6, Chapter::count());
    }

    /* ─────────────────────────── last chapter ─────────────────────────── */

    public function test_last_chapter_never_awards_discount(): void
    {
        $user = $this->user();
        $this->seedExams();
        // ch2 is the last chapter in this test world.
        Purchase::create([
            'checkout_id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'chapter_id' => 'ch2',
            'price' => 100000,
            'base_price' => 100000,
            'receipt_id' => 'REC-'.Str::upper(Str::random(8)),
            'status' => 'paid',
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/exams/ch2/submit', ['answers' => [0, 1, 0, 1, 0, 1, 0, 1]])
            ->assertOk()
            ->assertJsonPath('passed', true)
            ->assertJsonPath('awardedDiscount', 0)
            ->assertJsonPath('discountChapterId', null);
    }
}
