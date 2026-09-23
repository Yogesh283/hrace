<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Backfill existing $1–$49 positions that were previously stored as volume-only.
     */
    public function up(): void
    {
        $rates = [
            0 => 0.50,
            180 => 0.60,
            365 => 1.00,
            730 => 1.25,
            1095 => 1.50,
        ];

        foreach ($rates as $durationDays => $dailyPercent) {
            DB::table('investments')
                ->where('status', 'active')
                ->where('amount_usd', '>=', 1)
                ->where('amount_usd', '<', 50)
                ->where('duration_days', $durationDays)
                ->where(function ($query): void {
                    $query->whereNull('roi_percent_daily')
                        ->orWhere('roi_percent_daily', '<=', 0);
                })
                ->update([
                    'roi_percent_daily' => number_format($dailyPercent, 4, '.', ''),
                    'roi_percent_monthly' => number_format($dailyPercent * 30, 2, '.', ''),
                    'next_roi_at' => now(),
                    'updated_at' => now(),
                ]);
        }
    }

    public function down(): void
    {
        // Intentionally irreversible: earned ROI must not be disabled by rollback.
    }
};
