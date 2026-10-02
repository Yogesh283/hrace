<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('ledger_entries')) {
            return;
        }

        if (Schema::hasIndex('ledger_entries', 'ledger_user_type_idx')) {
            return;
        }

        Schema::table('ledger_entries', function (Blueprint $table) {
            $table->index(['user_id', 'entry_type'], 'ledger_user_type_idx');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('ledger_entries') || ! Schema::hasIndex('ledger_entries', 'ledger_user_type_idx')) {
            return;
        }

        Schema::table('ledger_entries', function (Blueprint $table) {
            $table->dropIndex('ledger_user_type_idx');
        });
    }
};
