<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Exams + questions so the Laravel backend can grade chapter exams
 * authoritatively (the client only sends answer indices — never a score).
 * exam_attempts already exists and feeds the performance discount, so this
 * migration completes the missing half of the feature.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exams', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('chapter_id');
            $table->foreign('chapter_id')->references('id')->on('chapters')->cascadeOnDelete();
            $table->string('title');
            $table->unsignedInteger('duration_minutes')->default(20);
            $table->unsignedTinyInteger('pass_score')->default(70);
            $table->timestamps();
        });

        Schema::create('exam_questions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('exam_id');
            $table->foreign('exam_id')->references('id')->on('exams')->cascadeOnDelete();
            $table->string('text');
            $table->json('options');
            $table->unsignedTinyInteger('correct');
            $table->string('topic')->default('عمومی');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('exam_questions');
        Schema::dropIfExists('exams');
        Schema::enableForeignKeyConstraints();
    }
};
