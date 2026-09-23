<?php

namespace Tests\Feature;

use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\InvestmentRecorder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BonzaBusterTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        $this->markTestSkipped('Bonanza removed — not in RACE Community Rewards PDF.');
        parent::setUp();
    }

    public function test_direct_sponsor_receives_three_percent_on_referral_investment(): void
    {
        $sponsor = User::factory()->create();
        $referral = User::factory()->create(['referred_by' => $sponsor->id]);

        $recorder = app(InvestmentRecorder::class);
        $recorder->record($referral, '1000', 180);

        $entry = LedgerEntry::query()
            ->where('user_id', $sponsor->id)
            ->where('entry_type', LedgerEntry::TYPE_BONZA_BUSTER)
            ->first();

        $this->assertNotNull($entry);
        $this->assertSame('30.00', (string) $entry->amount_usd);
        $this->assertSame(1, (int) ($entry->meta['level'] ?? 0));
        $this->assertSame($referral->id, (int) ($entry->meta['from_user_id'] ?? 0));
    }

    public function test_level_one_receives_affiliate_referral_separate_from_bonanza(): void
    {
        $sponsor = User::factory()->create();
        $referral = User::factory()->create(['referred_by' => $sponsor->id]);

        app(InvestmentRecorder::class)->record($referral, '1000', 180);

        $bonanza = LedgerEntry::query()
            ->where('user_id', $sponsor->id)
            ->where('entry_type', LedgerEntry::TYPE_BONZA_BUSTER)
            ->first();
        $referralIncome = LedgerEntry::query()
            ->where('user_id', $sponsor->id)
            ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_REFERRAL)
            ->where('meta->level', 1)
            ->first();

        $this->assertNull(
            LedgerEntry::query()
                ->where('user_id', $sponsor->id)
                ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_SPONSOR)
                ->first(),
        );

        $this->assertNotNull($bonanza);
        $this->assertSame('30.00', (string) $bonanza->amount_usd);
        $this->assertNotNull($referralIncome);
        $this->assertSame('50.00', (string) $referralIncome->amount_usd);
    }

    public function test_grandparent_receives_affiliate_referral_level_two(): void
    {
        $grandparent = User::factory()->create(['id_activated_at' => now()]);
        $sponsor = User::factory()->create([
            'referred_by' => $grandparent->id,
            'id_activated_at' => now(),
        ]);
        User::factory()->create([
            'referred_by' => $grandparent->id,
            'id_activated_at' => now(),
        ]);
        $referral = User::factory()->create(['referred_by' => $sponsor->id]);

        app(InvestmentRecorder::class)->record($referral, '1000', 180);

        $entry = LedgerEntry::query()
            ->where('user_id', $grandparent->id)
            ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_SPONSOR)
            ->where('meta->level', 2)
            ->first();

        $this->assertNotNull($entry);
        $this->assertSame('10.00', (string) $entry->amount_usd);
    }
}
