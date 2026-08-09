<?php

namespace Tests\Feature;

use App\Models\LiveMatch;
use App\Models\LiveMatchPlayer;
use App\Models\Quiz;
use App\Models\QuizQuestion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
                ['text' => 'سؤال ۱؟', 'options' => ['الف', 'ب', 'ج', 'د'], 'correct' => 1],
                ['text' => 'سؤال ۲؟', 'options' => ['الف', 'ب', 'ج', 'د'], 'correct' => 2],
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

        $this->postJson('/api/v1/live-matches', ['mode' => '1v1'])
            ->assertStatus(201)
            ->assertJsonPath('match.mode', '1v1')
            ->assertJsonPath('match.maxPlayers', 2)
            ->assertJsonPath('match.status', 'waiting')
            ->assertJsonCount(6, 'match.questions')
            ->assertJsonCount(1, 'match.players')
            ->assertJsonPath('match.players.0.name', 'میزبان');

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
}
