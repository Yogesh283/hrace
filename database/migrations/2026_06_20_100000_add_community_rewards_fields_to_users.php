<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('placement_purchased_at')->nullable()->after('placement_l2_done_at');
            $table->boolean('compound_rewards_enabled')->default(false)->after('placement_purchased_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['placement_purchased_at', 'compound_rewards_enabled']);
        });
    }
};
