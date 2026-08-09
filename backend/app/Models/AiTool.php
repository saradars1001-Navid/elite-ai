<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiTool extends Model
{
    protected $fillable = ['id', 'name', 'tagline', 'description', 'category', 'use_cases', 'level', 'pricing', 'languages', 'url', 'rating', 'reviews', 'related_lessons', 'reviewed_at', 'is_new'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected function casts(): array
    {
        return ['use_cases' => 'array', 'languages' => 'array', 'related_lessons' => 'array', 'rating' => 'float', 'reviews' => 'integer', 'is_new' => 'boolean'];
    }
}
