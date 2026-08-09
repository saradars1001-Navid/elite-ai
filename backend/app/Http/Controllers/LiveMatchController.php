<?php

namespace App\Http\Controllers;

use App\Models\LiveMatch;
use App\Models\LiveMatchPlayer;
use App\Models\Quiz;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LiveMatchController extends Controller
{
    /** Create a new live match; the creator joins as the first player. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['mode' => ['required', 'in:1v1,ffa']]);
        $mode = $data['mode'];
        $questions = $this->questionPool();
        if (count($questions) < 3) {
            return response()->json(['message' => 'هنوز سؤال کافی برای مسابقه ثبت نشده است.'], 422);
        }

        $match = DB::transaction(function () use ($request, $mode, $questions) {
            $max = $mode === '1v1' ? 2 : 4;
            $match = LiveMatch::create([
                'host_id' => $request->user()->id,
                'mode' => $mode,
                'max_players' => $max,
                'status' => 'waiting',
                'questions' => $questions,
                'question_index' => 0,
                'points_per_question' => 10,
                'seconds_per_question' => 15,
            ]);
            LiveMatchPlayer::create(['match_id' => $match->id, 'user_id' => $request->user()->id, 'answers' => [], 'score' => 0]);

            return $match;
        });

        return response()->json(['match' => $this->serialize($match, $request->user()->id)], 201);
    }

    /** List matches waiting for real players so users can join them. */
    public function lobby(): JsonResponse
    {
        $matches = LiveMatch::where('status', 'waiting')->withCount('players')->orderBy('created_at')->limit(20)->get();

        return response()->json(['matches' => $matches->map(fn ($m) => [
            'id' => $m->id, 'mode' => $m->mode, 'maxPlayers' => $m->max_players, 'players' => $m->players_count,
            'host' => $m->host?->name ?? 'کاربر', 'createdAt' => $m->created_at->toIso8601String(),
        ])]);
    }

    /** Join an existing waiting match (real user versus real user). */
    public function join(Request $request, LiveMatch $match): JsonResponse
    {
        if ($match->status !== 'waiting') {
            return response()->json(['message' => 'این مسابقه در حال برگزاری است.'], 409);
        }
        if (LiveMatchPlayer::where('match_id', $match->id)->where('user_id', $request->user()->id)->exists()) {
            return response()->json(['match' => $this->serialize($match, $request->user()->id)]);
        }
        if (LiveMatchPlayer::where('match_id', $match->id)->count() >= $match->max_players) {
            return response()->json(['message' => 'ظرفیت مسابقه تکمیل شده است.'], 422);
        }

        $player = DB::transaction(function () use ($request, $match) {
            $player = LiveMatchPlayer::create(['match_id' => $match->id, 'user_id' => $request->user()->id, 'answers' => [], 'score' => 0]);
            if (LiveMatchPlayer::where('match_id', $match->id)->count() >= $match->max_players) {
                $this->start($match);
            }

            return $player;
        });

        return response()->json(['match' => $this->serialize($match->refresh(), $request->user()->id)], 201);
    }

    /** Host starts the match once there is at least one opponent. */
    public function startMatch(Request $request, LiveMatch $match): JsonResponse
    {
        abort_unless($match->host_id === $request->user()->id, 403);
        if ($match->status !== 'waiting') {
            return response()->json(['match' => $this->serialize($match, $request->user()->id)]);
        }
        if (LiveMatchPlayer::where('match_id', $match->id)->count() < 2) {
            return response()->json(['message' => 'برای شروع حداقل یک رقیب لازم است.'], 422);
        }
        $this->start($match);

        return response()->json(['match' => $this->serialize($match->refresh(), $request->user()->id)]);
    }

    /** Poll the live match state; auto-advances/finishes expired questions. */
    public function state(Request $request, LiveMatch $match): JsonResponse
    {
        abort_unless(LiveMatchPlayer::where('match_id', $match->id)->where('user_id', $request->user()->id)->exists(), 403);
        $this->tick($match);

        return response()->json(['match' => $this->serialize($match->refresh(), $request->user()->id)]);
    }

    /** Submit an answer; graded server-side with a speed bonus. */
    public function answer(Request $request, LiveMatch $match): JsonResponse
    {
        $player = LiveMatchPlayer::where('match_id', $match->id)->where('user_id', $request->user()->id)->firstOrFail();
        if ($match->status !== 'playing') {
            return response()->json(['message' => 'مسابقه در حال برگزاری نیست.'], 409);
        }
        $data = $request->validate(['answer' => ['required', 'integer', 'min:0', 'max:10'], 'questionIndex' => ['required', 'integer', 'min:0']]);
        $this->tick($match);
        if ($match->status !== 'playing') {
            return response()->json(['match' => $this->serialize($match, $request->user()->id)]);
        }

        $questions = $match->questions ?? [];
        if ($data['questionIndex'] !== (int) $match->question_index || ! isset($questions[$data['questionIndex']])) {
            return response()->json(['message' => 'سؤال به‌روز نیست. وضعیت را دوباره دریافت کنید.'], 409);
        }
        $answered = collect($player->answers ?? [])->filter(fn ($a) => (int) $a['index'] === (int) $match->question_index)->count();
        if ($answered > 0) {
            return response()->json(['match' => $this->serialize($match, $request->user()->id)]);
        }

        $question = $questions[(int) $match->question_index];
        $correct = (int) $data['answer'] === (int) $question['correct'];
        $base = (int) $match->points_per_question;
        $speed = 0;
        $endsAt = $match->question_ends_at ? $match->question_ends_at->getTimestamp() : now()->addSeconds(15)->getTimestamp();
        if ($correct && $endsAt > now()->getTimestamp()) {
            $ratio = ($endsAt - now()->getTimestamp()) / max(1, $endsAt - $match->question_started_at?->getTimestamp());
            $speed = (int) round($base * 0.3 * max(0, $ratio));
        }
        $answers = $player->answers ?? [];
        $answers[] = ['index' => (int) $match->question_index, 'answer' => (int) $data['answer'], 'at' => now()->toIso8601String()];
        $request->user()->increment('xp', $correct ? (int) $match->points_per_question : 0);
        $request->user()->increment('points', $correct ? (int) $match->points_per_question : 0);
        $player->update([
            'answers' => $answers,
            'score' => $player->score + ($correct ? $base + $speed : 0),
            'correct_count' => $player->correct_count + ($correct ? 1 : 0),
            'answered_count' => $player->answered_count + 1,
        ]);
        $this->tick($match);

        return response()->json(['match' => $this->serialize($match->refresh(), $request->user()->id)]);
    }

    /* ──────────────────────── internals ──────────────────────── */

    private function questionPool(): array
    {
        $questions = Quiz::where('status', 'published')->with('questions')->get()->flatMap(fn ($q) => $q->questions)->map(fn ($qq) => ['text' => $qq->text, 'options' => $qq->options, 'correct' => $qq->correct, 'explanation' => $qq->explanation ?? ''])->shuffle()->take(6)->values()->all();

        return $questions;
    }

    private function start(LiveMatch $match): void
    {
        if ($match->status !== 'waiting') {
            return;
        }
        $now = now();
        $match->update(['status' => 'playing', 'started_at' => $now, 'question_index' => 0, 'question_started_at' => $now, 'question_ends_at' => $now->copy()->addSeconds((int) $match->seconds_per_question)]);
        foreach ($match->players as $player) {
            $player->update(['answers' => [], 'score' => 0, 'correct_count' => 0, 'answered_count' => 0]);
        }
    }

    private function tick(LiveMatch $match): void
    {
        if ($match->status !== 'playing') {
            return;
        }
        $questions = $match->questions ?? [];
        $deadline = $match->question_ends_at?->getTimestamp();
        $allAnswered = $match->players->count() > 0 && $match->players->every(fn ($p) => (int) $p->answered_count >= (int) $match->question_index + 1);

        if ($allAnswered || ($deadline && now()->getTimestamp() >= $deadline)) {
            // Grade the expired question as wrong for anyone who did not answer.
            $qi = (int) $match->question_index;
            foreach ($match->players as $player) {
                if ((int) $player->answered_count < $qi + 1) {
                    $answers = $player->answers ?? [];
                    $answers[] = ['index' => $qi, 'answer' => null, 'at' => now()->toIso8601String()];
                    $player->update(['answers' => $answers, 'answered_count' => $player->answered_count + 1]);
                }
            }
            $match->refresh();
            $next = (int) $match->question_index + 1;
            if ($next >= count($questions)) {
                $match->update(['status' => 'finished', 'finished_at' => now()]);
                $this->finalize($match);
            } else {
                $now = now();
                $match->update(['question_index' => $next, 'question_started_at' => $now, 'question_ends_at' => $now->copy()->addSeconds((int) $match->seconds_per_question)]);
            }
        }
    }

    private function finalize(LiveMatch $match): void
    {
        $ranked = $match->players->sortByDesc('score')->values();
        foreach ($ranked as $i => $player) {
            $player->update(['rank' => $i + 1]);
        }
        $players = $ranked->values();
        foreach ($players as $i => $player) {
            $user = $player->user()->first();
            if (! $user) {
                continue;
            }
            $xpGain = $i === 0 ? 60 : ($i === 1 ? 40 : ($i === 2 ? 25 : 10));
            $user->increment('xp', $xpGain);
            $user->increment('points', $xpGain);
        }
    }

    private function serialize(LiveMatch $match, string $viewerId): array
    {
        $players = $match->players()->with('user:id,name')->get()->map(fn ($p) => [
            'id' => $p->user_id, 'name' => $p->user?->name ?? 'کاربر', 'score' => $p->score, 'correct' => $p->correct_count,
            'answeredCount' => $p->answered_count, 'rank' => $p->rank, 'isViewer' => (string) $p->user_id === (string) $viewerId,
        ])->values();

        return [
            'id' => $match->id, 'mode' => $match->mode, 'maxPlayers' => $match->max_players, 'status' => $match->status,
            'hostId' => $match->host_id, 'questions' => $match->questions, 'questionIndex' => (int) $match->question_index,
            'pointsPerQuestion' => (int) $match->points_per_question, 'secondsPerQuestion' => (int) $match->seconds_per_question,
            'questionEndsAt' => $match->question_ends_at?->toIso8601String(), 'players' => $players,
        ];
    }
}
