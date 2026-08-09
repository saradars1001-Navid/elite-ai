<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique();
            $table->unsignedTinyInteger('percent')->default(0);
            $table->unsignedInteger('max_uses')->nullable();
            $table->unsignedInteger('used_count')->default(0);
            $table->timestamp('expires_at')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('discount_rules', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->unsignedTinyInteger('high_min')->default(90);
            $table->unsignedTinyInteger('high_percent')->default(30);
            $table->unsignedTinyInteger('mid_min')->default(80);
            $table->unsignedTinyInteger('mid_percent')->default(20);
            $table->unsignedTinyInteger('low_min')->default(70);
            $table->unsignedTinyInteger('low_percent')->default(10);
            $table->timestamps();
        });

        Schema::table('purchases', function (Blueprint $table) {
            // gateway_ref already exists in the base academy schema; only the
            // payment-specific columns are added here.
            $table->string('checkout_id', 64)->nullable()->unique()->after('id');
            $table->string('coupon_code', 40)->nullable()->after('discount_label');
            $table->timestamp('refunded_at')->nullable()->after('gateway_ref');
        });
    }

    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('discount_rules');
        Schema::dropIfExists('coupons');
        Schema::table('purchases', function (Blueprint $table) {
            $table->dropColumn(['checkout_id', 'coupon_code', 'refunded_at']);
        });
        Schema::enableForeignKeyConstraints();
    }
};
