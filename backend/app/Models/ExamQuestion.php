<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExamQuestion extends Model
{
    protected $fillable = ['id', 'exam_id', 'text', 'options', 'correct', 'topic'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected function casts(): array
    {
        return ['options' => 'array', 'correct' => 'integer'];
    }

    public function exam()
    {
        return $this->belongsTo(Exam::class);
    }
}
