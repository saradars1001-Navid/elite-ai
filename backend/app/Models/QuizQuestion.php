<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuizQuestion extends Model
{
    protected $fillable = ['id', 'quiz_id', 'text', 'options', 'correct', 'explanation', 'position'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected function casts(): array
    {
        return ['options' => 'array', 'correct' => 'integer', 'position' => 'integer'];
    }

    public function quiz()
    {
        return $this->belongsTo(Quiz::class);
    }
}
