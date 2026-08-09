<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CommunityPost extends Model
{
    protected $fillable = ['user_id', 'category', 'title', 'body', 'tags', 'status', 'likes', 'comments_count'];

    protected function casts(): array
    {
        return ['tags' => 'array', 'likes' => 'integer', 'comments_count' => 'integer'];
    }

    public function author()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
