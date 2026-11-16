<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'withdrawals_locked_until')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('withdrawals_locked_until')->nullable()->after('withdrawals_disabled');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('users', 'withdrawals_locked_until')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('withdrawals_locked_until');
        });
    }
};
