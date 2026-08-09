<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TrendingPrompt extends Model
{
    protected $fillable = ['id', 'title', 'prompt', 'category', 'tool', 'author', 'description', 'tags', 'uses', 'likes', 'status', 'featured'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected function casts(): array
    {
        return ['tags' => 'array', 'uses' => 'integer', 'likes' => 'integer', 'featured' => 'boolean'];
    }
}
