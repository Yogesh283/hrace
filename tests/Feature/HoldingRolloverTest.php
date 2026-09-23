<?php

namespace Tests\Feature;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\HoldingRolloverService;
use App\Services\Income\InvestmentRecorder;
use App\Services\Income\LedgerWriter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class HoldingRolloverTest extends TestCase
{
    use RefreshDatabase;

    public function test_completed_stake_rolls_over_after_24_hours_if_not_unlocked(): void
    {
        $user = User::factory()->create(['participation_activated_at' => now()]);
        app(LedgerWriter::class)->record($user, LedgerEntry::TYPE_WALLET_DEPOSIT, '200.00', 'test', null, []);

        $inv = app(InvestmentRecorder::class)->record($user, '100.00', 180);
        $inv->forceFill([
            'status' => Investment::STATUS_COMPLETED,
            'roi_payouts_done' => 180,
            'next_roi_at' => null,
            'holding_completed_at' => now()->subHours(25),
        ])->save();

        $n = app(HoldingRolloverService::class)->rolloverDue();
        $this->assertSame(1, $n);

        $inv->refresh();
        $this->assertSame(Investment::STATUS_ACTIVE, $inv->status);
        $this->assertSame(0, (int) $inv->roi_payouts_done);
        $this->assertNull($inv->holding_completed_at);
        $this->assertSame(1, (int) $inv->rollover_count);
        $this->assertNotNull($inv->next_roi_at);
    }

    public function test_does_not_rollover_within_24_hours(): void
    {
        $user = User::factory()->create(['participation_activated_at' => now()]);
        app(LedgerWriter::class)->record($user, LedgerEntry::TYPE_WALLET_DEPOSIT, '200.00', 'test', null, []);

        $inv = app(InvestmentRecorder::class)->record($user, '100.00', 180);
        $inv->forceFill([
            'status' => Investment::STATUS_COMPLETED,
            'roi_payouts_done' => 180,
            'next_roi_at' => null,
            'holding_completed_at' => now()->subHours(2),
        ])->save();

        $this->assertSame(0, app(HoldingRolloverService::class)->rolloverDue());
        $this->assertSame(Investment::STATUS_COMPLETED, $inv->fresh()->status);
    }
}
