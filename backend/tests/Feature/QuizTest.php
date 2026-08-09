<?php

namespace Tests\Feature;

use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\QuizQuestion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Quizzes: published-only access, server-side scoring, XP/points awards, and
 * the per-quiz leaderboard ranked by each user's best score.
 */
class QuizTest extends TestCase
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

    private function quiz(string $id, string $status = 'published', int $points = 10): Quiz
    {
        return Quiz::create([
            'id' => $id,
            'kind' => 'category',
            'title' => 'کوییز تست',
            'category' => 'ابزارهای هوش مصنوعی',
            'difficulty' => 'آسان',
            'duration_seconds' => 90,
            'points_per_question' => $points,
            'status' => $status,
        ]);
    }

    private function question(Quiz $quiz, int $position, int $correct): QuizQuestion
    {
        return QuizQuestion::create([
            'id' => 'qq-'.$quiz->id.'-'.$position,
            'quiz_id' => $quiz->id,
            'text' => 'سؤال '.$position.'؟',
            'options' => ['الف', 'ب', 'ج', 'د'],
            'correct' => $correct,
            'position' => $position,
        ]);
    }

    /* ─────────────────────────── show ─────────────────────────────── */

    public function test_show_published_quiz_with_questions(): void
    {
        $quiz = $this->quiz('qz-1');
        $this->question($quiz, 1, 2);
        $this->question($quiz, 2, 0);

        $this->getJson('/api/v1/quizzes/'.$quiz->id)->assertOk()
            ->assertJsonCount(2, 'quiz.questions')
            ->assertJsonPath('quiz.durationSeconds', 90)
            ->assertJsonPath('quiz.pointsPerQuestion', 10);
    }

    public function test_show_draft_quiz_returns_404(): void
    {
        $quiz = $this->quiz('qz-draft', 'draft');

        $this->getJson('/api/v1/quizzes/'.$quiz->id)->assertStatus(404);
    }

    /* ─────────────────────────── submit ───────────────────────────── */

    public function test_submit_requires_authentication(): void
    {
        $quiz = $this->quiz('qz-auth');

        $this->postJson('/api/v1/quizzes/'.$quiz->id.'/attempts', ['answers' => [0]])
            ->assertStatus(401);
    }

    public function test_submit_scores_answers_and_awards_xp(): void
    {
        $user = $this->user();
        $quiz = $this->quiz('qz-score');
        $this->question($quiz, 1, 2); // correct answer = option index 2
        $this->question($quiz, 2, 0);
        Sanctum::actingAs($user);

        // q1 answered correctly (2), q2 wrongly (1).
        $this->postJson('/api/v1/quizzes/'.$quiz->id.'/attempts', [
            'answers' => [2, 1],
            'durationSeconds' => 30,
        ])->assertOk()
            ->assertJson(['score' => 10, 'total' => 20, 'correct' => 1])
            ->assertJsonStructure(['attempt' => ['id', 'quiz_id', 'score']]);

        $this->assertSame(10, (int) $user->fresh()->xp);
        $this->assertSame(10, (int) $user->fresh()->points);

        $attempt = QuizAttempt::first();
        $this->assertSame(1, $attempt->correct_count);
        $this->assertSame(30, $attempt->duration_seconds);
        $this->assertSame([2, 1], $attempt->answers);
    }

    public function test_submit_perfect_score_awards_full_points(): void
    {
        $user = $this->user();
        $quiz = $this->quiz('qz-perfect', 'published', 20);
        $this->question($quiz, 1, 3);
        $this->question($quiz, 2, 1);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/quizzes/'.$quiz->id.'/attempts', ['answers' => [3, 1]])
            ->assertOk()->assertJson(['score' => 40, 'total' => 40, 'correct' => 2]);

        $this->assertSame(40, (int) $user->fresh()->xp);
    }

    public function test_submit_draft_quiz_returns_404(): void
    {
        Sanctum::actingAs($this->user());
        $quiz = $this->quiz('qz-d2', 'draft');

        $this->postJson('/api/v1/quizzes/'.$quiz->id.'/attempts', ['answers' => [0]])
            ->assertStatus(404);
    }

    public function test_submit_rejects_missing_answers(): void
    {
        Sanctum::actingAs($this->user());
        $quiz = $this->quiz('qz-invalid');

        $this->postJson('/api/v1/quizzes/'.$quiz->id.'/attempts', [])
            ->assertStatus(422);
    }

    /* ─────────────────────────── leaderboard ──────────────────────── */

    public function test_leaderboard_ranks_by_best_score_per_user(): void
    {
        $quiz = $this->quiz('qz-lb');
        $first = $this->user(['name' => 'اول']);
        $second = $this->user(['name' => 'دوم']);

        QuizAttempt::create(['user_id' => $first->id, 'quiz_id' => $quiz->id, 'score' => 5, 'total' => 20, 'correct_count' => 1]);
        QuizAttempt::create(['user_id' => $first->id, 'quiz_id' => $quiz->id, 'score' => 18, 'total' => 20, 'correct_count' => 2]);
        QuizAttempt::create(['user_id' => $second->id, 'quiz_id' => $quiz->id, 'score' => 12, 'total' => 20, 'correct_count' => 2]);

        $rows = $this->getJson('/api/v1/quizzes/'.$quiz->id.'/leaderboard')->json('leaderboard');

        $this->assertCount(2, $rows);
        // Each user appears once, with their MAX score.
        $this->assertSame($first->id, $rows[0]['user_id']);
        $this->assertSame(18, (int) $rows[0]['score']);
        $this->assertSame($second->id, $rows[1]['user_id']);
    }

    public function test_leaderboard_is_empty_without_attempts(): void
    {
        $quiz = $this->quiz('qz-empty');

        $this->getJson('/api/v1/quizzes/'.$quiz->id.'/leaderboard')
            ->assertOk()->assertJson(['leaderboard' => []]);
    }
}
