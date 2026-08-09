<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('wallet_balance')->default(0)->after('xp');
        });

        Schema::create('wallet_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('type', ['charge', 'purchase', 'refund', 'bonus'])->default('charge');
            $table->unsignedInteger('amount')->default(0);
            $table->unsignedInteger('balance_after')->default(0);
            $table->enum('status', ['pending', 'completed', 'failed'])->default('pending');
            $table->string('gateway_ref', 120)->nullable();
            $table->unsignedBigInteger('purchase_id')->nullable();
            $table->string('description', 255)->nullable();
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('wallet_transactions');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('wallet_balance');
        });
        Schema::enableForeignKeyConstraints();
    }
};
