<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ShortVideo extends Model
{
    protected $fillable = ['id', 'title', 'creator', 'creator_role', 'category', 'description', 'video_path', 'poster_path', 'duration_seconds', 'tags', 'views', 'likes', 'status', 'featured'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected function casts(): array
    {
        return ['tags' => 'array', 'duration_seconds' => 'integer', 'views' => 'integer', 'likes' => 'integer', 'featured' => 'boolean'];
    }
}
