<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('withdrawals', function (Blueprint $table) {
            $table->decimal('team_reward_usd', 15, 2)->nullable()->after('fee_usd');
            $table->decimal('admin_fee_usd', 15, 2)->nullable()->after('team_reward_usd');
        });

        // Backfill: previous fee_usd was the sole 10% Team Reward pool (no separate admin fee).
        if (Schema::hasColumn('withdrawals', 'team_reward_usd')) {
            DB::table('withdrawals')
                ->whereNull('team_reward_usd')
                ->update([
                    'team_reward_usd' => DB::raw('fee_usd'),
                    'admin_fee_usd' => 0,
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('withdrawals', function (Blueprint $table) {
            $table->dropColumn(['team_reward_usd', 'admin_fee_usd']);
        });
    }
};
