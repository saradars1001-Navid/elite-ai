<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PromptScenario extends Model
{
    protected $fillable = ['id', 'title', 'description', 'category', 'task_type', 'tool_ids', 'sample_prompt', 'goal', 'time_seconds', 'points', 'status'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected function casts(): array
    {
        return ['tool_ids' => 'array', 'time_seconds' => 'integer', 'points' => 'integer'];
    }
}
