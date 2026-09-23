<?php

namespace Tests\Feature;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\CommunityLeadershipService;
use App\Services\Income\InvestmentRecorder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoiPayTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_investment_is_due_for_roi_on_next_pay_run(): void
    {
        $user = User::factory()->create();

        $inv = app(InvestmentRecorder::class)->record($user, '100.00', 180);

        $this->assertNotNull($inv->next_roi_at);
        $this->assertTrue($inv->next_roi_at->lte(now()));

        $this->artisan('income:pay-roi')->assertSuccessful();

        $this->assertDatabaseHas('ledger_entries', [
            'user_id' => $user->id,
            'entry_type' => LedgerEntry::TYPE_ROI_ACCRUAL,
            'reference_id' => $inv->id,
        ]);
    }

    public function test_sub_fifty_earns_own_roi_without_referral_and_counts_for_leadership(): void
    {
        $sponsor = User::factory()->create([
            'participation_activated_at' => now(),
        ]);
        $user = User::factory()->create([
            'referred_by' => $sponsor->id,
            'participation_activated_at' => null,
        ]);

        $inv = app(InvestmentRecorder::class)->record($user, '40.00', 0);

        $dailyPct = (string) $inv->roi_percent_daily;
        $expectedDailyPay = bcmul('40.00', bcdiv($dailyPct, '100', 8), 4);

        $this->assertNotNull($inv->next_roi_at);
        $this->assertNull($user->fresh()->participation_activated_at);
        $this->assertDatabaseMissing('ledger_entries', [
            'entry_type' => LedgerEntry::TYPE_COMMUNITY_REFERRAL,
            'reference_id' => $inv->id,
        ]);

        $leadership = app(CommunityLeadershipService::class);
        $this->assertSame('40.00', $leadership->downlineTeamVolumeUsd($sponsor->id));
        $expectedTeamDaily = bcmul('40.00', bcdiv($dailyPct, '100', 8), 2);
        $this->assertSame($expectedTeamDaily, $leadership->downlineTeamDailyRoiUsd($sponsor->id));

        $context = $leadership->buildPayoutContext();
        $this->assertContains($user->id, $context['children'][$sponsor->id]);
        $this->assertSame($expectedTeamDaily, $context['subtree_daily_roi'][$user->id]);

        $this->artisan('income:pay-roi')->assertSuccessful();

        $this->assertDatabaseHas('ledger_entries', [
            'user_id' => $user->id,
            'entry_type' => LedgerEntry::TYPE_ROI_ACCRUAL,
            'reference_id' => $inv->id,
            'amount_usd' => $expectedDailyPay,
        ]);
    }
}
