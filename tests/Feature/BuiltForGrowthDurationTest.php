<?php

namespace Tests\Feature;

use App\Services\Income\InvestmentRecorder;
use App\Support\RewardPlan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BuiltForGrowthDurationTest extends TestCase
{
    use RefreshDatabase;

    public function test_daily_roi_percent_follows_official_staking_plan(): void
    {
        $user = $this->actingAsUser();

        $flex = app(InvestmentRecorder::class)->record($user, '50', 0);
        $this->assertSame('0.5000', (string) $flex->roi_percent_daily);

        $inv180 = app(InvestmentRecorder::class)->record($user, '100', 180);
        $this->assertSame('0.5000', (string) $inv180->roi_percent_daily);

        $inv365 = app(InvestmentRecorder::class)->record($user, '100', 365);
        $this->assertSame('0.7000', (string) $inv365->roi_percent_daily);

        $inv730 = app(InvestmentRecorder::class)->record($user, '100', 730);
        $this->assertSame('0.9000', (string) $inv730->roi_percent_daily);

        $inv1095 = app(InvestmentRecorder::class)->record($user, '50', 1095);
        $this->assertSame('1.0000', (string) $inv1095->roi_percent_daily);
    }

    public function test_official_staking_tiers_allowed(): void
    {
        $this->assertSame([0, 180, 365, 730, 1095], RewardPlan::growthAllowedDurations());
        $this->assertSame(10.0, RewardPlan::stakeWithdrawFeePercent());
    }

    public function test_rejects_legacy_one_day_and_ninety_day(): void
    {
        $user = $this->actingAsUser();

        $this->expectException(\InvalidArgumentException::class);
        app(InvestmentRecorder::class)->record($user, '100', 1);
    }

    private function actingAsUser()
    {
        $user = \App\Models\User::factory()->create();
        $this->actingAs($user);

        return $user;
    }
}
