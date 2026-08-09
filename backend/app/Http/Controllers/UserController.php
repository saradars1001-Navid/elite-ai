<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        if (mb_strlen($q) < 2) {
            // Empty query = live-match queue: return the most active real users.
            return response()->json(['users' => User::where('status', 'active')->orderByDesc('xp')->limit(30)->get(['id', 'name', 'role', 'xp', 'points', 'streak_days'])]);
        }
        $like = '%'.addcslashes($q, '%_').'%';
        $users = User::query()->where('status', 'active')->where('id', '!=', $request->user()->id)->where(fn ($query) => $query->where('name', 'like', $like)->orWhere('phone', 'like', $like))->orderByDesc('xp')->limit(20)->get(['id', 'name', 'role', 'xp', 'points', 'streak_days']);

        return response()->json(['users' => $users]);
    }

    public function leaderboard(): JsonResponse
    {
        return response()->json(['users' => User::where('status', 'active')->orderByDesc('xp')->limit(50)->get(['id', 'name', 'xp', 'points', 'streak_days'])]);
    }
}
