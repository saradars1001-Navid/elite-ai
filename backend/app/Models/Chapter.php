<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Chapter extends Model
{
    protected $fillable = ['id', 'index', 'title', 'subtitle', 'description', 'level', 'instructor_name', 'instructor_role', 'duration_minutes', 'price', 'old_price', 'free', 'preview_count', 'icon', 'gradient', 'prerequisites', 'outcome'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected function casts(): array
    {
        return ['free' => 'boolean', 'prerequisites' => 'array', 'outcome' => 'array'];
    }

    public function lessons()
    {
        return $this->hasMany(Lesson::class)->orderBy('index');
    }

    public function exam()
    {
        return $this->hasOne(Exam::class, 'chapter_id');
    }

    public function quizzes()
    {
        return $this->hasMany(Quiz::class);
    }

    public function purchases()
    {
        return $this->hasMany(Purchase::class);
    }
}
