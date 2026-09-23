<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('investments', function (Blueprint $table) {
            $table->decimal('accrued_reward_usd', 16, 4)->default(0)->after('total_roi_paid_usd');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('last_income_claim_at')->nullable()->after('compound_rewards_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('investments', function (Blueprint $table) {
            $table->dropColumn('accrued_reward_usd');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('last_income_claim_at');
        });
    }
};
