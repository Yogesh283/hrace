<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('investments', function (Blueprint $table) {
            if (! Schema::hasColumn('investments', 'holding_completed_at')) {
                $table->timestamp('holding_completed_at')->nullable()->after('next_roi_at')->index();
            }
            if (! Schema::hasColumn('investments', 'rollover_count')) {
                $table->unsignedInteger('rollover_count')->default(0)->after('holding_completed_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('investments', function (Blueprint $table) {
            if (Schema::hasColumn('investments', 'rollover_count')) {
                $table->dropColumn('rollover_count');
            }
            if (Schema::hasColumn('investments', 'holding_completed_at')) {
                $table->dropColumn('holding_completed_at');
            }
        });
    }
};
