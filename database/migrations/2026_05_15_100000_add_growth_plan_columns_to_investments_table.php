<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('investments', function (Blueprint $table) {
            $table->unsignedInteger('duration_days')->nullable()->after('amount_usd');
            $table->decimal('roi_percent_daily', 8, 4)->nullable()->after('roi_percent_monthly');
            $table->unsignedInteger('roi_payouts_done')->default(0)->after('total_roi_paid_usd');
        });
    }

    public function down(): void
    {
        Schema::table('investments', function (Blueprint $table) {
            $table->dropColumn(['duration_days', 'roi_percent_daily', 'roi_payouts_done']);
        });
    }
};
