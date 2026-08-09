<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Quiz extends Model
{
    protected $fillable = ['id', 'kind', 'title', 'category', 'difficulty', 'duration_seconds', 'points_per_question', 'status', 'starts_at', 'ends_at'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected function casts(): array
    {
        return ['duration_seconds' => 'integer', 'points_per_question' => 'integer', 'starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }

    public function questions()
    {
        return $this->hasMany(QuizQuestion::class)->orderBy('position');
    }

    public function attempts()
    {
        return $this->hasMany(QuizAttempt::class);
    }
}
