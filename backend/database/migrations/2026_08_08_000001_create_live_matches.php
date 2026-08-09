<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('live_matches', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('host_id')->constrained('users')->cascadeOnDelete();
            $table->enum('mode', ['1v1', 'ffa'])->default('ffa');
            $table->unsignedTinyInteger('max_players')->default(4);
            $table->enum('status', ['waiting', 'playing', 'finished', 'abandoned'])->default('waiting')->index();
            $table->json('questions')->nullable();      // [{text,options,correct,explanation}]
            $table->unsignedInteger('question_index')->default(0);
            $table->unsignedInteger('points_per_question')->default(10);
            $table->unsignedInteger('seconds_per_question')->default(15);
            $table->timestamp('question_started_at')->nullable();
            $table->timestamp('question_ends_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });

        Schema::create('live_match_players', function (Blueprint $table) {
            $table->id();
            $table->foreignId('match_id')->constrained('live_matches')->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->json('answers')->nullable();        // [{index, answer, at}]
            $table->unsignedInteger('score')->default(0);
            $table->unsignedInteger('correct_count')->default(0);
            $table->unsignedInteger('answered_count')->default(0);
            $table->unsignedInteger('rank')->nullable();
            $table->timestamps();
            $table->unique(['match_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('live_match_players');
        Schema::dropIfExists('live_matches');
        Schema::enableForeignKeyConstraints();
    }
};
