<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuizAttempt extends Model
{
    protected $fillable = ['user_id', 'quiz_id', 'score', 'total', 'correct_count', 'duration_seconds', 'answers', 'created_at'];

    protected function casts(): array
    {
        return ['score' => 'integer', 'total' => 'integer', 'correct_count' => 'integer', 'duration_seconds' => 'integer', 'answers' => 'array'];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function quiz()
    {
        return $this->belongsTo(Quiz::class);
    }
}
