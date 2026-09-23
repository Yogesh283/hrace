<?php

namespace Tests\Feature;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Models\Withdrawal;
use App\Services\Income\CompoundStakeService;
use App\Services\Income\IncomeClaimService;
use App\Services\Income\InvestmentRecorder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CompoundStakeTest extends TestCase
{
    use RefreshDatabase;

    public function test_compound_reinvests_daily_roi_into_principal(): void
    {
        $user = User::factory()->create([
            'participation_activated_at' => now(),
        ]);

        app(\App\Services\Income\LedgerWriter::class)->record(
            $user,
            LedgerEntry::TYPE_WALLET_DEPOSIT,
            '200.00',
            'test',
            null,
            ['note' => 'seed'],
        );

        $inv = app(InvestmentRecorder::class)->record($user, '100.00', 0);
        $this->artisan('income:pay-roi')->assertSuccessful();

        app(IncomeClaimService::class)->claimAccruedIncome($user);

        $roi = LedgerEntry::query()
            ->where('user_id', $user->id)
            ->where('entry_type', LedgerEntry::TYPE_INCOME_CLAIM)
            ->where('reference_id', $inv->id)
            ->first();
        $this->assertNotNull($roi);

        $compoundable = app(CompoundStakeService::class)->compoundableUsd($user->id, $inv->id);
        $this->assertTrue(bccomp($compoundable, '0.01', 2) >= 0);

        $amount = app(CompoundStakeService::class)->compound($inv->fresh());
        $this->assertSame($compoundable, $amount);

        $inv->refresh();
        $this->assertSame(
            bcadd('100.00', $amount, 2),
            number_format((float) $inv->amount_usd, 2, '.', ''),
        );

        $this->assertDatabaseHas('ledger_entries', [
            'user_id' => $user->id,
            'entry_type' => LedgerEntry::TYPE_COMPOUND_REINVEST,
            'reference_id' => $inv->id,
        ]);

        $this->assertTrue($user->fresh()->compound_rewards_enabled);
        $this->assertSame(
            '0.00',
            app(CompoundStakeService::class)->compoundableUsd($user->id, $inv->id),
        );
    }

    public function test_compound_blocked_when_no_roi(): void
    {
        $user = User::factory()->create([
            'participation_activated_at' => now(),
        ]);

        app(\App\Services\Income\LedgerWriter::class)->record(
            $user,
            LedgerEntry::TYPE_WALLET_DEPOSIT,
            '200.00',
            'test',
            null,
            ['note' => 'seed'],
        );

        $inv = app(InvestmentRecorder::class)->record($user, '100.00', 180);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        app(CompoundStakeService::class)->compound($inv);
    }
}
