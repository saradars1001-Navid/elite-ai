<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Exam attempts feed the performance discount (CheckoutController reads
        // exam_attempts for the previous chapter's best score) and the progress
        // stats in the admin dashboard. The table was referenced but never
        // created, so this migration also fixes that latent bug.
        Schema::create('exam_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('chapter_id');
            $table->foreign('chapter_id')->references('id')->on('chapters')->cascadeOnDelete();
            $table->unsignedInteger('score')->default(0);
            $table->unsignedInteger('correct')->default(0);
            $table->unsignedInteger('wrong')->default(0);
            $table->boolean('passed')->default(false);
            $table->json('topic_analysis')->nullable();
            $table->unsignedTinyInteger('awarded_discount')->default(0);
            $table->timestamps();
            $table->index(['user_id', 'chapter_id', 'score']);
            $table->index(['chapter_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('exam_attempts');
        Schema::enableForeignKeyConstraints();
    }
};
