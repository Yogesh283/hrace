<?php

namespace Tests\Feature;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Support\RewardPlan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class CommunityLeadershipTest extends TestCase
{
    use RefreshDatabase;

    public function test_community_leadership_ranks_match_pdf_thresholds(): void
    {
        $ranks = RewardPlan::communityLeadershipRanks();

        $this->assertCount(11, $ranks);
        $this->assertSame(1, $ranks[0]['level']);
        $this->assertEqualsWithDelta(50.0, (float) $ranks[0]['self_hold_usd'], 0.001);
        $this->assertEqualsWithDelta(2_000.0, (float) $ranks[0]['team_volume_usd'], 0.001);
        $this->assertSame(2, $ranks[0]['direct_required']);
        $this->assertEqualsWithDelta(10.0, (float) $ranks[0]['reward_percent'], 0.001);

        $top = $ranks[10];
        $this->assertSame(11, $top['level']);
        $this->assertEqualsWithDelta(10_000.0, (float) $top['self_hold_usd'], 0.001);
        $this->assertEqualsWithDelta(10_000_000.0, (float) $top['team_volume_usd'], 0.001);
        $this->assertSame(12, $top['direct_required']);
        $this->assertEqualsWithDelta(110.0, (float) $top['reward_percent'], 0.001);

        $this->assertSame(2, RewardPlan::communityLeadershipMinDirects());
        $this->assertSame(24, RewardPlan::communityLeadershipCycleHours());
        $this->assertSame(1, RewardPlan::communityLeadershipSameRankMaxPerLineage());
        $this->assertSame(5.0, RewardPlan::communityLeadershipSameRankPercent());
        $this->assertSame(5.0, RewardPlan::communityLeadershipSkipLevelPercent());
    }

    public function test_community_referral_percentages_match_official_graphic(): void
    {
        $this->assertSame(3.0, RewardPlan::communityReferralPercentForLevel(1));
        $this->assertSame(1.0, RewardPlan::communityReferralPercentForLevel(2));
        $this->assertSame(1.0, RewardPlan::communityReferralPercentForLevel(3));
        $this->assertSame(0.5, RewardPlan::communityReferralPercentForLevel(4));
        $this->assertSame(0.25, RewardPlan::communityReferralPercentForLevel(5));
        $this->assertSame(0.25, RewardPlan::communityReferralPercentForLevel(10));
    }

    public function test_leadership_pay_is_roi_of_roi_not_team_volume(): void
    {
        $svc = app(\App\Services\Income\CommunityLeadershipService::class);
        $rank = RewardPlan::communityLeadershipRanks()[0];

        // Team daily ROI $97 × Rank 1 10% = $9.70 (not $10,000 volume × 10%)
        $pay = $svc->estimatedDailyPayUsd('97.00', $rank);

        $this->assertSame('9.70', $pay);
    }

    public function test_sub_fifty_is_not_qualifying_participation(): void
    {
        $this->assertFalse(RewardPlan::isQualifyingParticipationAmount('49.99'));
        $this->assertTrue(RewardPlan::isQualifyingParticipationAmount('50.00'));
        $this->assertSame(1.0, RewardPlan::builtForGrowth()['min_amount_usd']);
        $this->assertSame(50.0, RewardPlan::participationQualifyingMinUsd());
    }

    public function test_rank_11_monthly_bonus_config(): void
    {
        $this->assertTrue(RewardPlan::communityLeadershipRank11MonthlyBonusEnabled());
        $this->assertSame(11, RewardPlan::communityLeadershipRank11RequiredRank());
        $this->assertSame(10_000_000.0, RewardPlan::communityLeadershipRank11RequiredTeamVolumeUsd());
        $this->assertSame(5_000.0, RewardPlan::communityLeadershipRank11MonthlyRewardUsd());
        $this->assertTrue(RewardPlan::communityLeadershipRank11RequiresTeamMember());
        $this->assertTrue(RewardPlan::communityLeadershipRank11RequiresDirectTeamMember());
        $this->assertTrue(RewardPlan::communityLeadershipRank11StopDailyWhenTeamHasRank11());
    }

    public function test_held_rank_11_full_month_requires_every_day(): void
    {
        $svc = app(\App\Services\Income\CommunityLeadershipService::class);
        $user = $this->makeParticipatingUser();

        $period = '2026-06';
        $start = \Carbon\Carbon::create(2026, 6, 1);
        $daysInMonth = $start->daysInMonth;

        for ($d = 1; $d <= $daysInMonth; $d++) {
            \App\Models\CommunityLeadershipDailyHold::query()->create([
                'user_id' => $user->id,
                'hold_date' => sprintf('2026-06-%02d', $d),
                'rank_level' => 11,
                'team_volume_usd' => '10000000.00',
                'self_hold_usd' => '10000.00',
                'qualified_directs' => 12,
            ]);
        }

        $this->assertTrue($svc->heldRank11FullMonth($user->id, $period));
        // Alone (no Rank 11 direct) → royalty not qualified
        $this->assertFalse($svc->qualifiesRank11MonthlyBonus($user->id, $period));

        \App\Models\CommunityLeadershipDailyHold::query()
            ->where('user_id', $user->id)
            ->whereDate('hold_date', '2026-06-15')
            ->delete();

        $this->assertFalse($svc->heldRank11FullMonth($user->id, $period));
    }

    public function test_royalty_requires_direct_rank_11_not_deeper_downline(): void
    {
        $svc = app(\App\Services\Income\CommunityLeadershipService::class);
        $leader = $this->makeParticipatingUser();
        $direct = $this->makeParticipatingUser(['referred_by' => $leader->id]);
        $indirect = $this->makeParticipatingUser(['referred_by' => $direct->id]);
        $period = '2026-06';
        $daysInMonth = \Carbon\Carbon::create(2026, 6, 1)->daysInMonth;

        // Leader + indirect Rank 11 only (not a direct) → no royalty
        foreach ([$leader->id, $indirect->id] as $uid) {
            for ($d = 1; $d <= $daysInMonth; $d++) {
                \App\Models\CommunityLeadershipDailyHold::query()->create([
                    'user_id' => $uid,
                    'hold_date' => sprintf('2026-06-%02d', $d),
                    'rank_level' => 11,
                    'team_volume_usd' => '10000000.00',
                    'self_hold_usd' => '10000.00',
                    'qualified_directs' => 12,
                ]);
            }
        }

        $this->assertFalse($svc->qualifiesRank11MonthlyBonus($leader->id, $period));

        // Add direct Rank 11 full month → royalty qualifies
        for ($d = 1; $d <= $daysInMonth; $d++) {
            \App\Models\CommunityLeadershipDailyHold::query()->create([
                'user_id' => $direct->id,
                'hold_date' => sprintf('2026-06-%02d', $d),
                'rank_level' => 11,
                'team_volume_usd' => '10000000.00',
                'self_hold_usd' => '10000.00',
                'qualified_directs' => 12,
            ]);
        }

        $this->assertTrue($svc->qualifiesRank11MonthlyBonus($leader->id, $period));
    }

    public function test_rank_11_monthly_requires_team_member_also_rank_11(): void
    {
        $svc = app(\App\Services\Income\CommunityLeadershipService::class);
        $leader = $this->makeParticipatingUser();
        $member = $this->makeParticipatingUser(['referred_by' => $leader->id]);
        $period = '2026-06';
        $daysInMonth = \Carbon\Carbon::create(2026, 6, 1)->daysInMonth;

        foreach ([$leader->id, $member->id] as $uid) {
            for ($d = 1; $d <= $daysInMonth; $d++) {
                \App\Models\CommunityLeadershipDailyHold::query()->create([
                    'user_id' => $uid,
                    'hold_date' => sprintf('2026-06-%02d', $d),
                    'rank_level' => 11,
                    'team_volume_usd' => '10000000.00',
                    'self_hold_usd' => '10000.00',
                    'qualified_directs' => 12,
                ]);
            }
        }

        $this->assertTrue($svc->qualifiesRank11MonthlyBonus($leader->id, $period));
    }

    public function test_compression_passes_leg_income_to_qualified_upline_when_downline_leader_unqualified(): void
    {
        $svc = app(\App\Services\Income\CommunityLeadershipService::class);

        $b = $this->makeParticipatingUser();
        $c = $this->makeParticipatingUser(['referred_by' => $b->id]);
        $e = $this->makeParticipatingUser(['referred_by' => $b->id]);
        $d = $this->makeParticipatingUser(['referred_by' => $c->id]);

        $this->makeActiveInvestment($b->id, '50.00', '1.0000');
        $this->makeActiveInvestment($e->id, '2000.00', '0.0000');
        $this->makeActiveInvestment($d->id, '10000.00', '1.0000');

        $payout = $svc->calculateLeaderDailyPayout($b->id);

        $this->assertSame('10.00', $payout['compression_usd']);
        $this->assertSame('0.00', $payout['generation_gap_usd']);
        $this->assertSame('0.00', $payout['same_rank_usd']);
        $this->assertSame('10.00', $payout['total']);
    }

    public function test_generation_gap_pays_rank_difference_on_qualified_downline_leg(): void
    {
        $svc = app(\App\Services\Income\CommunityLeadershipService::class);

        $b = $this->makeParticipatingUser();
        $c = $this->makeParticipatingUser(['referred_by' => $b->id]);
        $e = $this->makeParticipatingUser(['referred_by' => $b->id]);
        $f = $this->makeParticipatingUser(['referred_by' => $b->id]);
        $d = $this->makeParticipatingUser(['referred_by' => $c->id]);
        $g = $this->makeParticipatingUser(['referred_by' => $c->id]);

        $this->makeActiveInvestment($b->id, '100.00', '0.0000');
        $this->makeActiveInvestment($c->id, '50.00', '0.0000');
        $this->makeActiveInvestment($e->id, '2500.00', '0.0000');
        $this->makeActiveInvestment($f->id, '2500.00', '0.0000');
        $this->makeActiveInvestment($d->id, '10000.00', '1.0000');
        $this->makeActiveInvestment($g->id, '100.00', '0.0000');

        $payout = $svc->calculateLeaderDailyPayout($b->id);

        $this->assertSame('10.00', $payout['generation_gap_usd']);
        $this->assertSame('0.00', $payout['compression_usd']);
        $this->assertSame('10.00', $payout['total']);
    }

    public function test_same_rank_rule_pays_five_percent_when_downline_leader_matches_rank(): void
    {
        $svc = app(\App\Services\Income\CommunityLeadershipService::class);

        $b = $this->makeParticipatingUser();
        $c = $this->makeParticipatingUser(['referred_by' => $b->id]);
        $e = $this->makeParticipatingUser(['referred_by' => $b->id]);
        $d = $this->makeParticipatingUser(['referred_by' => $c->id]);
        $f = $this->makeParticipatingUser(['referred_by' => $c->id]);

        $this->makeActiveInvestment($b->id, '50.00', '0.0000');
        $this->makeActiveInvestment($c->id, '50.00', '0.0000');
        $this->makeActiveInvestment($e->id, '2000.00', '0.0000');
        $this->makeActiveInvestment($d->id, '10000.00', '1.0000');
        $this->makeActiveInvestment($f->id, '100.00', '0.0000');

        $payout = $svc->calculateLeaderDailyPayout($b->id);

        $this->assertSame('0.00', $payout['compression_usd']);
        $this->assertSame('0.00', $payout['generation_gap_usd']);
        $this->assertSame('5.00', $payout['same_rank_usd']);
        $this->assertSame('5.00', $payout['total']);
    }

    public function test_rank_two_same_rank_leg_pays_zero_until_upgrade(): void
    {
        $svc = app(\App\Services\Income\CommunityLeadershipService::class);

        // B and C both Rank 2 (self $100, team $5k, 3 directs)
        $b = $this->makeParticipatingUser();
        $c = $this->makeParticipatingUser(['referred_by' => $b->id]);
        $d1 = $this->makeParticipatingUser(['referred_by' => $b->id]);
        $d2 = $this->makeParticipatingUser(['referred_by' => $b->id]);
        $c1 = $this->makeParticipatingUser(['referred_by' => $c->id]);
        $c2 = $this->makeParticipatingUser(['referred_by' => $c->id]);
        $c3 = $this->makeParticipatingUser(['referred_by' => $c->id]);

        $this->makeActiveInvestment($b->id, '100.00', '0.0000');
        $this->makeActiveInvestment($c->id, '100.00', '0.0000');
        $this->makeActiveInvestment($d1->id, '2500.00', '1.0000');
        $this->makeActiveInvestment($d2->id, '2500.00', '0.0000');
        $this->makeActiveInvestment($c1->id, '2500.00', '1.0000');
        $this->makeActiveInvestment($c2->id, '2500.00', '0.0000');
        $this->makeActiveInvestment($c3->id, '100.00', '0.0000');

        $rankB = $svc->qualifyingRankRow($b->id);
        $rankC = $svc->qualifyingRankRow($c->id);
        $this->assertNotNull($rankB);
        $this->assertNotNull($rankC);
        $this->assertSame(2, (int) ($rankB['level'] ?? 0));
        $this->assertSame(2, (int) ($rankC['level'] ?? 0));

        $payout = $svc->calculateLeaderDailyPayout($b->id);

        // C's leg is same Rank 2 → blocked $0. Other legs may still pay.
        $sameLeg = collect($payout['legs'])->firstWhere('leg_root_user_id', $c->id);
        $this->assertNotNull($sameLeg);
        $this->assertSame('same_rank_blocked', $sameLeg['allocation']);
        $this->assertSame('0.00', $sameLeg['amount_usd']);
    }

    public function test_pay_command_records_generation_gap_and_same_rank_entries(): void
    {
        $svc = app(\App\Services\Income\CommunityLeadershipService::class);

        $b = $this->makeParticipatingUser();
        $c = $this->makeParticipatingUser(['referred_by' => $b->id]);
        $e = $this->makeParticipatingUser(['referred_by' => $b->id]);
        $d = $this->makeParticipatingUser(['referred_by' => $c->id]);
        $f = $this->makeParticipatingUser(['referred_by' => $c->id]);

        $this->makeActiveInvestment($b->id, '50.00', '0.0000');
        $this->makeActiveInvestment($c->id, '50.00', '0.0000');
        $this->makeActiveInvestment($e->id, '2000.00', '0.0000');
        $this->makeActiveInvestment($d->id, '10000.00', '1.0000');
        $this->makeActiveInvestment($f->id, '100.00', '0.0000');

        Artisan::call('income:pay-community-leadership', ['--period' => '2026-07-16']);

        $this->assertNotNull(LedgerEntry::query()
            ->where('user_id', $b->id)
            ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_LEADERSHIP_SKIP)
            ->where('amount_usd', '5.0000')
            ->first());

        $cPayout = $svc->calculateLeaderDailyPayout($c->id);
        $this->assertSame('10.00', $cPayout['total']);

        Artisan::call('income:pay-community-leadership', ['--period' => '2026-07-16']);

        $this->assertNotNull(LedgerEntry::query()
            ->where('user_id', $c->id)
            ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_LEADERSHIP)
            ->where('amount_usd', '10.0000')
            ->first());
    }

    public function test_live_data_page_returns_eleven_rank_rows(): void
    {
        $user = User::factory()->create([
            'participation_activated_at' => now(),
        ]);

        $props = app(\App\Services\Income\CommunityLeadershipService::class)->liveDataPagePropsFor($user);

        $this->assertCount(11, $props['rows']);
        $this->assertSame('L1', $props['rows'][0]['rank_code']);
        $this->assertSame('L11', $props['rows'][10]['rank_code']);
        $this->assertArrayHasKey('live_self_hold_usd', $props);
        $this->assertArrayNotHasKey('live', $props);

        $this->actingAs($user)
            ->get(route('leadership.live-data'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('LeadershipLiveData')
                ->has('rows', 11)
                ->has('live_self_hold_usd')
                ->missing('live'));
    }

    protected function makeParticipatingUser(array $overrides = []): User
    {
        return User::factory()->create(array_merge([
            'participation_activated_at' => now(),
        ], $overrides));
    }

    protected function makeActiveInvestment(int $userId, string $amountUsd, string $dailyRoiPercent): Investment
    {
        return Investment::query()->create([
            'user_id' => $userId,
            'amount_usd' => $amountUsd,
            'duration_days' => 365,
            'roi_percent_monthly' => '0.00',
            'roi_percent_daily' => $dailyRoiPercent,
            'total_roi_paid_usd' => '0.00',
            'roi_payouts_done' => 0,
            'cap_multiplier' => '1.00',
            'status' => Investment::STATUS_ACTIVE,
            'next_roi_at' => now()->addDay(),
        ]);
    }
}
