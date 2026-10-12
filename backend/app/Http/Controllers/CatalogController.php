<?php

namespace App\Http\Controllers;

use App\Models\AiTool;
use App\Models\Chapter;
use App\Models\CommunityPost;
use App\Models\Purchase;
use App\Models\Quiz;
use App\Models\ShortVideo;
use App\Models\TrendingPrompt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CatalogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // quizzes live in their own table (no chapter_id FK), so they are
        // fetched separately below; chapters only eager-load their lessons.
        $chapters = Chapter::with(['lessons', 'exam.questions'])->orderBy('index')->get();
        // The catalog is public, but a signed-in buyer must still be recognised
        // so their paid chapters keep their lesson content. The optional route
        // has no auth middleware, so the bearer token is resolved by hand here.
        $viewer = $request->user() ?? auth('sanctum')->user();
        $paidChapterIds = $viewer ?
            Purchase::where('user_id', $viewer->id)->where('status', 'paid')->pluck('chapter_id')->flip()->toArray() : [];
        $quizzes = Quiz::with('questions')->where('status', 'published')->latest()->get();
        $tools = AiTool::orderBy('name')->get();

        return response()->json(['chapters' => $chapters->map(fn ($c) => $this->chapter($c, (bool) ($c->free || ($viewer && ($viewer->role === 'admin' || isset($paidChapterIds[$c->id])))))), 'quizzes' => $quizzes->map(fn ($q) => $this->quiz($q)), 'aiTools' => $tools]);
    }

    public function discovery(): JsonResponse
    {
        return response()->json([
            'shortVideos' => ShortVideo::where('status', 'published')->latest()->get(),
            'trendingPrompts' => TrendingPrompt::where('status', 'published')->latest()->get(),
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        if (mb_strlen($q) < 2) {
            return response()->json(['results' => []]);
        }
        $like = '%'.addcslashes($q, '%_').'%';
        $results = collect();
        Chapter::where('title', 'like', $like)->orWhere('subtitle', 'like', $like)->limit(8)->get()->each(fn ($x) => $results->push(['type' => 'chapter', 'id' => $x->id, 'title' => $x->title, 'description' => $x->subtitle, 'url' => "/chapters/{$x->id}"]));
        Chapter::whereHas('lessons', fn ($query) => $query->where('title', 'like', $like)->orWhere('summary', 'like', $like))->with('lessons')->limit(12)->get()->each(function ($chapter) use ($q, $results) {
            foreach ($chapter->lessons->filter(fn ($l) => str_contains(mb_strtolower($l->title.' '.$l->summary), mb_strtolower($q)))->take(4) as $lesson) {
                $results->push(['type' => 'lesson', 'id' => $lesson->id, 'title' => $lesson->title, 'description' => $chapter->title, 'url' => "/chapters/{$chapter->id}/lessons/{$lesson->id}"]);
            }
        });
        AiTool::where('name', 'like', $like)->orWhere('tagline', 'like', $like)->limit(8)->get()->each(fn ($x) => $results->push(['type' => 'tool', 'id' => $x->id, 'title' => $x->name, 'description' => $x->tagline, 'url' => '/tools']));
        CommunityPost::where('status', 'open')->where(fn ($query) => $query->where('title', 'like', $like)->orWhere('body', 'like', $like))->latest()->limit(8)->get()->each(fn ($x) => $results->push(['type' => 'post', 'id' => $x->id, 'title' => $x->title, 'description' => $x->body, 'url' => "/community/{$x->id}"]));

        return response()->json(['results' => $results->take(30)->values()]);
    }

    private function chapter(Chapter $c, bool $hasAccess): array
    {
        $lessons = $c->lessons->map(function ($lesson) use ($hasAccess) {
            $data = [...$lesson->toArray(), 'duration' => $lesson->duration];
            if (! $hasAccess && ! $lesson->free) {
                $data['content'] = [];
                $data['captions'] = null;
                $data['video_path'] = null;
            }

            return $data;
        })->values();

        return [...$c->toArray(), 'duration' => $c->duration_minutes, 'oldPrice' => $c->old_price, 'previewCount' => $c->preview_count, 'instructor' => ['name' => $c->instructor_name, 'role' => $c->instructor_role], 'lessons' => $lessons, 'exam' => $this->exam($c, $hasAccess)];
    }

    /**
     * Exam meta is public. Its questions are part of the paid chapter, so they are
     * only sent to viewers with access, and never with the answer key.
     */
    private function exam(Chapter $c, bool $hasAccess): ?array
    {
        $exam = $c->exam;
        if (! $exam) {
            return null;
        }

        return [
            'id' => $exam->id,
            'title' => $exam->title,
            'durationMinutes' => (int) $exam->duration_minutes,
            'passScore' => (int) $exam->pass_score,
            'questionCount' => $exam->questions->count(),
            'questions' => $hasAccess
                ? $exam->questions->map(fn ($q) => ['id' => $q->id, 'text' => $q->text, 'options' => $q->options, 'topic' => $q->topic])->values()
                : [],
        ];
    }

    private function quiz(Quiz $q): array
    {
        return [...$q->toArray(), 'durationSeconds' => $q->duration_seconds, 'pointsPerQuestion' => $q->points_per_question, 'questions' => $q->questions];
    }
}
