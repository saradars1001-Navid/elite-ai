<?php

namespace App\Http\Controllers;

use App\Models\PromptAttempt;
use App\Models\PromptScenario;
use App\Models\PromptTool;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PromptLabController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['promptTools' => PromptTool::orderBy('created_at')->get(), 'promptScenarios' => PromptScenario::where('status', 'published')->orderBy('created_at')->get()]);
    }

    public function submit(Request $request): JsonResponse
    {
        $data = $request->validate(['scenarioId' => ['required', 'exists:prompt_scenarios,id'], 'prompt' => ['required', 'string', 'max:10000'], 'maxScore' => ['nullable', 'integer', 'min:1', 'max:1000'], 'criteria' => ['nullable', 'array'], 'toolResults' => ['nullable', 'array']]);
        $prompt = trim($data['prompt']);
        $score = min((int) ($data['maxScore'] ?? 100), 10 + min(40, mb_strlen($prompt) / 8) + (preg_match('/[.!؟،]/u', $prompt) ? 15 : 0) + (preg_match('/\b(?:هدف|مخاطب|فرمت|لحن|role|format)\b/u', $prompt) ? 25 : 0));
        $attempt = PromptAttempt::create(['user_id' => $request->user()->id, 'scenario_id' => $data['scenarioId'], 'prompt' => $prompt, 'score' => (int) $score, 'max_score' => (int) ($data['maxScore'] ?? 100), 'criteria' => $data['criteria'] ?? [], 'tool_results' => $data['toolResults'] ?? []]);
        $request->user()->increment('xp', (int) $score);
        $request->user()->increment('points', (int) $score);

        return response()->json(['attempt' => $attempt, 'score' => (int) $score], 201);
    }
}
