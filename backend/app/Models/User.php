<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    // users.id is a UUID primary key (see migrations), so the id must be
    // mass-assignable and the model must not auto-increment a numeric key.
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'name', 'phone', 'role', 'points', 'xp', 'streak_days', 'last_active_date', 'status', 'wallet_balance'];

    protected $hidden = ['remember_token'];

    protected function casts(): array
    {
        return ['last_active_date' => 'date', 'points' => 'integer', 'xp' => 'integer', 'streak_days' => 'integer', 'wallet_balance' => 'integer'];
    }

    public function hasRole(string $role): bool
    {
        return $this->role === $role;
    }

    public function quizAttempts()
    {
        return $this->hasMany(QuizAttempt::class);
    }

    public function communityPosts()
    {
        return $this->hasMany(CommunityPost::class);
    }

    public function walletTransactions()
    {
        return $this->hasMany(WalletTransaction::class)->latest();
    }
}
