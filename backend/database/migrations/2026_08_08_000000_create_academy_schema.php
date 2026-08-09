<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name')->default('کاربر');
            $table->string('phone', 32)->unique();
            $table->enum('role', ['user', 'admin', 'instructor'])->default('user');
            $table->enum('status', ['active', 'blocked'])->default('active');
            $table->unsignedInteger('points')->default(0);
            $table->unsignedInteger('xp')->default(0);
            $table->unsignedInteger('streak_days')->default(0);
            $table->date('last_active_date')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });
        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->uuidMorphs('tokenable');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });
        Schema::create('otp_codes', function (Blueprint $table) {
            $table->id();
            $table->string('phone', 32)->index();
            $table->string('code_hash');
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
        Schema::create('chapters', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->unsignedInteger('index');
            $table->string('title');
            $table->string('subtitle')->nullable();
            $table->text('description')->nullable();
            $table->string('level')->default('مقدماتی');
            $table->string('instructor_name')->nullable();
            $table->string('instructor_role')->nullable();
            $table->unsignedInteger('duration_minutes')->default(0);
            $table->unsignedInteger('price')->default(0);
            $table->unsignedInteger('old_price')->nullable();
            $table->boolean('free')->default(false);
            $table->unsignedInteger('preview_count')->default(1);
            $table->string('icon')->nullable();
            $table->string('gradient')->nullable();
            $table->json('prerequisites')->nullable();
            $table->json('outcome')->nullable();
            $table->timestamps();
            $table->index(['free', 'index']);
        });
        Schema::create('lessons', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('chapter_id');
            $table->foreign('chapter_id')->references('id')->on('chapters')->cascadeOnDelete();
            $table->unsignedInteger('index');
            $table->string('title');
            $table->enum('kind', ['video', 'text']);
            $table->unsignedInteger('duration')->default(0);
            $table->text('summary')->nullable();
            $table->json('content')->nullable();
            $table->json('captions')->nullable();
            $table->string('video_path')->nullable();
            $table->boolean('free')->default(false);
            $table->timestamps();
            $table->index(['chapter_id', 'index']);
        });
        Schema::create('quizzes', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->enum('kind', ['daily', 'weekly', 'category']);
            $table->string('title');
            $table->string('category')->nullable();
            $table->string('difficulty')->default('آسان');
            $table->unsignedInteger('duration_seconds')->default(90);
            $table->unsignedInteger('points_per_question')->default(10);
            $table->enum('status', ['draft', 'published', 'archived'])->default('published');
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'kind']);
        });
        Schema::create('quiz_questions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('quiz_id');
            $table->foreign('quiz_id')->references('id')->on('quizzes')->cascadeOnDelete();
            $table->text('text');
            $table->json('options');
            $table->unsignedTinyInteger('correct');
            $table->text('explanation')->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
            $table->index(['quiz_id', 'position']);
        });
        Schema::create('quiz_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('quiz_id');
            $table->foreign('quiz_id')->references('id')->on('quizzes')->cascadeOnDelete();
            $table->unsignedInteger('score')->default(0);
            $table->unsignedInteger('total')->default(0);
            $table->unsignedInteger('correct_count')->default(0);
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->json('answers')->nullable();
            $table->timestamps();
            $table->index(['quiz_id', 'created_at']);
        });
        Schema::create('lesson_progress', function (Blueprint $table) {
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('lesson_id');
            $table->boolean('completed')->default(false);
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->primary(['user_id', 'lesson_id']);
            $table->foreign('lesson_id')->references('id')->on('lessons')->cascadeOnDelete();
        });
        Schema::create('purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('chapter_id');
            $table->foreign('chapter_id')->references('id')->on('chapters')->cascadeOnDelete();
            $table->unsignedInteger('price');
            $table->unsignedInteger('base_price');
            $table->string('discount_label')->nullable();
            $table->string('receipt_id')->unique();
            $table->string('gateway_ref')->nullable();
            $table->enum('status', ['pending', 'paid', 'failed', 'cancelled', 'refunded'])->default('pending');
            $table->timestamps();
            $table->unique(['user_id', 'chapter_id', 'status']);
        });
        Schema::create('ai_tools', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->string('tagline')->nullable();
            $table->text('description')->nullable();
            $table->string('category');
            $table->json('use_cases')->nullable();
            $table->string('level')->nullable();
            $table->string('pricing')->nullable();
            $table->json('languages')->nullable();
            $table->text('url')->nullable();
            $table->decimal('rating', 3, 2)->default(0);
            $table->unsignedInteger('reviews')->default(0);
            $table->json('related_lessons')->nullable();
            $table->date('reviewed_at')->nullable();
            $table->boolean('is_new')->default(false);
            $table->timestamps();
        });
        Schema::create('short_videos', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('title');
            $table->string('creator');
            $table->string('creator_role')->nullable();
            $table->string('category');
            $table->text('description')->nullable();
            $table->text('video_path');
            $table->text('poster_path')->nullable();
            $table->unsignedInteger('duration_seconds')->default(0);
            $table->json('tags')->nullable();
            $table->unsignedBigInteger('views')->default(0);
            $table->unsignedBigInteger('likes')->default(0);
            $table->enum('status', ['draft', 'published', 'archived'])->default('draft');
            $table->boolean('featured')->default(false);
            $table->timestamps();
            $table->index(['status', 'created_at']);
        });
        Schema::create('trending_prompts', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('title');
            $table->longText('prompt');
            $table->string('category');
            $table->string('tool');
            $table->string('author');
            $table->text('description')->nullable();
            $table->json('tags')->nullable();
            $table->unsignedBigInteger('uses')->default(0);
            $table->unsignedBigInteger('likes')->default(0);
            $table->enum('status', ['draft', 'published', 'archived'])->default('draft');
            $table->boolean('featured')->default(false);
            $table->timestamps();
            $table->index(['status', 'created_at']);
        });
        Schema::create('community_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('category');
            $table->string('title');
            $table->longText('body');
            $table->json('tags')->nullable();
            $table->unsignedInteger('likes')->default(0);
            $table->unsignedInteger('comments_count')->default(0);
            $table->enum('status', ['open', 'closed', 'reported'])->default('open');
            $table->timestamps();
            $table->index(['status', 'created_at']);
        });
        Schema::create('community_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained('community_posts')->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('body');
            $table->unsignedInteger('likes')->default(0);
            $table->timestamps();
        });
        Schema::create('prompt_tools', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->string('emoji')->nullable();
            $table->string('category');
            $table->text('description')->nullable();
            $table->string('style')->nullable();
            $table->timestamps();
        });
        Schema::create('prompt_scenarios', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('category');
            $table->string('task_type');
            $table->json('tool_ids')->nullable();
            $table->longText('sample_prompt')->nullable();
            $table->text('goal')->nullable();
            $table->unsignedInteger('time_seconds')->default(60);
            $table->unsignedInteger('points')->default(100);
            $table->enum('status', ['draft', 'published'])->default('published');
            $table->timestamps();
        });
        Schema::create('prompt_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('scenario_id');
            $table->longText('prompt');
            $table->unsignedInteger('score')->default(0);
            $table->unsignedInteger('max_score')->default(0);
            $table->json('criteria')->nullable();
            $table->json('tool_results')->nullable();
            $table->timestamps();
            $table->foreign('scenario_id')->references('id')->on('prompt_scenarios')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        foreach (['prompt_attempts', 'prompt_scenarios', 'prompt_tools', 'community_comments', 'community_posts', 'trending_prompts', 'short_videos', 'ai_tools', 'purchases', 'lesson_progress', 'quiz_attempts', 'quiz_questions', 'quizzes', 'lessons', 'chapters', 'otp_codes', 'personal_access_tokens', 'users'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::enableForeignKeyConstraints();
    }
};
