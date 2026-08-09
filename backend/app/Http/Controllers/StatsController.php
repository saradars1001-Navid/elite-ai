<?php

namespace App\Http\Controllers;

use App\Models\Chapter;
use App\Models\Purchase;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Real-time admin statistics. All numbers are computed server-side from MySQL
 * so the dashboard is never a static mock — sales, user progress and quiz
 * performance reflect actual platform activity.
 */
class StatsController extends Controller
{
    /** Aggregate everything the admin dashboard needs in one authenticated call. */
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'sales' => $this->sales(),
            'progress' => $this->progress(),
            'quizzes' => $this->quizzes(),
        ]);
    }

    /* ────────────────────────────── sales ────────────────────────────── */

    private function sales(): array
    {
        $paid = Purchase::where('status', 'paid');
        $byStatus = Purchase::selectRaw('status, COUNT(*) as count, COALESCE(SUM(price),0) as total')
            ->groupBy('status')->get()->keyBy('status');

        $daily = Purchase::where('status', 'paid')
            ->where('created_at', '>=', now()->subDays(14)->startOfDay())
            ->selectRaw('DATE(created_at) as d, COUNT(*) as count, COALESCE(SUM(price),0) as total')
            ->groupBy('d')->orderBy('d')->get()
            ->map(fn ($r) => ['date' => (string) $r->d, 'count' => (int) $r->count, 'total' => (int) $r->total]);

        $recent = Purchase::with(['chapter:id,title,icon', 'user:id,name'])
            ->latest()->limit(8)->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'receiptId' => $p->receipt_id,
                'chapterTitle' => $p->chapter?->title ?? '—',
                'userName' => $p->user?->name ?? '—',
                'price' => (int) $p->price,
                'status' => $p->status,
                'createdAt' => $p->created_at?->toIso8601String(),
            ]);

        return [
            'revenue' => (int) $paid->sum('price'),
            'baseRevenue' => (int) Purchase::where('status', 'paid')->sum('base_price'),
            'orders' => (int) Purchase::count(),
            'paidOrders' => (int) ($byStatus['paid']->count ?? 0),
            'pendingOrders' => (int) ($byStatus['pending']->count ?? 0),
            'failedOrders' => (int) ($byStatus['failed']->count ?? 0),
            'refundedOrders' => (int) ($byStatus['refunded']->count ?? 0),
            'avgOrder' => $paid->count() > 0 ? (int) round($paid->sum('price') / $paid->count()) : 0,
            'daily' => $daily,
            'recent' => $recent,
        ];
    }

    /* ───────────────────────────── progress ──────────────────────────── */

    private function progress(): array
    {
        $users = User::where('status', 'active');
        $totalUsers = (int) $users->count();

        // Learners who completed at least one lesson in this chapter.
        $chapterLearners = DB::table('lesson_progress')
            ->where('completed', true)
            ->join('lessons', 'lessons.id', '=', 'lesson_progress.lesson_id')
            ->selectRaw('lessons.chapter_id, COUNT(DISTINCT lesson_progress.user_id) as learners')
            ->groupBy('lessons.chapter_id')->get()->keyBy('chapter_id');

        $perChapter = Chapter::withCount(['lessons' => fn ($q) => $q->where('free', false)])
            ->orderBy('index')->get()
            ->map(function (Chapter $c) use ($chapterLearners, $totalUsers) {
                $learners = (int) ($chapterLearners[$c->id]->learners ?? 0);
                $rate = $totalUsers > 0 ? (int) round($learners / $totalUsers * 100) : 0;

                return [
                    'id' => $c->id,
                    'index' => (int) $c->index,
                    'title' => $c->title,
                    'icon' => $c->icon,
                    'free' => (bool) $c->free,
                    'learners' => $learners,
                    'completionRate' => $rate,
                ];
            });

        $topLearners = User::where('status', 'active')->orderByDesc('xp')->limit(5)->get()
            ->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'xp' => (int) $u->xp, 'streak' => (int) $u->streak_days]);

        return [
            'users' => $totalUsers,
            'activeUsers' => $totalUsers,
            'newUsers30d' => (int) User::where('created_at', '>=', now()->subDays(30))->count(),
            'completedLessons' => (int) DB::table('lesson_progress')->where('completed', true)->count(),
            'distinctLearners' => (int) DB::table('lesson_progress')->where('completed', true)->distinct('user_id')->count('user_id'),
            'avgXp' => (int) round(User::avg('xp') ?? 0),
            'streakHolders' => (int) User::where('streak_days', '>=', 3)->count(),
            'perChapter' => $perChapter,
            'topLearners' => $topLearners,
        ];
    }

    /* ───────────────────────────── quizzes ───────────────────────────── */

    private function quizzes(): array
    {
        $attempts = QuizAttempt::query();

        $perQuiz = Quiz::with('attempts')->where('status', 'published')->get()
            ->map(function (Quiz $q) {
                $rows = $q->attempts;
                $total = $rows->count();
                $avgPct = $total > 0
                    ? (int) round($rows->avg(fn ($a) => $a->total > 0 ? $a->score / $a->total * 100 : 0))
                    : 0;

                return [
                    'id' => $q->id,
                    'title' => $q->title,
                    'kind' => $q->kind,
                    'difficulty' => $q->difficulty,
                    'attempts' => $total,
                    'avgScore' => $avgPct,
                    'bestScore' => $total > 0 ? (int) $rows->max(fn ($a) => $a->total > 0 ? round($a->score / $a->total * 100) : 0) : 0,
                ];
            })->values();

        $daily = QuizAttempt::where('created_at', '>=', now()->subDays(14)->startOfDay())
            ->selectRaw('DATE(created_at) as d, COUNT(*) as count')
            ->groupBy('d')->orderBy('d')->get()
            ->map(fn ($r) => ['date' => (string) $r->d, 'count' => (int) $r->count]);

        $all = $attempts->get();
        $count = $all->count();
        $avgPct = $count > 0 ? (int) round($all->avg(fn ($a) => $a->total > 0 ? $a->score / $a->total * 100 : 0)) : 0;
        $passed = $all->filter(fn ($a) => $a->total > 0 && ($a->score / $a->total * 100) >= 70)->count();

        $topScorers = QuizAttempt::with('user:id,name')->latest('score')->limit(5)->get()
            ->map(fn ($a) => [
                'name' => $a->user?->name ?? '—',
                'score' => (int) $a->score,
                'total' => (int) $a->total,
                'pct' => $a->total > 0 ? (int) round($a->score / $a->total * 100) : 0,
            ]);

        return [
            'attempts' => $count,
            'avgScore' => $avgPct,
            'passRate' => $count > 0 ? (int) round($passed / $count * 100) : 0,
            'perQuiz' => $perQuiz,
            'daily' => $daily,
            'topScorers' => $topScorers,
        ];
    }
}
