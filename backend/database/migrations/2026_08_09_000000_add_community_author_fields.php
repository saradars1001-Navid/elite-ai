<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Community posts that come from the deployment seed have no user account of
 * their own (the project deliberately does not create fake users). These
 * columns carry the display name/role for seeded content so the community list
 * still shows a credible author, while user-written posts keep using user_id.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('community_posts', function (Blueprint $table) {
            $table->string('author_name')->nullable()->after('user_id');
            $table->string('author_role')->nullable()->after('author_name');
        });
    }

    public function down(): void
    {
        Schema::table('community_posts', function (Blueprint $table) {
            $table->dropColumn(['author_name', 'author_role']);
        });
    }
};
