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
            $table->timestamp('placement_l1_done_at')->nullable()->after('id_activated_at');
            $table->timestamp('placement_l2_done_at')->nullable()->after('placement_l1_done_at');
        });

        $now = now();
        foreach (DB::table('users')->orderBy('id')->cursor() as $row) {
            $id = (int) $row->id;
            $d1 = (int) DB::table('users')->where('referred_by', $id)->count();
            $directIds = DB::table('users')->where('referred_by', $id)->pluck('id')->all();
            $d2 = $directIds === [] ? 0 : (int) DB::table('users')->whereIn('referred_by', $directIds)->count();

            $updates = [];
            if ($d1 >= 2) {
                $updates['placement_l1_done_at'] = $now;
            }
            if ($d2 >= 4) {
                $updates['placement_l2_done_at'] = $now;
            }
            if ($updates !== []) {
                DB::table('users')->where('id', $id)->update($updates);
            }
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['placement_l1_done_at', 'placement_l2_done_at']);
        });
    }
};
