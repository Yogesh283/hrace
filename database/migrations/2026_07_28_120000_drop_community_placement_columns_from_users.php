<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Drop Community Placement ($10) / binary matrix columns.
 * Keeps placement_l1_done_at / placement_l2_done_at (affiliate placement milestones).
 *
 * Note: SQLite cannot reliably drop FK-backed columns during test migrations;
 * binary_* columns are left in place on SQLite only (app code no longer uses them).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            if (Schema::hasColumn('users', 'placement_purchased_at')) {
                Schema::table('users', function (Blueprint $table) {
                    $table->dropColumn('placement_purchased_at');
                });
            }

            return;
        }

        if (Schema::hasColumn('users', 'binary_parent_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropForeign(['binary_parent_id']);
            });
        }

        $drop = [];
        foreach (['placement_purchased_at', 'binary_parent_id', 'binary_leg'] as $column) {
            if (Schema::hasColumn('users', $column)) {
                $drop[] = $column;
            }
        }

        if ($drop !== []) {
            Schema::table('users', function (Blueprint $table) use ($drop) {
                $table->dropColumn($drop);
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'binary_parent_id')) {
                $table->foreignId('binary_parent_id')->nullable()->after('referred_by')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('users', 'binary_leg')) {
                $table->string('binary_leg', 5)->nullable()->after('binary_parent_id');
            }
            if (! Schema::hasColumn('users', 'placement_purchased_at')) {
                $after = Schema::hasColumn('users', 'placement_l2_done_at') ? 'placement_l2_done_at' : 'id_activated_at';
                $table->timestamp('placement_purchased_at')->nullable()->after($after);
            }
        });
    }
};
