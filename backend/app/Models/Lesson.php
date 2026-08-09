<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Lesson extends Model
{
    protected $fillable = ['id', 'chapter_id', 'index', 'title', 'kind', 'duration', 'summary', 'content', 'captions', 'video_path', 'free'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected function casts(): array
    {
        return ['content' => 'array', 'captions' => 'array', 'free' => 'boolean'];
    }

    public function chapter()
    {
        return $this->belongsTo(Chapter::class);
    }
}
