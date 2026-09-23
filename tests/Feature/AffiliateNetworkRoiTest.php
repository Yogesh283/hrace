<?php

namespace Tests\Feature;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\InvestmentRecorder;
use App\Services\Income\LedgerWriter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AffiliateNetworkRoiTest extends TestCase
{
    use RefreshDatabase;

    public function test_sponsor_receives_ten_percent_of_direct_daily_roi(): void
    {
        $sponsor = User::factory()->create([
            'participation_activated_at' => now(),
        ]);
        $member = User::factory()->create([
            'referred_by' => $sponsor->id,
            'participation_activated_at' => now(),
        ]);

        app(LedgerWriter::class)->record(
            $member,
            LedgerEntry::TYPE_WALLET_DEPOSIT,
            '200.00',
            'test',
            null,
            ['note' => 'seed'],
        );

        $inv = app(InvestmentRecorder::class)->record($member, '100.00', 180);
        $this->artisan('income:pay-roi')->assertSuccessful();

        $roi = LedgerEntry::query()
            ->where('user_id', $member->id)
            ->where('entry_type', LedgerEntry::TYPE_ROI_ACCRUAL)
            ->where('reference_id', $inv->id)
            ->first();
        $this->assertNotNull($roi);

        // $100 × 0.50% = $0.50 ROI → sponsor 10% = $0.05
        $share = LedgerEntry::query()
            ->where('user_id', $sponsor->id)
            ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI)
            ->where('reference_id', $inv->id)
            ->first();

        $this->assertNotNull($share);
        $this->assertEqualsWithDelta(0.05, (float) $share->amount_usd, 0.0001);
        $this->assertSame(1, (int) ($share->meta['network_level'] ?? 0));
    }

    public function test_level_two_upline_does_not_receive_roi_sharing(): void
    {
        $grandparent = User::factory()->create([
            'participation_activated_at' => now(),
        ]);
        $sponsor = User::factory()->create([
            'referred_by' => $grandparent->id,
            'participation_activated_at' => now(),
        ]);
        $member = User::factory()->create([
            'referred_by' => $sponsor->id,
            'participation_activated_at' => now(),
        ]);

        app(LedgerWriter::class)->record(
            $member,
            LedgerEntry::TYPE_WALLET_DEPOSIT,
            '200.00',
            'test',
            null,
            ['note' => 'seed'],
        );

        $inv = app(InvestmentRecorder::class)->record($member, '100.00', 180);
        $this->artisan('income:pay-roi')->assertSuccessful();

        $this->assertDatabaseHas('ledger_entries', [
            'user_id' => $sponsor->id,
            'entry_type' => LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI,
            'reference_id' => $inv->id,
        ]);

        $this->assertDatabaseMissing('ledger_entries', [
            'user_id' => $grandparent->id,
            'entry_type' => LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI,
            'reference_id' => $inv->id,
        ]);
    }

    public function test_unlimited_directs_each_pay_sponsor(): void
    {
        $sponsor = User::factory()->create([
            'participation_activated_at' => now(),
        ]);

        $shares = 0.0;
        for ($i = 0; $i < 3; $i++) {
            $member = User::factory()->create([
                'referred_by' => $sponsor->id,
                'participation_activated_at' => now(),
            ]);
            app(LedgerWriter::class)->record(
                $member,
                LedgerEntry::TYPE_WALLET_DEPOSIT,
                '200.00',
                'test',
                null,
                ['note' => 'seed'],
            );
            app(InvestmentRecorder::class)->record($member, '100.00', 180);
        }

        $this->artisan('income:pay-roi')->assertSuccessful();

        $total = (float) LedgerEntry::query()
            ->where('user_id', $sponsor->id)
            ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI)
            ->sum('amount_usd');

        // 3 directs × ($100 × 0.50% × 10%) = 3 × 0.05 = 0.15
        $this->assertEqualsWithDelta(0.15, $total, 0.001);
    }
}
