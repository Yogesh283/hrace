<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'id_activated_at') || ! Schema::hasTable('investments')) {
            return;
        }

        DB::table('users')
            ->whereNotExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('investments')
                    ->whereColumn('investments.user_id', 'users.id');
            })
            ->update(['id_activated_at' => null]);

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            DB::statement('
                UPDATE users
                SET id_activated_at = (
                    SELECT MIN(created_at) FROM investments WHERE investments.user_id = users.id
                )
                WHERE EXISTS (SELECT 1 FROM investments WHERE investments.user_id = users.id)
            ');
        } else {
            DB::statement('
                UPDATE users u
                INNER JOIN (
                    SELECT user_id, MIN(created_at) AS first_investment_at
                    FROM investments
                    GROUP BY user_id
                ) i ON i.user_id = u.id
                SET u.id_activated_at = i.first_investment_at
            ');
        }
    }

    public function down(): void
    {
        // Non-reversible data sync.
    }
};
