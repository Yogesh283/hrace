<?php

namespace Tests\Feature;

use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\LedgerWriter;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class IncomePurgeCronDayTest extends TestCase
{
    use RefreshDatabase;

    public function test_purge_cron_day_deletes_leadership_for_date(): void
    {
        $user = User::factory()->create(['participation_activated_at' => now()]);
        $period = Carbon::now()->format('Y-m-d');
        $referenceId = (int) str_replace('-', '', $period);

        app(LedgerWriter::class)->record(
            $user,
            LedgerEntry::TYPE_COMMUNITY_LEADERSHIP,
            '10.00',
            'community_leadership_day',
            $referenceId,
            ['period' => $period, 'level' => 1],
        );

        $this->assertSame(1, LedgerEntry::query()
            ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_LEADERSHIP)
            ->where('reference_id', $referenceId)
            ->count());

        Artisan::call('income:purge-cron-day', [
            '--date' => $period,
            '--types' => 'leadership',
            '--yes' => true,
        ]);

        $this->assertSame(0, LedgerEntry::query()
            ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_LEADERSHIP)
            ->where('reference_id', $referenceId)
            ->count());
    }

    public function test_pay_community_leadership_force_allows_second_run_same_day(): void
    {
        // Minimal: force path calls purge then pay; ensure command accepts --force without error.
        $exit = Artisan::call('income:pay-community-leadership', [
            '--force' => true,
            '--period' => Carbon::now()->format('Y-m-d'),
        ]);

        $this->assertSame(0, $exit);
        $this->assertStringContainsString('Community Leadership payouts', Artisan::output());
    }
}
