<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PromptAttempt extends Model
{
    protected $fillable = ['user_id', 'scenario_id', 'prompt', 'score', 'max_score', 'criteria', 'tool_results'];

    protected function casts(): array
    {
        return ['criteria' => 'array', 'tool_results' => 'array'];
    }
}
