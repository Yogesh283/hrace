<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Change amount_usd and balance_after_usd from decimal(15,2) to decimal(15,4)
     * so that small network-ROI shares (e.g. $0.0033) are stored correctly
     * instead of being truncated to $0.00.
     */
    public function up(): void
    {
        Schema::table('ledger_entries', function (Blueprint $table) {
            $table->decimal('amount_usd', 15, 4)->change();
            $table->decimal('balance_after_usd', 15, 4)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('ledger_entries', function (Blueprint $table) {
            $table->decimal('amount_usd', 15, 2)->change();
            $table->decimal('balance_after_usd', 15, 2)->nullable()->change();
        });
    }
};
