<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiveMatchPlayer extends Model
{
    protected $fillable = ['match_id', 'user_id', 'answers', 'score', 'correct_count', 'answered_count', 'rank'];

    protected function casts(): array
    {
        return ['answers' => 'array', 'score' => 'integer', 'correct_count' => 'integer', 'answered_count' => 'integer', 'rank' => 'integer'];
    }

    public function match()
    {
        return $this->belongsTo(LiveMatch::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
