<?php

namespace Tests\Feature;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\R10LeadershipService;
use App\Support\RewardPlan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class R10LeadershipTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        $this->markTestSkipped('R10 Leadership replaced by Community Leadership per RACE Community Rewards PDF.');
        parent::setUp();
    }

    public function test_ranks_use_independent_self_and_team_thresholds_per_level(): void
    {
        $ranks = RewardPlan::r10LeadershipRanks();
        $r1 = collect($ranks)->firstWhere('code', 'R1');
        $r2 = collect($ranks)->firstWhere('code', 'R2');
        $r10 = collect($ranks)->firstWhere('code', 'R10');

        $this->assertNotNull($r1);
        $this->assertNotNull($r2);
        $this->assertNotNull($r10);
        $this->assertSame(1, $r1['level']);
        $this->assertSame(100.0, $r1['self_hold_usd']);
        $this->assertSame(10_000.0, $r1['team_volume_usd']);
        $this->assertSame(250.0, $r2['self_hold_usd']);
        $this->assertSame(25_000.0, $r2['team_volume_usd']);
        $this->assertSame(15_000.0, $r10['self_hold_usd']);
        $this->assertSame(10_000_000.0, $r10['team_volume_usd']);
        $this->assertSame(1.0, $r1['team_volume_percent']);
        $this->assertSame(0.70, $r2['team_volume_percent']);
    }

    public function test_level_one_qualifier_earns_one_percent_of_downline_volume_monthly(): void
    {
        $leader = User::factory()->create();
        $downline = User::factory()->create(['referred_by' => $leader->id]);

        Investment::query()->create([
            'user_id' => $leader->id,
            'amount_usd' => '100.00',
            'duration_days' => 30,
            'roi_percent_monthly' => '0.00',
            'roi_percent_daily' => '0.3000',
            'total_roi_paid_usd' => '0.00',
            'roi_payouts_done' => 0,
            'cap_multiplier' => '1.00',
            'status' => Investment::STATUS_ACTIVE,
            'next_roi_at' => now()->addDay(),
        ]);

        Investment::query()->create([
            'user_id' => $downline->id,
            'amount_usd' => '10000.00',
            'duration_days' => 30,
            'roi_percent_monthly' => '0.00',
            'roi_percent_daily' => '0.3000',
            'total_roi_paid_usd' => '0.00',
            'roi_payouts_done' => 0,
            'cap_multiplier' => '1.00',
            'status' => Investment::STATUS_ACTIVE,
            'next_roi_at' => now()->addDay(),
        ]);

        $svc = app(R10LeadershipService::class);
        $self = $svc->selfActiveHoldUsd($leader->id);
        $team = $svc->networkLevelTeamVolumeUsd($leader->id, 1);
        $rank = $svc->qualifyingRankRow($leader->id, $self);

        $this->assertSame('R1', $rank['code'] ?? null);
        $this->assertSame(1, $rank['level'] ?? null);
        $this->assertSame('100.00', $svc->estimatedMonthlyPayUsd($team, $rank));

        Artisan::call('income:pay-r10-leadership', ['--period' => '2026-04']);

        $entry = LedgerEntry::query()
            ->where('user_id', $leader->id)
            ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_R10_LEADERSHIP)
            ->where('meta->rank_code', 'R1')
            ->first();

        $this->assertNotNull($entry);
        $this->assertSame('100.00', (string) $entry->amount_usd);
        $this->assertSame(1, $entry->meta['level'] ?? null);
        $this->assertEquals(1.0, (float) ($entry->meta['team_volume_percent'] ?? 0));
        $this->assertSame('10000.00', (string) ($entry->meta['billable_team_volume_usd'] ?? ''));
    }

    public function test_r1_pays_on_full_level_one_volume_above_qualify_minimum(): void
    {
        $leader = User::factory()->create();
        $downline = User::factory()->create(['referred_by' => $leader->id]);

        Investment::query()->create([
            'user_id' => $leader->id,
            'amount_usd' => '100.00',
            'duration_days' => 30,
            'roi_percent_monthly' => '0.00',
            'roi_percent_daily' => '0.3000',
            'total_roi_paid_usd' => '0.00',
            'roi_payouts_done' => 0,
            'cap_multiplier' => '1.00',
            'status' => Investment::STATUS_ACTIVE,
            'next_roi_at' => now()->addDay(),
        ]);

        Investment::query()->create([
            'user_id' => $downline->id,
            'amount_usd' => '11000.00',
            'duration_days' => 30,
            'roi_percent_monthly' => '0.00',
            'roi_percent_daily' => '0.3000',
            'total_roi_paid_usd' => '0.00',
            'roi_payouts_done' => 0,
            'cap_multiplier' => '1.00',
            'status' => Investment::STATUS_ACTIVE,
            'next_roi_at' => now()->addDay(),
        ]);

        $svc = app(R10LeadershipService::class);
        $self = $svc->selfActiveHoldUsd($leader->id);
        $team = $svc->networkLevelTeamVolumeUsd($leader->id, 1);
        $rank = $svc->qualifyingRankRow($leader->id, $self);

        $this->assertSame('R1', $rank['code'] ?? null);
        $this->assertSame('11000.00', $svc->billableTeamVolumeUsd($team, $rank));
        $this->assertSame('110.00', $svc->estimatedMonthlyPayUsd($team, $rank));

        Artisan::call('income:pay-r10-leadership', ['--period' => '2026-05']);

        $entry = LedgerEntry::query()
            ->where('user_id', $leader->id)
            ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_R10_LEADERSHIP)
            ->first();

        $this->assertNotNull($entry);
        $this->assertSame('110.00', (string) $entry->amount_usd);
        $this->assertSame('11000.00', (string) ($entry->meta['base_team_volume_usd'] ?? ''));
        $this->assertSame('11000.00', (string) ($entry->meta['billable_team_volume_usd'] ?? ''));
    }

    public function test_r2_requires_level_two_volume_not_level_one_or_total_downline(): void
    {
        $leader = User::factory()->create();
        $level1 = User::factory()->create(['referred_by' => $leader->id]);
        $level2 = User::factory()->create(['referred_by' => $level1->id]);

        Investment::query()->create([
            'user_id' => $leader->id,
            'amount_usd' => '250.00',
            'duration_days' => 30,
            'roi_percent_monthly' => '0.00',
            'roi_percent_daily' => '0.3000',
            'total_roi_paid_usd' => '0.00',
            'roi_payouts_done' => 0,
            'cap_multiplier' => '1.00',
            'status' => Investment::STATUS_ACTIVE,
            'next_roi_at' => now()->addDay(),
        ]);

        Investment::query()->create([
            'user_id' => $level1->id,
            'amount_usd' => '50000.00',
            'duration_days' => 30,
            'roi_percent_monthly' => '0.00',
            'roi_percent_daily' => '0.3000',
            'total_roi_paid_usd' => '0.00',
            'roi_payouts_done' => 0,
            'cap_multiplier' => '1.00',
            'status' => Investment::STATUS_ACTIVE,
            'next_roi_at' => now()->addDay(),
        ]);

        Investment::query()->create([
            'user_id' => $level2->id,
            'amount_usd' => '5000.00',
            'duration_days' => 30,
            'roi_percent_monthly' => '0.00',
            'roi_percent_daily' => '0.3000',
            'total_roi_paid_usd' => '0.00',
            'roi_payouts_done' => 0,
            'cap_multiplier' => '1.00',
            'status' => Investment::STATUS_ACTIVE,
            'next_roi_at' => now()->addDay(),
        ]);

        $svc = app(R10LeadershipService::class);
        $self = $svc->selfActiveHoldUsd($leader->id);
        $rank = $svc->qualifyingRankRow($leader->id, $self);

        $this->assertSame('R1', $rank['code'] ?? null);
        $this->assertSame('50000.00', $svc->networkLevelTeamVolumeUsd($leader->id, 1));
        $this->assertSame('5000.00', $svc->networkLevelTeamVolumeUsd($leader->id, 2));

        Investment::query()->create([
            'user_id' => $level2->id,
            'amount_usd' => '20000.00',
            'duration_days' => 30,
            'roi_percent_monthly' => '0.00',
            'roi_percent_daily' => '0.3000',
            'total_roi_paid_usd' => '0.00',
            'roi_payouts_done' => 0,
            'cap_multiplier' => '1.00',
            'status' => Investment::STATUS_ACTIVE,
            'next_roi_at' => now()->addDay(),
        ]);

        $rank = $svc->qualifyingRankRow($leader->id, $self);
        $level2Team = $svc->networkLevelTeamVolumeUsd($leader->id, 2);

        $this->assertSame('R2', $rank['code'] ?? null);
        $this->assertSame('25000.00', $level2Team);
        $this->assertSame('25000.00', $svc->billableTeamVolumeUsd($level2Team, $rank));
        $this->assertSame('175.00', $svc->estimatedMonthlyPayUsd($level2Team, $rank));
    }

    public function test_r2_pays_on_full_level_two_volume_when_above_qualify_minimum(): void
    {
        $leader = User::factory()->create();
        $level1 = User::factory()->create(['referred_by' => $leader->id]);
        $level2 = User::factory()->create(['referred_by' => $level1->id]);

        Investment::query()->create([
            'user_id' => $leader->id,
            'amount_usd' => '250.00',
            'duration_days' => 30,
            'roi_percent_monthly' => '0.00',
            'roi_percent_daily' => '0.3000',
            'total_roi_paid_usd' => '0.00',
            'roi_payouts_done' => 0,
            'cap_multiplier' => '1.00',
            'status' => Investment::STATUS_ACTIVE,
            'next_roi_at' => now()->addDay(),
        ]);

        Investment::query()->create([
            'user_id' => $level2->id,
            'amount_usd' => '30000.00',
            'duration_days' => 30,
            'roi_percent_monthly' => '0.00',
            'roi_percent_daily' => '0.3000',
            'total_roi_paid_usd' => '0.00',
            'roi_payouts_done' => 0,
            'cap_multiplier' => '1.00',
            'status' => Investment::STATUS_ACTIVE,
            'next_roi_at' => now()->addDay(),
        ]);

        $svc = app(R10LeadershipService::class);
        $self = $svc->selfActiveHoldUsd($leader->id);
        $rank = $svc->qualifyingRankRow($leader->id, $self);
        $level2Team = $svc->networkLevelTeamVolumeUsd($leader->id, 2);

        $this->assertSame('R2', $rank['code'] ?? null);
        $this->assertSame('30000.00', $level2Team);
        $this->assertSame('30000.00', $svc->billableTeamVolumeUsd($level2Team, $rank));
        $this->assertSame('210.00', $svc->estimatedMonthlyPayUsd($level2Team, $rank));
    }

    public function test_monthly_payout_skipped_when_team_qualifies_but_self_hold_short_at_closing(): void
    {
        $leader = User::factory()->create();
        $downline = User::factory()->create(['referred_by' => $leader->id]);

        Investment::query()->create([
            'user_id' => $leader->id,
            'amount_usd' => '50.00',
            'duration_days' => 30,
            'roi_percent_monthly' => '0.00',
            'roi_percent_daily' => '0.3000',
            'total_roi_paid_usd' => '0.00',
            'roi_payouts_done' => 0,
            'cap_multiplier' => '1.00',
            'status' => Investment::STATUS_ACTIVE,
            'next_roi_at' => now()->addDay(),
        ]);

        Investment::query()->create([
            'user_id' => $downline->id,
            'amount_usd' => '10000.00',
            'duration_days' => 30,
            'roi_percent_monthly' => '0.00',
            'roi_percent_daily' => '0.3000',
            'total_roi_paid_usd' => '0.00',
            'roi_payouts_done' => 0,
            'cap_multiplier' => '1.00',
            'status' => Investment::STATUS_ACTIVE,
            'next_roi_at' => now()->addDay(),
        ]);

        $svc = app(R10LeadershipService::class);
        $self = $svc->selfActiveHoldUsd($leader->id);
        $eligibility = $svc->evaluatePayoutEligibility($leader->id, $self);

        $this->assertFalse($eligibility['eligible']);
        $this->assertTrue($eligibility['self_hold_lapsed']);
        $this->assertSame('R1', $eligibility['would_be_rank_code']);

        Artisan::call('income:pay-r10-leadership', ['--period' => '2026-06']);

        $this->assertNull(
            LedgerEntry::query()
                ->where('user_id', $leader->id)
                ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_R10_LEADERSHIP)
                ->first()
        );
    }

    public function test_live_data_ledger_returns_all_ranks_with_per_level_team_volume(): void
    {
        $leader = User::factory()->create();
        $direct = User::factory()->create(['referred_by' => $leader->id]);

        Investment::query()->create([
            'user_id' => $leader->id,
            'amount_usd' => '100.00',
            'duration_days' => 30,
            'roi_percent_monthly' => '0.00',
            'roi_percent_daily' => '0.3000',
            'total_roi_paid_usd' => '0.00',
            'roi_payouts_done' => 0,
            'cap_multiplier' => '1.00',
            'status' => Investment::STATUS_ACTIVE,
            'next_roi_at' => now()->addDay(),
        ]);

        Investment::query()->create([
            'user_id' => $direct->id,
            'amount_usd' => '10000.00',
            'duration_days' => 30,
            'roi_percent_monthly' => '0.00',
            'roi_percent_daily' => '0.3000',
            'total_roi_paid_usd' => '0.00',
            'roi_payouts_done' => 0,
            'cap_multiplier' => '1.00',
            'status' => Investment::STATUS_ACTIVE,
            'next_roi_at' => now()->addDay(),
        ]);

        $ledger = app(R10LeadershipService::class)->liveDataLedgerFor($leader);

        $this->assertCount(10, $ledger['rows']);
        $r1 = collect($ledger['rows'])->firstWhere('rank_code', 'R1');
        $this->assertNotNull($r1);
        $this->assertTrue($r1['qualified']);
        $this->assertSame(100.0, $r1['estimated_earned_usd']);
        $this->assertTrue($ledger['closing']['self_hold_ok']);
    }
}
