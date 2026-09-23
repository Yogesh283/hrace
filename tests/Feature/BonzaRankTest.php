<?php

namespace Tests\Feature;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\BonzaRankService;
use App\Services\Income\InvestmentRecorder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BonzaRankTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        $this->markTestSkipped('Affiliate Booster removed — not in RACE Community Rewards PDF.');
        parent::setUp();
    }

    public function test_sponsor_earns_bonanza_when_two_directs_activate_within_seven_days_of_sponsor_activation(): void
    {
        $sponsor = User::factory()->create();

        $d1 = User::factory()->create(['referred_by' => $sponsor->id]);
        $d2 = User::factory()->create(['referred_by' => $sponsor->id]);

        $recorder = app(InvestmentRecorder::class);

        $this->actingAs($sponsor);
        $recorder->record($sponsor, '500', 180);

        $recorder->record($d1, '500', 180);
        $recorder->record($d2, '600', 180);

        $sponsor->refresh();
        $d1->refresh();
        $d2->refresh();

        $this->assertNotNull($sponsor->id_activated_at);
        $this->assertNotNull($sponsor->bonza_rank_at);
        $this->assertNotNull($sponsor->bonza_direct_bonus_at);
        $this->assertNull($d1->bonza_direct_bonus_at);
        $this->assertNull($d2->bonza_direct_bonus_at);
    }

    public function test_direct_with_lower_hold_than_sponsor_does_not_count(): void
    {
        $sponsor = User::factory()->create();
        $d1 = User::factory()->create(['referred_by' => $sponsor->id]);
        $d2 = User::factory()->create(['referred_by' => $sponsor->id]);

        $recorder = app(InvestmentRecorder::class);
        $recorder->record($sponsor, '500', 180);
        $recorder->record($d1, '500', 180);
        $recorder->record($d2, '250', 180);

        $this->assertNull($sponsor->fresh()->bonza_rank_at);
        $this->assertSame(1, app(BonzaRankService::class)->qualifyingDirects($sponsor->fresh())->count());
    }

    public function test_direct_activating_after_seven_day_window_does_not_count(): void
    {
        $sponsor = User::factory()->create();
        $direct = User::factory()->create(['referred_by' => $sponsor->id]);

        $recorder = app(InvestmentRecorder::class);
        $recorder->record($sponsor, '100', 180);

        $sponsor->refresh();
        $this->travel(8)->days();

        $recorder->record($direct, '100', 180);

        $this->assertNull($sponsor->fresh()->bonza_rank_at);
        $this->assertSame(0, app(BonzaRankService::class)->qualifyingDirects($sponsor->fresh())->count());
    }

    public function test_bonanza_bonus_paid_on_sponsor_roi_run(): void
    {
        $sponsor = User::factory()->create([
            'bonza_direct_bonus_at' => now(),
            'id_activated_at' => now()->subDay(),
        ]);

        $inv = Investment::query()->create([
            'user_id' => $sponsor->id,
            'amount_usd' => '1000.00',
            'duration_days' => 365,
            'roi_percent_monthly' => '12.00',
            'roi_percent_daily' => '0.4000',
            'total_roi_paid_usd' => '0.00',
            'roi_payouts_done' => 0,
            'cap_multiplier' => '1.00',
            'status' => Investment::STATUS_ACTIVE,
            'next_roi_at' => now()->subMinute(),
        ]);

        $this->artisan('income:pay-roi')->assertSuccessful();

        $this->assertDatabaseHas('ledger_entries', [
            'user_id' => $sponsor->id,
            'entry_type' => LedgerEntry::TYPE_BONZA_DIRECT_BONUS,
            'reference_id' => $inv->id,
        ]);
    }
}
