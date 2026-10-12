<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `gateway_ref` holds the gateway's bank reference after a successful payment
 * (Zarinpal ref_id, IDPay track_id), so it no longer equals the authority the
 * order was opened with. The authority is stored separately so redirects and
 * webhooks can be bound to the order that started the payment, and so refunds
 * use the identifier the gateway expects.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchases', function (Blueprint $table) {
            $table->string('gateway_authority', 120)->nullable()->after('gateway_ref');
        });
        Schema::table('wallet_transactions', function (Blueprint $table) {
            $table->string('gateway_authority', 120)->nullable()->after('gateway_ref');
        });
    }

    public function down(): void
    {
        Schema::table('purchases', function (Blueprint $table) {
            $table->dropColumn('gateway_authority');
        });
        Schema::table('wallet_transactions', function (Blueprint $table) {
            $table->dropColumn('gateway_authority');
        });
    }
};
