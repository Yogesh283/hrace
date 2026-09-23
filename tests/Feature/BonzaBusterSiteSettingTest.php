<?php

namespace Tests\Feature;

use App\Models\LedgerEntry;
use App\Models\SiteSetting;
use App\Models\User;
use App\Services\Income\InvestmentRecorder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BonzaBusterSiteSettingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        $this->markTestSkipped('Bonanza removed — not in RACE Community Rewards PDF.');
        parent::setUp();
    }

    public function test_bonanza_percent_from_site_settings(): void
    {
        SiteSetting::set(SiteSetting::KEY_BONZA_BUSTER_ENABLED, '1');
        SiteSetting::set(SiteSetting::KEY_BONZA_BUSTER_DIRECT_PERCENT, '5.00');

        $sponsor = User::factory()->create();
        $referral = User::factory()->create(['referred_by' => $sponsor->id]);

        app(InvestmentRecorder::class)->record($referral, '1000', 180);

        $entry = LedgerEntry::query()
            ->where('user_id', $sponsor->id)
            ->where('entry_type', LedgerEntry::TYPE_BONZA_BUSTER)
            ->first();

        $this->assertNotNull($entry);
        $this->assertSame('50.00', (string) $entry->amount_usd);
    }

    public function test_bonanza_disabled_via_site_settings(): void
    {
        SiteSetting::set(SiteSetting::KEY_BONZA_BUSTER_ENABLED, '0');
        SiteSetting::set(SiteSetting::KEY_BONZA_BUSTER_DIRECT_PERCENT, '3.00');

        $sponsor = User::factory()->create();
        $referral = User::factory()->create(['referred_by' => $sponsor->id]);

        app(InvestmentRecorder::class)->record($referral, '1000', 180);

        $this->assertNull(
            LedgerEntry::query()
                ->where('user_id', $sponsor->id)
                ->where('entry_type', LedgerEntry::TYPE_BONZA_BUSTER)
                ->first()
        );
    }
}
