<?php

namespace Tests\Feature;

use App\Models\PromptAttempt;
use App\Models\PromptScenario;
use App\Models\PromptTool;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Prompt lab: listing published scenarios + tools and the server-side prompt
 * scoring engine (length, punctuation, role/format keywords) with XP awards.
 */
class PromptLabTest extends TestCase
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

    private function scenario(string $id, string $status = 'published'): PromptScenario
    {
        return PromptScenario::create([
            'id' => $id,
            'title' => 'سناریوی پرامپت',
            'description' => 'توضیح سناریو',
            'category' => 'تصویر',
            'task_type' => 'generate_image',
            'tool_ids' => ['tool-1'],
            'sample_prompt' => 'مثال',
            'goal' => 'هدف',
            'time_seconds' => 60,
            'points' => 100,
            'status' => $status,
        ]);
    }

    public function test_index_lists_published_scenarios_and_tools(): void
    {
        $this->scenario('sc-1', 'published');
        $this->scenario('sc-2', 'draft');
        PromptTool::create(['id' => 'tool-1', 'name' => 'میجوی', 'category' => 'تصویر']);

        $this->getJson('/api/v1/prompt-lab')->assertOk()
            ->assertJsonCount(1, 'promptScenarios')
            ->assertJsonCount(1, 'promptTools')
            ->assertJsonPath('promptScenarios.0.id', 'sc-1');
    }

    public function test_submit_scores_prompt_and_awards_xp(): void
    {
        $user = $this->user();
        $this->scenario('sc-submit');
        Sanctum::actingAs($user);

        // Rich prompt: long, punctuated, and mentions هدف/فرمت → near max score.
        $this->postJson('/api/v1/prompt-lab/attempts', [
            'scenarioId' => 'sc-submit',
            'prompt' => 'یک تصویر سینمایی از یک ربات کنار دریا بساز. هدف: حس آرامش. فرمت: 4K.',
            'criteria' => [['key' => 'وضوح', 'score' => 8]],
            'toolResults' => [['tool' => 'میجوی', 'ok' => true]],
        ])->assertStatus(201)
            ->assertJsonStructure(['attempt' => ['id', 'scenario_id', 'score'], 'score'])
            ->assertJsonPath('attempt.max_score', 100);

        $attempt = PromptAttempt::first();
        $this->assertNotNull($attempt);
        $this->assertGreaterThanOrEqual(50, $attempt->score);
        $this->assertSame((int) $attempt->score, (int) $user->fresh()->xp);
        $this->assertNotEmpty($attempt->criteria);
        $this->assertNotEmpty($attempt->tool_results);
    }

    public function test_submit_requires_valid_scenario(): void
    {
        Sanctum::actingAs($this->user());

        $this->postJson('/api/v1/prompt-lab/attempts', ['scenarioId' => 'nope', 'prompt' => 'متن'])
            ->assertStatus(422);

        $this->assertSame(0, PromptAttempt::count());
    }

    public function test_submit_score_is_capped_by_max_score(): void
    {
        $user = $this->user();
        $this->scenario('sc-cap');
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/prompt-lab/attempts', [
            'scenarioId' => 'sc-cap',
            'prompt' => 'پرامپت بسیار بلند و کامل با هدف، مخاطب و فرمت مشخص که امتیازش از سقف بیشتر میشود.',
            'maxScore' => 10,
        ])->assertStatus(201)->assertJsonPath('score', 10);

        $this->assertSame(10, (int) $user->fresh()->xp);
    }
}
