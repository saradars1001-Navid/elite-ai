<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiveMatch extends Model
{
    protected $fillable = ['host_id', 'mode', 'max_players', 'status', 'questions', 'question_index', 'points_per_question', 'seconds_per_question', 'question_started_at', 'question_ends_at', 'started_at', 'finished_at'];

    protected function casts(): array
    {
        return ['questions' => 'array', 'question_index' => 'integer', 'points_per_question' => 'integer', 'seconds_per_question' => 'integer', 'question_started_at' => 'datetime', 'question_ends_at' => 'datetime', 'started_at' => 'datetime', 'finished_at' => 'datetime'];
    }

    public function host()
    {
        return $this->belongsTo(User::class, 'host_id');
    }

    public function players()
    {
        // The FK column is match_id (not the inferred live_match_id).
        return $this->hasMany(LiveMatchPlayer::class, 'match_id');
    }
}
