<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * User-requested refunds: a paid purchase stays paid (access remains granted)
 * until an admin approves or rejects the request. The pending state is derived
 * from refund_requested_at being set while refund_rejected_at is null — keeping
 * the status enum untouched avoids a fragile enum alteration on SQLite/MySQL.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchases', function (Blueprint $table) {
            $table->timestamp('refund_requested_at')->nullable()->after('refunded_at');
            $table->timestamp('refund_rejected_at')->nullable()->after('refund_requested_at');
            $table->string('refund_reason', 500)->nullable()->after('refund_rejected_at');
        });
    }

    public function down(): void
    {
        Schema::table('purchases', function (Blueprint $table) {
            $table->dropColumn(['refund_requested_at', 'refund_rejected_at', 'refund_reason']);
        });
    }
};
