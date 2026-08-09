<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Audit log for every incoming payment notification (server webhook or
        // gateway redirect callback) — payload, verification result, idempotency.
        Schema::create('payment_events', function (Blueprint $table) {
            $table->id();
            $table->enum('source', ['webhook', 'callback'])->default('webhook');
            $table->string('gateway', 32)->nullable();
            $table->enum('type', ['payment', 'refund'])->default('payment');
            $table->string('reference_type', 16)->nullable(); // purchase | wallet
            $table->string('reference_id', 64)->nullable();
            $table->enum('status', ['received', 'processed', 'idempotent', 'ignored', 'failed'])->default('received');
            $table->json('payload')->nullable();
            $table->json('verify_result')->nullable();
            $table->text('error')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamps();
            $table->index(['source', 'created_at']);
            $table->index(['status', 'created_at']);
            $table->index(['reference_type', 'reference_id']);
        });
    }

    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('payment_events');
        Schema::enableForeignKeyConstraints();
    }
};
