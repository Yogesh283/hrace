<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('participation_activated_at')->nullable()->after('placement_purchased_at');
        });

        // Users with investments already participated.
        DB::table('users')
            ->whereNull('participation_activated_at')
            ->whereExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('investments')
                    ->whereColumn('investments.user_id', 'users.id');
            })
            ->update(['participation_activated_at' => now()]);

        // Placement = first member activation (id_activated_at).
        DB::table('users')
            ->whereNotNull('placement_purchased_at')
            ->whereNull('id_activated_at')
            ->update(['id_activated_at' => DB::raw('placement_purchased_at')]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('participation_activated_at');
        });
    }
};
