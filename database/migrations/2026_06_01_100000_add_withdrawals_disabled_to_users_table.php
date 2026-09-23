<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'withdrawals_disabled')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->boolean('withdrawals_disabled')->default(false)->after('is_blocked');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('users', 'withdrawals_disabled')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('withdrawals_disabled');
        });
    }
};
