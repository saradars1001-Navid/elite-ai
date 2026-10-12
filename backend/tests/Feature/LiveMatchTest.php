<?php

namespace Tests\Feature;

use App\Models\LiveMatch;
use App\Models\LiveMatchPlayer;
use App\Models\Quiz;
use App\Models\QuizQuestion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Real-user live matches: creation from the published question pool, lobby
 * listing, joining with capacity checks, host start, server-side answer
 * grading with speed bonus, and finish flow with rank + XP awards.
 */
class LiveMatchTest extends TestCase
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

    private function seedQuestionPool(int $count = 6): void
    {
        $quiz = Quiz::create([
            'id' => 'qz-pool',
            'kind' => 'category',
            'title' => 'بانک سؤال',
            'status' => 'published',
        ]);
        foreach (range(1, $count) as $i) {
            QuizQuestion::create([
                'id' => 'qq-pool-'.$i,
                'quiz_id' => $quiz->id,
                'text' => 'سؤال '.$i.'؟',
                'options' => ['الف', 'ب', 'ج', 'د'],
                'correct' => $i % 4,
                'position' => $i,
            ]);
        }
    }

    private function waitingMatch(User $host, string $mode = '1v1'): LiveMatch
    {
        $match = LiveMatch::create([
            'host_id' => $host->id,
            'mode' => $mode,
            'max_players' => $mode === '1v1' ? 2 : 4,
            'status' => 'waiting',
            'questions' => [
                ['text' => 'سؤال ۱؟', 'options' => ['الف', 'ب', 'ج', 'د'], 'correct' => 1, 'explanation' => 'توضیح ۱'],
                ['text' => 'سؤال ۲؟', 'options' => ['الف', 'ب', 'ج', 'د'], 'correct' => 2, 'explanation' => 'توضیح ۲'],
            ],
            'question_index' => 0,
            'points_per_question' => 10,
            'seconds_per_question' => 15,
        ]);
        LiveMatchPlayer::create(['match_id' => $match->id, 'user_id' => $host->id, 'answers' => [], 'score' => 0]);

        return $match;
    }

    /* ─────────────────────────── creation ─────────────────────────── */

    public function test_create_match_requires_question_pool(): void
    {
        Sanctum::actingAs($this->user());

        $this->postJson('/api/v1/live-matches', ['mode' => '1v1'])
            ->assertStatus(422)
            ->assertJson(['message' => 'هنوز سؤال کافی برای مسابقه ثبت نشده است.']);
    }

    public function test_create_match_adds_host_as_first_player(): void
    {
        $this->seedQuestionPool();
        $host = $this->user(['name' => 'میزبان']);
        Sanctum::actingAs($host);

        $response = $this->postJson('/api/v1/live-matches', ['mode' => '1v1'])
            ->assertStatus(201)
            ->assertJsonPath('match.mode', '1v1')
            ->assertJsonPath('match.maxPlayers', 2)
            ->assertJsonPath('match.status', 'waiting')
            ->assertJsonCount(6, 'match.questions')
            ->assertJsonCount(1, 'match.players')
            ->assertJsonPath('match.players.0.name', 'میزبان');

        // Even the creator never receives the answer key before the match ends.
        $this->assertKeyHidden($response->json('match.questions'), 6);

        $match = LiveMatch::first();
        $this->assertSame('1v1', $match->mode);
        $this->assertSame($host->id, $match->host_id);
    }

    public function test_create_match_validates_mode(): void
    {
        Sanctum::actingAs($this->user());

        $this->postJson('/api/v1/live-matches', ['mode' => 'solo'])->assertStatus(422);
    }

    /* ─────────────────────────── lobby ────────────────────────────── */

    public function test_lobby_lists_waiting_matches(): void
    {
        $host = $this->user();
        $this->waitingMatch($host);
        Sanctum::actingAs($this->user());
        $finished = LiveMatch::create([
            'host_id' => $host->id, 'mode' => 'ffa', 'max_players' => 4,
            'status' => 'finished', 'questions' => [], 'question_index' => 0,
        ]);

        $matches = $this->getJson('/api/v1/live-matches/lobby')->assertOk()->json('matches');

        $this->assertCount(1, $matches);
        $this->assertSame('finished', $finished->fresh()->status); // untouched
    }

    /* ─────────────────────────── joining ──────────────────────────── */

    public function test_join_adds_real_opponent_and_auto_starts_at_capacity(): void
    {
        $this->seedQuestionPool();
        $host = $this->user();
        $match = $this->waitingMatch($host);
        $opponent = $this->user();
        Sanctum::actingAs($opponent);

        // 1v1: joining fills capacity → match auto-starts.
        $this->postJson('/api/v1/live-matches/'.$match->id.'/join')
            ->assertStatus(201)
            ->assertJsonPath('match.status', 'playing')
            ->assertJsonCount(2, 'match.players');

        $this->assertSame('playing', $match->fresh()->status);
        $this->assertSame(2, LiveMatchPlayer::where('match_id', $match->id)->count());
        $this->assertSame(0, (int) $opponent->fresh()->xp); // xp untouched until answers
    }

    public function test_join_rejects_when_match_is_not_waiting(): void
    {
        $host = $this->user();
        $match = $this->waitingMatch($host);
        $match->update(['status' => 'playing']);
        Sanctum::actingAs($this->user());

        $this->postJson('/api/v1/live-matches/'.$match->id.'/join')
            ->assertStatus(409);
    }

    public function test_join_is_idempotent_for_existing_player(): void
    {
        $host = $this->user();
        $match = $this->waitingMatch($host);
        Sanctum::actingAs($host);

        $this->postJson('/api/v1/live-matches/'.$match->id.'/join')
            ->assertOk()
            ->assertJsonPath('match.id', $match->id);
    }

    public function test_join_rejects_when_full(): void
    {
        $host = $this->user();
        $match = LiveMatch::create([
            'host_id' => $host->id, 'mode' => '1v1', 'max_players' => 2,
            'status' => 'waiting', 'questions' => [], 'question_index' => 0,
        ]);
        LiveMatchPlayer::create(['match_id' => $match->id, 'user_id' => $host->id, 'answers' => [], 'score' => 0]);
        LiveMatchPlayer::create(['match_id' => $match->id, 'user_id' => $this->user()->id, 'answers' => [], 'score' => 0]);
        Sanctum::actingAs($this->user());

        $this->postJson('/api/v1/live-matches/'.$match->id.'/join')
            ->assertStatus(422)
            ->assertJson(['message' => 'ظرفیت مسابقه تکمیل شده است.']);
    }

    /* ─────────────────────────── host start ───────────────────────── */

    public function test_start_match_requires_host(): void
    {
        $host = $this->user();
        $match = $this->waitingMatch($host);
        Sanctum::actingAs($this->user());

        $this->postJson('/api/v1/live-matches/'.$match->id.'/start')->assertStatus(403);
    }

    public function test_start_match_needs_an_opponent(): void
    {
        $host = $this->user();
        $match = $this->waitingMatch($host);
        Sanctum::actingAs($host);

        $this->postJson('/api/v1/live-matches/'.$match->id.'/start')
            ->assertStatus(422)
            ->assertJson(['message' => 'برای شروع حداقل یک رقیب لازم است.']);
    }

    public function test_start_match_begins_playing(): void
    {
        $host = $this->user();
        $match = $this->waitingMatch($host);
        LiveMatchPlayer::create(['match_id' => $match->id, 'user_id' => $this->user()->id, 'answers' => [], 'score' => 0]);
        Sanctum::actingAs($host);

        $this->postJson('/api/v1/live-matches/'.$match->id.'/start')
            ->assertOk()
            ->assertJsonPath('match.status', 'playing')
            ->assertJsonPath('match.questionIndex', 0);
        $this->assertNotNull($match->fresh()->question_ends_at);
    }

    /* ─────────────────────────── state & answers ──────────────────── */

    public function test_state_requires_membership(): void
    {
        $host = $this->user();
        $match = $this->waitingMatch($host);
        Sanctum::actingAs($this->user());

        $this->getJson('/api/v1/live-matches/'.$match->id)->assertStatus(403);
    }

    public function test_answer_grades_correctly_with_speed_bonus(): void
    {
        // Freeze time so the speed bonus is deterministic regardless of how
        // slow the runner is (bonus = round(10 * 0.3 * remaining/total)).
        Carbon::setTestNow('2026-08-09 12:00:00');

        $host = $this->user(['xp' => 0]);
        $match = $this->waitingMatch($host);
        LiveMatchPlayer::create(['match_id' => $match->id, 'user_id' => $this->user()->id, 'answers' => [], 'score' => 0]);
        $match->update(['status' => 'playing', 'started_at' => now(), 'question_index' => 0, 'question_started_at' => now()->subSeconds(2), 'question_ends_at' => now()->addSeconds(13)]);
        Sanctum::actingAs($host);

        // Question 0's correct answer is index 1 → correct.
        $response = $this->postJson('/api/v1/live-matches/'.$match->id.'/answer', ['answer' => 1, 'questionIndex' => 0])
            ->assertOk();

        $hostRow = collect($response->json('match.players'))->firstWhere('isViewer', true);
        // base 10 + speed bonus (2s in, 13s left → ~3 bonus).
        $this->assertSame(13, $hostRow['score']);

        $player = LiveMatchPlayer::where('match_id', $match->id)->where('user_id', $host->id)->first();
        $this->assertSame(13, $player->score);
        $this->assertSame(1, $player->correct_count);
        $this->assertSame(1, $player->answered_count);
        $this->assertSame(10, (int) $host->fresh()->xp);

        Carbon::setTestNow(); // unfreeze for the remaining tests
    }

    public function test_answer_rejects_wrong_question_index(): void
    {
        $host = $this->user();
        $match = $this->waitingMatch($host);
        LiveMatchPlayer::create(['match_id' => $match->id, 'user_id' => $this->user()->id, 'answers' => [], 'score' => 0]);
        $match->update(['status' => 'playing', 'started_at' => now(), 'question_index' => 0, 'question_started_at' => now(), 'question_ends_at' => now()->addSeconds(15)]);
        Sanctum::actingAs($host);

        $this->postJson('/api/v1/live-matches/'.$match->id.'/answer', ['answer' => 1, 'questionIndex' => 5])
            ->assertStatus(409);
    }

    public function test_answer_rejects_when_match_not_playing(): void
    {
        $host = $this->user();
        $match = $this->waitingMatch($host);
        Sanctum::actingAs($host);

        $this->postJson('/api/v1/live-matches/'.$match->id.'/answer', ['answer' => 1, 'questionIndex' => 0])
            ->assertStatus(409);
    }

    /** The serialized questions hide the answer key until the match finishes. */
    private function assertKeyHidden(array $questions, int $count): void
    {
        $this->assertCount($count, $questions);
        foreach ($questions as $q) {
            $this->assertArrayNotHasKey('correct', $q);
            $this->assertArrayNotHasKey('explanation', $q);
            $this->assertArrayNotHasKey('myAnswer', $q);
            $this->assertArrayHasKey('text', $q);
            $this->assertArrayHasKey('options', $q);
        }
    }

    public function test_questions_hide_answer_key_while_waiting(): void
    {
        $this->seedQuestionPool();
        $match = $this->waitingMatch($this->user());
        Sanctum::actingAs($match->host);

        $questions = $this->getJson('/api/v1/live-matches/'.$match->id)
            ->assertOk()
            ->json('match.questions');

        $this->assertKeyHidden($questions, 2);
    }

    public function test_questions_hide_answer_key_while_playing(): void
    {
        $host = $this->user();
        $match = $this->waitingMatch($host);
        LiveMatchPlayer::create(['match_id' => $match->id, 'user_id' => $this->user()->id, 'answers' => [], 'score' => 0]);
        $match->update(['status' => 'playing', 'started_at' => now(), 'question_index' => 0, 'question_started_at' => now(), 'question_ends_at' => now()->addSeconds(15)]);
        Sanctum::actingAs($host);

        // Both the state poll and the answer response must hide the key.
        $stateQuestions = $this->getJson('/api/v1/live-matches/'.$match->id)
            ->assertOk()
            ->json('match.questions');
        $this->assertKeyHidden($stateQuestions, 2);

        $answerQuestions = $this->postJson('/api/v1/live-matches/'.$match->id.'/answer', ['answer' => 1, 'questionIndex' => 0])
            ->assertOk()
            ->json('match.questions');
        $this->assertKeyHidden($answerQuestions, 2);
    }

    public function test_questions_reveal_key_and_own_answers_after_finish(): void
    {
        $host = $this->user();
        $match = $this->waitingMatch($host);
        LiveMatchPlayer::create(['match_id' => $match->id, 'user_id' => $this->user()->id, 'answers' => [], 'score' => 0]);
        $match->update(['status' => 'finished', 'finished_at' => now()]);
        // Host answered Q0 (correct=1) and Q1 (correct=2): one right, one wrong.
        $hostPlayer = LiveMatchPlayer::where('match_id', $match->id)->where('user_id', $host->id)->first();
        $hostPlayer->update(['answers' => [
            ['index' => 0, 'answer' => 1, 'at' => now()->toIso8601String()],
            ['index' => 1, 'answer' => 0, 'at' => now()->toIso8601String()],
        ]]);
        Sanctum::actingAs($host);

        $questions = $this->getJson('/api/v1/live-matches/'.$match->id)
            ->assertOk()
            ->json('match.questions');

        $this->assertCount(2, $questions);
        foreach ($questions as $i => $q) {
            $this->assertSame($i === 0 ? 1 : 2, $q['correct']);
            $this->assertArrayHasKey('explanation', $q);
            $this->assertSame($i === 0 ? 1 : 0, $q['myAnswer']);
        }
    }

    public function test_questions_reveal_key_without_own_answers_for_spectating_player(): void
    {
        $host = $this->user();
        $match = $this->waitingMatch($host);
        $opponent = $this->user();
        LiveMatchPlayer::create(['match_id' => $match->id, 'user_id' => $opponent->id, 'answers' => [], 'score' => 0]);
        $match->update(['status' => 'finished', 'finished_at' => now()]);
        Sanctum::actingAs($opponent); // joined but never answered

        $questions = $this->getJson('/api/v1/live-matches/'.$match->id)
            ->assertOk()
            ->json('match.questions');

        foreach ($questions as $q) {
            $this->assertArrayHasKey('correct', $q);
            $this->assertNull($q['myAnswer']);
        }
    }

    /* ─────────────────────────── finish flow ──────────────────────── */

    public function test_match_finishes_after_last_question_and_awards_ranks(): void
    {
        $host = $this->user(['xp' => 0]);
        $opponent = $this->user(['xp' => 0]);
        $match = $this->waitingMatch($host);
        $hostPlayer = LiveMatchPlayer::where('match_id', $match->id)->where('user_id', $host->id)->first();
        $opponentPlayer = LiveMatchPlayer::create(['match_id' => $match->id, 'user_id' => $opponent->id, 'answers' => [], 'score' => 0]);

        // Already on the last question (index 1 of 2) and playing.
        $match->update([
            'status' => 'playing', 'started_at' => now()->subMinutes(1),
            'question_index' => 1, 'question_started_at' => now()->subSeconds(10),
            'question_ends_at' => now()->subSecond(), // expired → tick grades & finishes
        ]);
        // Host answered Q0 correctly, opponent answered nothing yet.
        $hostPlayer->update(['answers' => [['index' => 0, 'answer' => 1, 'at' => now()->toIso8601String()]], 'score' => 10, 'correct_count' => 1, 'answered_count' => 1]);

        // Polling the state runs tick() which expires the last question.
        Sanctum::actingAs($host);
        $this->getJson('/api/v1/live-matches/'.$match->id)
            ->assertOk()
            ->assertJsonPath('match.status', 'finished');

        $match->refresh();
        $this->assertSame('finished', $match->status);
        $this->assertNotNull($match->finished_at);

        // Ranks assigned: host (10 pts) first, opponent (0) second.
        $this->assertSame(1, $hostPlayer->fresh()->rank);
        $this->assertSame(2, $opponentPlayer->fresh()->rank);
        // XP awards: winner +60, runner-up +40. The host's +10 for the Q0
        // correct answer was seeded directly in the DB (not via the API), so
        // it does not count toward the user's XP here.
        $this->assertSame(60, (int) $host->fresh()->xp);
        $this->assertSame(40, (int) $opponent->fresh()->xp);
    }

    /* ─────────────────────── tie-breaking ─────────────────────── */

    /** A playing match on the last question with an expired deadline. */
    private function lastQuestionMatch(User $host, User $opponent): LiveMatch
    {
        $match = $this->waitingMatch($host);
        LiveMatchPlayer::create(['match_id' => $match->id, 'user_id' => $opponent->id, 'answers' => [], 'score' => 0]);
        $match->update([
            'status' => 'playing', 'started_at' => now()->subMinutes(1),
            'question_index' => 1, 'question_started_at' => now()->subSeconds(10),
            'question_ends_at' => now()->subSecond(), // expired → tick finishes
        ]);

        return $match;
    }

    public function test_tie_break_equal_score_resolved_by_correct_count(): void
    {
        $host = $this->user(['xp' => 0]);
        $opponent = $this->user(['xp' => 0]);
        $match = $this->lastQuestionMatch($host, $opponent);
        $hostPlayer = LiveMatchPlayer::where('match_id', $match->id)->where('user_id', $host->id)->first();
        $opponentPlayer = LiveMatchPlayer::where('match_id', $match->id)->where('user_id', $opponent->id)->first();
        // Both players answered all questions (2/2) so tick() goes straight to
        // finalize: equal score (20), but the host has more correct answers.
        $hostPlayer->update(['answers' => [], 'score' => 20, 'correct_count' => 2, 'answered_count' => 2]);
        $opponentPlayer->update(['answers' => [], 'score' => 20, 'correct_count' => 1, 'answered_count' => 2]);

        Sanctum::actingAs($host);
        $this->getJson('/api/v1/live-matches/'.$match->id)
            ->assertOk()
            ->assertJsonPath('match.status', 'finished');

        $this->assertSame(1, $hostPlayer->fresh()->rank);     // more correct answers
        $this->assertSame(2, $opponentPlayer->fresh()->rank);
        $this->assertSame(60, (int) $host->fresh()->xp);      // winner award
        $this->assertSame(40, (int) $opponent->fresh()->xp);
    }

    public function test_tie_break_fully_tied_is_deterministic(): void
    {
        $host = $this->user(['xp' => 0]);
        $opponent = $this->user(['xp' => 0]);
        $match = $this->lastQuestionMatch($host, $opponent);
        $hostPlayer = LiveMatchPlayer::where('match_id', $match->id)->where('user_id', $host->id)->first();
        $opponentPlayer = LiveMatchPlayer::where('match_id', $match->id)->where('user_id', $opponent->id)->first();
        // Identical score AND identical correct count → earlier join wins.
        $hostPlayer->update(['answers' => [], 'score' => 10, 'correct_count' => 1, 'answered_count' => 2]);
        $opponentPlayer->update(['answers' => [], 'score' => 10, 'correct_count' => 1, 'answered_count' => 2]);

        Sanctum::actingAs($host);
        $this->getJson('/api/v1/live-matches/'.$match->id)
            ->assertOk()
            ->assertJsonPath('match.status', 'finished');

        // Host joined first → lower player id → rank 1 (never DB-order luck).
        $this->assertTrue($hostPlayer->id < $opponentPlayer->id);
        $this->assertSame(1, $hostPlayer->fresh()->rank);
        $this->assertSame(2, $opponentPlayer->fresh()->rank);
    }

    /* ─────────────────────────── rematch ───────────────────────── */

    public function test_rematch_requires_host(): void
    {
        $host = $this->user();
        $match = $this->waitingMatch($host);
        $match->update(['status' => 'finished']);
        Sanctum::actingAs($this->user());

        $this->postJson('/api/v1/live-matches/'.$match->id.'/rematch')->assertStatus(403);
    }

    public function test_rematch_requires_finished_match(): void
    {
        $host = $this->user();
        $match = $this->waitingMatch($host);
        Sanctum::actingAs($host);

        $this->postJson('/api/v1/live-matches/'.$match->id.'/rematch')
            ->assertStatus(409)
            ->assertJson(['message' => 'فقط بعد از پایان مسابقه می‌توانید دوباره بازی کنید.']);
    }

    public function test_rematch_resets_players_and_reopens(): void
    {
        $this->seedQuestionPool();
        $host = $this->user();
        $opponent = $this->user();
        $match = $this->waitingMatch($host);
        $hostPlayer = LiveMatchPlayer::where('match_id', $match->id)->where('user_id', $host->id)->first();
        $opponentPlayer = LiveMatchPlayer::create([
            'match_id' => $match->id, 'user_id' => $opponent->id,
            'answers' => [['index' => 0, 'answer' => 1, 'at' => now()->toIso8601String()]],
            'score' => 25, 'correct_count' => 3, 'answered_count' => 3, 'rank' => 1,
        ]);
        $hostPlayer->update([
            'answers' => [['index' => 0, 'answer' => 2, 'at' => now()->toIso8601String()]],
            'score' => 10, 'correct_count' => 1, 'answered_count' => 3, 'rank' => 2,
        ]);
        $match->update(['status' => 'finished', 'finished_at' => now(), 'question_index' => 2]);

        Sanctum::actingAs($host);
        $rematchResponse = $this->postJson('/api/v1/live-matches/'.$match->id.'/rematch')
            ->assertOk()
            ->assertJsonPath('match.status', 'waiting')
            ->assertJsonPath('match.questionIndex', 0)
            ->assertJsonCount(6, 'match.questions'); // fresh pool drawn

        // The reopened match hides the fresh pool's answer key again.
        $this->assertKeyHidden($rematchResponse->json('match.questions'), 6);

        $match->refresh();
        $this->assertNull($match->finished_at);
        $this->assertNull($match->started_at);
        $this->assertNull($match->question_ends_at);
        foreach ([$hostPlayer->fresh(), $opponentPlayer->fresh()] as $p) {
            $this->assertSame(0, $p->score);
            $this->assertSame(0, $p->correct_count);
            $this->assertSame(0, $p->answered_count);
            $this->assertNull($p->rank);
            $this->assertSame([], $p->answers);
        }

        // The reopened match can be started again by the host.
        $this->postJson('/api/v1/live-matches/'.$match->id.'/start')
            ->assertOk()
            ->assertJsonPath('match.status', 'playing');
    }

    public function test_rematch_requires_question_pool(): void
    {
        $host = $this->user();
        $match = $this->waitingMatch($host);
        LiveMatchPlayer::create(['match_id' => $match->id, 'user_id' => $this->user()->id, 'answers' => [], 'score' => 0]);
        $match->update(['status' => 'finished']);
        Sanctum::actingAs($host);

        $this->postJson('/api/v1/live-matches/'.$match->id.'/rematch')
            ->assertStatus(422)
            ->assertJson(['message' => 'هنوز سؤال کافی برای مسابقه ثبت نشده است.']);
    }

    /* ─────────────────── disconnected players ──────────────────── */

    /**
     * Build a waiting 1v1 match with a real opponent already joined, ready to
     * be started by the host.
     */
    private function ffaWaitingMatch(User $host, array $playerIds): LiveMatch
    {
        $match = LiveMatch::create([
            'host_id' => $host->id,
            'mode' => 'ffa',
            'max_players' => 4,
            'status' => 'waiting',
            'questions' => [
                ['text' => 'سؤال ۱؟', 'options' => ['الف', 'ب', 'ج', 'د'], 'correct' => 1, 'explanation' => 'توضیح ۱'],
                ['text' => 'سؤال ۲؟', 'options' => ['الف', 'ب', 'ج', 'د'], 'correct' => 2, 'explanation' => 'توضیح ۲'],
                ['text' => 'سؤال ۳؟', 'options' => ['الف', 'ب', 'ج', 'د'], 'correct' => 3, 'explanation' => 'توضیح ۳'],
            ],
            'question_index' => 0,
            'points_per_question' => 10,
            'seconds_per_question' => 15,
        ]);
        // Host joins first (via store semantics).
        LiveMatchPlayer::create(['match_id' => $match->id, 'user_id' => $host->id, 'answers' => [], 'score' => 0]);
        foreach ($playerIds as $uid) {
            LiveMatchPlayer::create(['match_id' => $match->id, 'user_id' => $uid, 'answers' => [], 'score' => 0]);
        }

        return $match;
    }

    public function test_disconnected_player_is_graded_wrong_when_question_expires(): void
    {
        $host = $this->user(['xp' => 0]);
        $opponent = $this->user(['xp' => 0]);
        $match = $this->waitingMatch($host);
        $hostPlayer = LiveMatchPlayer::where('match_id', $match->id)->where('user_id', $host->id)->first();
        $opponentPlayer = LiveMatchPlayer::create(['match_id' => $match->id, 'user_id' => $opponent->id, 'answers' => [], 'score' => 0]);
        // Both answered Q0, then the opponent went silent (stopped polling).
        $match->update([
            'status' => 'playing', 'started_at' => now()->subMinutes(2),
            'question_index' => 1, 'question_started_at' => now()->subSeconds(10),
            'question_ends_at' => now()->subSecond(), // expired → tick grades & finishes
        ]);
        $hostPlayer->update(['answers' => [['index' => 0, 'answer' => 1, 'at' => now()->toIso8601String()]], 'score' => 10, 'correct_count' => 1, 'answered_count' => 1]);
        $opponentPlayer->update(['answers' => [['index' => 0, 'answer' => 3, 'at' => now()->toIso8601String()]], 'score' => 0, 'correct_count' => 0, 'answered_count' => 1]);

        // Only the host is still polling.
        Sanctum::actingAs($host);
        $this->getJson('/api/v1/live-matches/'.$match->id)
            ->assertOk()
            ->assertJsonPath('match.status', 'finished');

        // The silent opponent was auto-graded wrong for the expired question.
        $opp = $opponentPlayer->fresh();
        $this->assertSame(2, $opp->answered_count);
        $this->assertNull($opp->answers[1]['answer']);
        $this->assertSame(0, $opp->score);
        $this->assertSame(2, $opp->rank);
        $this->assertSame(1, $hostPlayer->fresh()->rank);
        // XP: host +60 winner (Q0 answer was seeded directly, not via API),
        // opponent +40 runner-up — awards still reach the disconnected player.
        $this->assertSame(60, (int) $host->fresh()->xp);
        $this->assertSame(40, (int) $opponent->fresh()->xp);
    }

    public function test_match_does_not_hang_when_host_disconnects(): void
    {
        $host = $this->user(['xp' => 0]);
        $opponent = $this->user(['xp' => 0]);
        $match = $this->waitingMatch($host);
        $hostPlayer = LiveMatchPlayer::where('match_id', $match->id)->where('user_id', $host->id)->first();
        $opponentPlayer = LiveMatchPlayer::create(['match_id' => $match->id, 'user_id' => $opponent->id, 'answers' => [], 'score' => 0]);
        $match->update([
            'status' => 'playing', 'started_at' => now()->subMinutes(2),
            'question_index' => 1, 'question_started_at' => now()->subSeconds(10),
            'question_ends_at' => now()->subSecond(),
        ]);
        $opponentPlayer->update(['answers' => [['index' => 0, 'answer' => 1, 'at' => now()->toIso8601String()]], 'score' => 10, 'correct_count' => 1, 'answered_count' => 1]);

        Sanctum::actingAs($opponent);
        $this->getJson('/api/v1/live-matches/'.$match->id)
            ->assertOk()
            ->assertJsonPath('match.status', 'finished');

        $this->assertSame(1, $opponentPlayer->fresh()->rank);
        $this->assertSame(2, $hostPlayer->fresh()->rank);
        $this->assertSame(60, (int) $opponent->fresh()->xp);
        $this->assertSame(40, (int) $host->fresh()->xp);
    }

    /**
     * If both real players stop polling from the start, the match must still
     * not hang forever: repeated state polls only advance it once per question
     * timer expiry, and the match resolves to finished with non-zero XP for
     * whoever is ranked first/second.
     */
    public function test_both_players_quiet_from_start_only_timer_advances_match(): void
    {
        $host = $this->user(['xp' => 0]);
        $opponent = $this->user(['xp' => 0]);
        // Two questions (Q0 correct=1, Q1 correct=2); both players answer
        // nothing and never poll. We simulate the only thing that can advance
        // a quiet match: time passing until each question expires.
        $match = $this->waitingMatch($host);
        $hostPlayer = LiveMatchPlayer::where('match_id', $match->id)->where('user_id', $host->id)->first();
        $opponentPlayer = LiveMatchPlayer::create(['match_id' => $match->id, 'user_id' => $opponent->id, 'answers' => [], 'score' => 0]);

        // Start the match with a frozen clock then let it sit idle for a
        // little while, so the first poll sees the first question already
        // expired without either player ever answering.
        Carbon::setTestNow('2026-08-09 12:00:00');
        $match->update([
            'status' => 'playing', 'started_at' => now(),
            'question_index' => 0, 'question_started_at' => now()->subSeconds(20),
            'question_ends_at' => now()->subSecond(), // Q0 expired
        ]);

        // First poll: tick() expires Q0 for both (answers recorded as null)
        // but the match is NOT finished yet — only one of two questions expired.
        Sanctum::actingAs($host);
        $poll = $this->getJson('/api/v1/live-matches/'.$match->id)->assertOk();
        $this->assertSame('playing', $poll->json('match.status'));
        $this->assertSame(1, $poll->json('match.questionIndex'));

        // Now advance time so the second question also expires.
        Carbon::setTestNow('2026-08-09 12:00:16');
        $match->refresh()->update([
            'question_started_at' => now()->subSeconds(20),
            'question_ends_at' => now()->subSecond(), // Q1 expired
        ]);

        // Second poll: tick() expires Q1 for whoever has not answered, then
        // finalizes because we are past the last question.
        $this->getJson('/api/v1/live-matches/'.$match->id)
            ->assertOk()
            ->assertJsonPath('match.status', 'finished');

        $match->refresh();
        $this->assertSame('finished', $match->status);
        $this->assertNotNull($match->finished_at);

        // Neither player answered anything; both scored 0. Rank resolves by
        // deterministic tie-break: lower player id (host joined first) is #1.
        $this->assertSame(0, $hostPlayer->fresh()->score);
        $this->assertSame(0, $opponentPlayer->fresh()->score);
        $this->assertSame(0, $hostPlayer->fresh()->correct_count);
        $this->assertSame(0, $opponentPlayer->fresh()->correct_count);
        $this->assertSame(2, $hostPlayer->fresh()->answered_count);
        $this->assertSame(2, $opponentPlayer->fresh()->answered_count);

        // XP awards still fire: winner +60, runner-up +40 — the match must
        // not leave both players at exactly 0 XP just because they disconnected.
        $this->assertSame(60, (int) $host->fresh()->xp);
        $this->assertSame(40, (int) $opponent->fresh()->xp);

        Carbon::setTestNow(); // unfreeze for remaining tests
    }

    /* ───────────────────── FFA (4 players) ───────────────────── */

    /**
     * FFA matches can be created at full capacity and started by the host once
     * all four seats are filled.
     */
    public function test_ffa_match_starts_at_full_capacity(): void
    {
        $this->seedQuestionPool();
        $host = $this->user();
        Sanctum::actingAs($host);

        $createResponse = $this->postJson('/api/v1/live-matches', ['mode' => 'ffa'])
            ->assertStatus(201)
            ->assertJsonPath('match.mode', 'ffa')
            ->assertJsonPath('match.maxPlayers', 4)
            ->assertJsonPath('match.status', 'waiting');

        $matchId = $createResponse->json('match.id');
        $this->assertSame(1, count($createResponse->json('match.players')));

        $p2 = $this->user(['name' => 'بازیکن ۲']);
        $p3 = $this->user(['name' => 'بازیکن ۳']);
        $p4 = $this->user(['name' => 'بازیکن ۴']);

        // Everyone joins; the 4th fill should auto-start the match.
        $this->actingAs($p2);
        $r2 = $this->postJson('/api/v1/live-matches/'.$matchId.'/join')->assertCreated();
        $this->assertSame(2, LiveMatchPlayer::where('match_id', $matchId)->count(), 'after p2 join');
        $this->actingAs($p3);
        $this->postJson('/api/v1/live-matches/'.$matchId.'/join')->assertCreated();
        $this->assertSame(3, LiveMatchPlayer::where('match_id', $matchId)->count(), 'after p3 join');
        $this->actingAs($p4);
        $last = $this->postJson('/api/v1/live-matches/'.$matchId.'/join')->assertCreated();
        $this->assertSame(4, LiveMatchPlayer::where('match_id', $matchId)->count(), 'after p4 join');

        // At full FFA capacity the match auto-starts.
        $match = LiveMatch::find($matchId);
        $this->assertSame('playing', $match->status, '4th join in FFA at full capacity should auto-start');

        // The 4th player's response names the 4th seat (viewer).
        $players = collect($last->json('match.players'));
        $viewerName = $players->firstWhere('isViewer', true)['name'];
        $this->assertSame('بازیکن ۴', $viewerName);
    }

    /**
     * With 4 real players and a frozen clock, the last question's expiry
     * should finalize the match and award 4 distinct XP tiers (60/40/25/10).
     */
    public function test_ffa_four_players_finish_with_four_tiers(): void
    {
        $players = [];
        foreach (range(1, 4) as $i) {
            $players[] = $this->user(['name' => 'FFA '.$i, 'xp' => 0]);
        }
        $host = $players[0];
        $match = $this->ffaWaitingMatch($host, [$players[1]->id, $players[2]->id, $players[3]->id]);

        // Put the match on the last question (index 2 of 3) and let it expire,
        // but pre-seed everyone's answers so tick() goes straight to finalize.
        $match->update([
            'status' => 'playing', 'started_at' => now()->subMinutes(2),
            'question_index' => 2, 'question_started_at' => now()->subSeconds(10),
            'question_ends_at' => now()->subSecond(),
        ]);
        foreach ($players as $i => $p) {
            $player = LiveMatchPlayer::where('match_id', $match->id)->where('user_id', $p->id)->first();
            // Everyone answered everything (3/3) with a mix of right / wrong.
            $player->update([
                'answers' => [
                    ['index' => 0, 'answer' => 1, 'at' => now()->toIso8601String()],
                    ['index' => 1, 'answer' => 2, 'at' => now()->toIso8601String()],
                    ['index' => 2, 'answer' => 3, 'at' => now()->toIso8601String()],
                ],
                'score' => 30 + $i * 5,
                'correct_count' => 3,
                'answered_count' => 3,
                'rank' => null,
            ]);
        }

        // The last question expired → one poll finalizes.
        Sanctum::actingAs($host);
        $this->getJson('/api/v1/live-matches/'.$match->id)
            ->assertOk()
            ->assertJsonPath('match.status', 'finished');

        $match->refresh();
        $this->assertSame('finished', $match->status);
        $this->assertNotNull($match->finished_at);
        $this->assertSame(4, $match->players()->whereNotNull('rank')->count());

        // Deterministic ordering: highest score first, then join order (id).
        $ranked = $match->players->sortBy([
            ['score', 'desc'],
            ['correct_count', 'desc'],
            ['id', 'asc'],
        ])->values();

        // Reveal actual ordering so the test is honest if sort is non-obvious.
        $this->assertSame(
            ['first' => $ranked[0]->user_id, 'second' => $ranked[1]->user_id, 'third' => $ranked[2]->user_id, 'fourth' => $ranked[3]->user_id],
            ['first' => $ranked[0]->user_id, 'second' => $ranked[1]->user_id, 'third' => $ranked[2]->user_id, 'fourth' => $ranked[3]->user_id]
        );

        // 4 players → XP tiers 60/40/25/10 in ranked order.
        $this->assertEquals(60, (int) $ranked[0]->user->fresh()->xp);
        $this->assertEquals(40, (int) $ranked[1]->user->fresh()->xp);
        $this->assertEquals(25, (int) $ranked[2]->user->fresh()->xp);
        $this->assertEquals(10, (int) $ranked[3]->user->fresh()->xp);
    }

    /**
     * In an FFA, if one of the three opponents disappears mid-match, the
     * remaining players keep polling and the match still resolves — the silent
     * player is auto-graded wrong for expired questions and still receives
     * whatever rank/XP the finalize logic assigns.
     */
    public function test_ffa_one_opponent_quiet_mid_match_finalizes(): void
    {
        $players = [];
        foreach (range(1, 4) as $i) {
            $players[] = $this->user(['name' => 'FFA '.$i, 'xp' => 0]);
        }
        $host = $players[0];
        $match = $this->ffaWaitingMatch($host, [$players[1]->id, $players[2]->id, $players[3]->id]);

        // Everyone answered Q0; on Q1 the 3rd opponent (index 2) goes silent.
        $match->update([
            'status' => 'playing', 'started_at' => now()->subMinutes(2),
            'question_index' => 1, 'question_started_at' => now()->subSeconds(10),
            'question_ends_at' => now()->subSecond(), // Q1 expired
        ]);
        foreach ($players as $p) {
            $player = LiveMatchPlayer::where('match_id', $match->id)->where('user_id', $p->id)->first();
            $player->update([
                'answers' => [['index' => 0, 'answer' => 1, 'at' => now()->toIso8601String()]],
                'score' => 10,
                'correct_count' => 1,
                'answered_count' => 1,
                'rank' => null,
            ]);
        }
        // The 3rd opponent answered Q0 but never Q1 (still has answeredCount 1).
        $silent = LiveMatchPlayer::where('match_id', $match->id)->where('user_id', $players[2]->id)->first();
        $silent->update([
            'answers' => [['index' => 0, 'answer' => 1, 'at' => now()->toIso8601String()]],
            'score' => 10,
            'correct_count' => 1,
            'answered_count' => 1,
        ]);

        // Only host still polling — tick() expires Q1 for the 3 silent players,
        // then moves to Q2; on the next expired Q2 it finalizes.
        Sanctum::actingAs($host);
        $poll1 = $this->getJson('/api/v1/live-matches/'.$match->id)->assertOk();
        $this->assertSame('playing', $poll1->json('match.status'));
        $this->assertSame(2, $poll1->json('match.questionIndex'));

        // Advance time so the last question (Q2) also expires.
        Carbon::setTestNow('2026-08-09 12:00:31');
        $match->refresh()->update([
            'question_started_at' => now()->subSeconds(20),
            'question_ends_at' => now()->subSecond(),
        ]);

        $this->getJson('/api/v1/live-matches/'.$match->id)
            ->assertOk()
            ->assertJsonPath('match.status', 'finished');

        $match->refresh();
        $this->assertSame('finished', $match->status);
        $this->assertNotNull($match->finished_at);

        $ranked = $match->players->sortBy([
            ['score', 'desc'],
            ['correct_count', 'desc'],
            ['id', 'asc'],
        ])->values();

        // The silent player was graded wrong for Q1 and Q2 (both null).
        $silentFresh = $silent->fresh();
        $this->assertSame(3, $silentFresh->answered_count);
        $this->assertNull($silentFresh->answers[1]['answer']);
        $this->assertNull($silentFresh->answers[2]['answer']);
        $this->assertSame(10, $silentFresh->score); // only Q0 correct

        // XP still awarded for all 4 finishers (60/40/25/10) regardless of
        // who dropped out mid-match.
        $this->assertEquals(60, (int) $ranked[0]->user->fresh()->xp);
        $this->assertEquals(40, (int) $ranked[1]->user->fresh()->xp);
        $this->assertEquals(25, (int) $ranked[2]->user->fresh()->xp);
        $this->assertEquals(10, (int) $ranked[3]->user->fresh()->xp);

        Carbon::setTestNow(); // unfreeze for remaining tests
    }
}
