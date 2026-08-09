<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Exam extends Model
{
    protected $fillable = ['id', 'chapter_id', 'title', 'duration_minutes', 'pass_score'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected function casts(): array
    {
        return ['duration_minutes' => 'integer', 'pass_score' => 'integer'];
    }

    public function chapter()
    {
        return $this->belongsTo(Chapter::class);
    }

    public function questions()
    {
        return $this->hasMany(ExamQuestion::class)->orderBy('created_at');
    }
}
