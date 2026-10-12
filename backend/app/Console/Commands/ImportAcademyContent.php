<?php

namespace App\Console\Commands;

use App\Models\AiTool;
use App\Models\Chapter;
use App\Models\CommunityPost;
use App\Models\Exam;
use App\Models\ExamQuestion;
use App\Models\Lesson;
use App\Models\PromptScenario;
use App\Models\PromptTool;
use App\Models\Quiz;
use App\Models\QuizQuestion;
use App\Models\ShortVideo;
use App\Models\TrendingPrompt;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

/**
 * Import the academy's shipped content (exported from the frontend bundle by
 * `node scripts/export-content.mjs`) into MySQL.
 *
 * This is the "explicit deployment seed" the README refers to: it fills the
 * catalog so GET /catalog, /discovery and /prompt-lab answer with real rows,
 * the server-side paywall works and the admin panel can edit everything.
 * The command is idempotent — safe to re-run after a content update.
 */
class ImportAcademyContent extends Command
{
    protected $signature = 'academy:import {file=database/academy-content.json}';

    protected $description = 'Import shipped academy content (chapters, lessons, quizzes, exams, tools, videos, prompts, community) into the database';

    public function handle(): int
    {
        $path = $this->argument('file');
        // Treat both POSIX (/x) and Windows (C:\x) paths as absolute.
        if (! preg_match('#^([A-Za-z]:[\\/]|/)#', $path)) {
            $path = base_path($path);
        }
        if (! File::exists($path)) {
            $this->error("Content file not found: {$path}");
            $this->line('Run `node scripts/export-content.mjs` in the project root first.');

            return self::FAILURE;
        }

        $data = json_decode(File::get($path), true, 512, JSON_THROW_ON_ERROR);

        $counts = [];
        DB::transaction(function () use ($data, &$counts) {
            $counts['chapters'] = $this->importChapters($data['chapters'] ?? []);
            $counts['quizzes'] = $this->importQuizzes($data['quizzes'] ?? []);
            $counts['tools'] = $this->importTools($data['aiTools'] ?? []);
            $counts['videos'] = $this->importVideos($data['shortVideos'] ?? []);
            $counts['prompts'] = $this->importPrompts($data['trendingPrompts'] ?? []);
            $counts['promptTools'] = $this->importPromptTools($data['promptTools'] ?? []);
            $counts['scenarios'] = $this->importScenarios($data['promptScenarios'] ?? []);
            $counts['posts'] = $this->importPosts($data['communityPosts'] ?? []);
        });

        foreach ($counts as $key => $value) {
            $this->line(str_pad($key, 14).$value);
        }
        $this->info('Academy content imported.');

        return self::SUCCESS;
    }

    private function importChapters(array $chapters): int
    {
        $n = 0;
        foreach ($chapters as $row) {
            $chapter = Chapter::updateOrCreate(['id' => $row['id']], [
                'index' => $row['index'],
                'title' => $row['title'],
                'subtitle' => $row['subtitle'] ?? null,
                'description' => $row['description'] ?? null,
                'level' => $row['level'] ?? 'مقدماتی',
                'instructor_name' => $row['instructor_name'] ?? null,
                'instructor_role' => $row['instructor_role'] ?? null,
                'duration_minutes' => $row['duration_minutes'] ?? 0,
                'price' => $row['price'] ?? 0,
                'old_price' => $row['old_price'] ?? null,
                'free' => (bool) ($row['free'] ?? false),
                'preview_count' => $row['preview_count'] ?? 1,
                'icon' => $row['icon'] ?? null,
                'gradient' => $row['gradient'] ?? null,
                'prerequisites' => $row['prerequisites'] ?? [],
                'outcome' => $row['outcome'] ?? [],
            ]);

            foreach ($row['lessons'] ?? [] as $lesson) {
                Lesson::updateOrCreate(['id' => $lesson['id']], [
                    'chapter_id' => $chapter->id,
                    'index' => $lesson['index'],
                    'title' => $lesson['title'],
                    'kind' => $lesson['kind'] === 'video' ? 'video' : 'text',
                    'duration' => $lesson['duration'] ?? 0,
                    'summary' => $lesson['summary'] ?? null,
                    'content' => $lesson['content'] ?? [],
                    'captions' => $lesson['captions'] ?? null,
                    'free' => (bool) ($lesson['free'] ?? false),
                ]);
            }

            $exam = $row['exam'] ?? null;
            if ($exam) {
                Exam::updateOrCreate(['id' => $exam['id']], [
                    'chapter_id' => $chapter->id,
                    'title' => $exam['title'],
                    'duration_minutes' => $exam['duration_minutes'] ?? 20,
                    'pass_score' => $exam['pass_score'] ?? 70,
                ]);
                foreach ($exam['questions'] ?? [] as $q) {
                    ExamQuestion::updateOrCreate(['id' => $q['id']], [
                        'exam_id' => $exam['id'],
                        'text' => $q['text'],
                        'options' => $q['options'],
                        'correct' => (int) $q['correct'],
                        'topic' => $q['topic'] ?? 'عمومی',
                    ]);
                }
            }
            $n++;
        }

        return $n;
    }

    private function importQuizzes(array $quizzes): int
    {
        $n = 0;
        foreach ($quizzes as $row) {
            Quiz::updateOrCreate(['id' => $row['id']], [
                'kind' => $row['kind'] ?? 'category',
                'title' => $row['title'],
                'category' => $row['category'] ?? 'عمومی',
                'difficulty' => $row['difficulty'] ?? 'آسان',
                'duration_seconds' => $row['duration_seconds'] ?? 90,
                'points_per_question' => $row['points_per_question'] ?? 10,
                'status' => $row['status'] ?? 'published',
            ]);
            foreach ($row['questions'] ?? [] as $q) {
                QuizQuestion::updateOrCreate(['id' => $q['id']], [
                    'quiz_id' => $row['id'],
                    'text' => $q['text'],
                    'options' => $q['options'],
                    'correct' => (int) $q['correct'],
                    'explanation' => $q['explanation'] ?? null,
                    'position' => $q['position'] ?? 0,
                ]);
            }
            $n++;
        }

        return $n;
    }

    private function importTools(array $tools): int
    {
        foreach ($tools as $row) {
            AiTool::updateOrCreate(['id' => $row['id']], [
                'name' => $row['name'],
                'tagline' => $row['tagline'] ?? null,
                'description' => $row['description'] ?? null,
                'category' => $row['category'],
                'use_cases' => $row['use_cases'] ?? [],
                'level' => $row['level'] ?? 'متوسط',
                'pricing' => $row['pricing'] ?? 'رایگان + پولی',
                'languages' => $row['languages'] ?? [],
                'url' => $row['url'] ?? null,
                'rating' => $row['rating'] ?? 0,
                'reviews' => $row['reviews'] ?? 0,
                'related_lessons' => $row['related_lessons'] ?? [],
                'reviewed_at' => $row['reviewed_at'] ?: null,
                'is_new' => (bool) ($row['is_new'] ?? false),
            ]);
        }

        return count($tools);
    }

    private function importVideos(array $videos): int
    {
        foreach ($videos as $row) {
            ShortVideo::updateOrCreate(['id' => $row['id']], [
                'title' => $row['title'],
                'creator' => $row['creator'],
                'creator_role' => $row['creator_role'] ?? null,
                'category' => $row['category'],
                'description' => $row['description'] ?? null,
                'video_path' => $row['video_path'],
                'poster_path' => $row['poster_path'] ?? null,
                'duration_seconds' => $row['duration_seconds'] ?? 0,
                'tags' => $row['tags'] ?? [],
                'views' => $row['views'] ?? 0,
                'likes' => $row['likes'] ?? 0,
                'status' => $row['status'] ?? 'published',
                'featured' => (bool) ($row['featured'] ?? false),
            ]);
        }

        return count($videos);
    }

    private function importPrompts(array $prompts): int
    {
        foreach ($prompts as $row) {
            TrendingPrompt::updateOrCreate(['id' => $row['id']], [
                'title' => $row['title'],
                'prompt' => $row['prompt'],
                'category' => $row['category'],
                'tool' => $row['tool'],
                'author' => $row['author'],
                'description' => $row['description'] ?? null,
                'tags' => $row['tags'] ?? [],
                'uses' => $row['uses'] ?? 0,
                'likes' => $row['likes'] ?? 0,
                'status' => $row['status'] ?? 'published',
                'featured' => (bool) ($row['featured'] ?? false),
            ]);
        }

        return count($prompts);
    }

    private function importPromptTools(array $tools): int
    {
        foreach ($tools as $row) {
            PromptTool::updateOrCreate(['id' => $row['id']], [
                'name' => $row['name'],
                'emoji' => $row['emoji'] ?? null,
                'category' => $row['category'],
                'description' => $row['description'] ?? null,
                'style' => $row['style'] ?? null,
            ]);
        }

        return count($tools);
    }

    private function importScenarios(array $scenarios): int
    {
        foreach ($scenarios as $row) {
            PromptScenario::updateOrCreate(['id' => $row['id']], [
                'title' => $row['title'],
                'description' => $row['description'] ?? null,
                'category' => $row['category'],
                'task_type' => $row['task_type'],
                'tool_ids' => $row['tool_ids'] ?? [],
                'sample_prompt' => $row['sample_prompt'] ?? null,
                'goal' => $row['goal'] ?? null,
                'time_seconds' => $row['time_seconds'] ?? 60,
                'points' => $row['points'] ?? 100,
                'status' => $row['status'] ?? 'published',
            ]);
        }

        return count($scenarios);
    }

    private function importPosts(array $posts): int
    {
        foreach ($posts as $row) {
            CommunityPost::updateOrCreate(
                ['title' => $row['title']],
                [
                    'category' => $row['category'],
                    'body' => $row['body'],
                    'tags' => $row['tags'] ?? [],
                    'likes' => $row['likes'] ?? 0,
                    'comments_count' => $row['comments_count'] ?? 0,
                    'status' => $row['status'] ?? 'open',
                    'author_name' => $row['author_name'] ?? null,
                    'author_role' => $row['author_role'] ?? null,
                ]
            );
        }

        return count($posts);
    }
}
