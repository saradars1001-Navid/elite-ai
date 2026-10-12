<?php

namespace Tests\Feature;

use App\Models\Chapter;
use App\Models\Exam;
use App\Models\ExamQuestion;
use App\Models\Purchase;
use App\Models\Quiz;
use App\Models\QuizQuestion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Answer keys never leave the server before grading. Quiz and exam questions are
 * served without `correct` (and without quiz explanations); the key is returned only
 * in the submit response, after the attempt is recorded. XP and points are awarded
 * on the first attempt only.
 */
class AnswerKeyTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::create([
            'id' => (string) Str::uuid(),
            'name' => 'کاربر تست',
            'phone' => '0912'.random_int(1000000, 9999999),
        ]);
    }

    private function quiz(): Quiz
    {
        $quiz = Quiz::create([
            'id' => 'quiz-keys', 'kind' => 'category', 'title' => 'کوییز کلید', 'category' => 'عمومی',
            'difficulty' => 'آسان', 'duration_seconds' => 90, 'points_per_question' => 10, 'status' => 'published',
        ]);
        foreach ([[1, 2], [2, 0]] as [$pos, $correct]) {
            QuizQuestion::create([
                'id' => "qk-{$pos}", 'quiz_id' => $quiz->id, 'text' => "سؤال {$pos}؟",
                'options' => ['الف', 'ب', 'ج', 'د'], 'correct' => $correct,
                'explanation' => "توضیح {$pos}", 'position' => $pos,
            ]);
        }

        return $quiz;
    }

    public function test_quiz_questions_are_served_without_the_answer_key_or_explanation(): void
    {
        $quiz = $this->quiz();

        $response = $this->getJson("/api/v1/quizzes/{$quiz->id}")->assertOk();

        $questions = $response->json('quiz.questions');
        $this->assertCount(2, $questions);
        foreach ($questions as $question) {
            $this->assertArrayNotHasKey('correct', $question);
            $this->assertArrayNotHasKey('explanation', $question);
            $this->assertArrayHasKey('text', $question);
        }
    }

    public function test_quiz_submit_returns_the_review_and_awards_only_the_first_attempt(): void
    {
        $quiz = $this->quiz();
        $user = $this->user();
        Sanctum::actingAs($user);

        $first = $this->postJson("/api/v1/quizzes/{$quiz->id}/attempts", ['answers' => [2, 1]])->assertOk();
        $this->assertSame(10, $first->json('score'));
        $this->assertSame(10, $first->json('awarded'));
        $this->assertSame([['correct' => 2, 'explanation' => 'توضیح 1'], ['correct' => 0, 'explanation' => 'توضیح 2']], $first->json('review'));

        $xpAfterFirst = (int) $user->fresh()->xp;
        $this->assertSame(10, $xpAfterFirst);

        // A perfect retake is recorded but earns nothing: no XP or points farming.
        $retake = $this->postJson("/api/v1/quizzes/{$quiz->id}/attempts", ['answers' => [2, 0]])->assertOk();
        $this->assertSame(20, $retake->json('score'));
        $this->assertSame(0, $retake->json('awarded'));
        $this->assertFalse($retake->json('firstAttempt'));
        $this->assertSame($xpAfterFirst, (int) $user->fresh()->xp);
        $this->assertSame(2, DB::table('quiz_attempts')->where('user_id', $user->id)->count());
    }

    private function chapterWithExam(): Chapter
    {
        $chapter = Chapter::create(['id' => 'ch-keys', 'index' => 1, 'title' => 'فصل کلید', 'price' => 100000, 'free' => false]);
        Exam::create(['id' => 'exam-keys', 'chapter_id' => $chapter->id, 'title' => 'آزمون کلید', 'duration_minutes' => 20, 'pass_score' => 70]);
        ExamQuestion::create(['id' => 'eq-1', 'exam_id' => 'exam-keys', 'text' => 'سؤال آزمون؟', 'options' => ['الف', 'ب', 'ج', 'د'], 'correct' => 3, 'topic' => 'مبانی']);
        ExamQuestion::create(['id' => 'eq-2', 'exam_id' => 'exam-keys', 'text' => 'سؤال دوم؟', 'options' => ['الف', 'ب', 'ج', 'د'], 'correct' => 1, 'topic' => 'ابزار']);

        return $chapter;
    }

    public function test_catalog_exam_questions_are_sent_only_to_buyers_and_never_with_the_key(): void
    {
        $chapter = $this->chapterWithExam();
        $buyer = $this->user();
        Purchase::create([
            'checkout_id' => (string) Str::uuid(), 'user_id' => $buyer->id, 'chapter_id' => $chapter->id,
            'price' => 100000, 'base_price' => 100000, 'receipt_id' => 'REC-KEYS', 'status' => 'paid',
        ]);

        // Guest: exam meta is visible, questions are not.
        $guest = $this->getJson('/api/v1/catalog')->assertOk();
        $guestExam = collect($guest->json('chapters'))->firstWhere('id', $chapter->id)['exam'];
        $this->assertSame(2, $guestExam['questionCount']);
        $this->assertSame([], $guestExam['questions']);

        // Buyer: questions are present, the key is not.
        Sanctum::actingAs($buyer);
        $buyerExam = collect($this->getJson('/api/v1/catalog')->assertOk()->json('chapters'))->firstWhere('id', $chapter->id)['exam'];
        $this->assertCount(2, $buyerExam['questions']);
        foreach ($buyerExam['questions'] as $question) {
            $this->assertArrayNotHasKey('correct', $question);
        }
    }

    public function test_exam_submit_returns_review_topics_and_awards_first_attempt_only(): void
    {
        $chapter = $this->chapterWithExam();
        $buyer = $this->user();
        Purchase::create([
            'checkout_id' => (string) Str::uuid(), 'user_id' => $buyer->id, 'chapter_id' => $chapter->id,
            'price' => 100000, 'base_price' => 100000, 'receipt_id' => 'REC-KEYS2', 'status' => 'paid',
        ]);
        Sanctum::actingAs($buyer);

        $first = $this->postJson("/api/v1/exams/{$chapter->id}/submit", ['answers' => [3, 0]])->assertOk();
        $this->assertSame(50, $first->json('score'));
        $this->assertSame([['correct' => 3], ['correct' => 1]], $first->json('review'));
        $this->assertSame(['مبانی', 'ابزار'], array_column($first->json('topicAnalysis'), 'topic'));
        $this->assertSame(50, (int) $buyer->fresh()->xp);

        $retake = $this->postJson("/api/v1/exams/{$chapter->id}/submit", ['answers' => [3, 1]])->assertOk();
        $this->assertSame(100, $retake->json('score'));
        $this->assertFalse($retake->json('firstAttempt'));
        $this->assertSame(50, (int) $buyer->fresh()->xp);
    }
}
