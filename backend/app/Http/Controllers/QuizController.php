<?php

namespace App\Http\Controllers;

use App\Models\Quiz;
use App\Models\QuizAttempt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class QuizController extends Controller
{
    public function show(Quiz $quiz): JsonResponse
    {
        abort_unless($quiz->status === 'published', 404);

        return response()->json(['quiz' => [...$quiz->load('questions')->toArray(), 'durationSeconds' => $quiz->duration_seconds, 'pointsPerQuestion' => $quiz->points_per_question]]);
    }

    public function submit(Request $request, Quiz $quiz): JsonResponse
    {
        abort_unless($quiz->status === 'published', 404);
        $data = $request->validate(['answers' => ['required', 'array'], 'durationSeconds' => ['nullable', 'integer', 'min:0']]);
        $questions = $quiz->questions()->get();
        $answers = array_values($data['answers']);
        $correct = 0;
        foreach ($questions as $index => $question) {
            if (isset($answers[$index]) && (int) $answers[$index] === (int) $question->correct) {
                $correct++;
            }
        }
        $total = $questions->count() * $quiz->points_per_question;
        $score = $correct * $quiz->points_per_question;
        $attempt = DB::transaction(function () use ($request, $quiz, $score, $total, $correct, $data) {
            $attempt = QuizAttempt::create(['user_id' => $request->user()->id, 'quiz_id' => $quiz->id, 'score' => $score, 'total' => $total, 'correct_count' => $correct, 'duration_seconds' => $data['durationSeconds'] ?? null, 'answers' => $data['answers']]);
            $request->user()->increment('xp', $score);
            $request->user()->increment('points', $score);

            return $attempt;
        });

        return response()->json(['attempt' => $attempt, 'score' => $score, 'total' => $total, 'correct' => $correct]);
    }

    public function leaderboard(Quiz $quiz): JsonResponse
    {
        $rows = QuizAttempt::with('user:id,name,xp')->where('quiz_id', $quiz->id)->select('user_id', DB::raw('MAX(score) as score'), DB::raw('MAX(created_at) as last_attempt'))->groupBy('user_id')->orderByDesc('score')->limit(50)->get();

        return response()->json(['leaderboard' => $rows]);
    }
}
