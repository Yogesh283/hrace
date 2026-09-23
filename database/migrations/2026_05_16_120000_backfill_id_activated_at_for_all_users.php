<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'id_activated_at')) {
            return;
        }

        DB::table('users')
            ->whereNull('id_activated_at')
            ->update([
                'id_activated_at' => DB::raw('COALESCE(created_at, CURRENT_TIMESTAMP)'),
            ]);
    }

    public function down(): void
    {
        // Non-reversible data backfill.
    }
};
