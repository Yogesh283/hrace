<?php

namespace Tests\Feature;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\SiteSetting;
use App\Models\StakeUnlockEmi;
use App\Models\User;
use App\Services\Income\CompanyReserveLedger;
use App\Services\Income\InvestmentRecorder;
use App\Services\Income\StakeUnlockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class StakeUnlockEmiTest extends TestCase
{
    use RefreshDatabase;

    public function test_stake_unlock_takes_admin_fee_and_schedules_three_emis(): void
    {
        SiteSetting::set(SiteSetting::KEY_ADDRESS, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

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
        $this->assertSame(Investment::STATUS_ACTIVE, $inv->status);

        $unlock = app(StakeUnlockService::class)->startUnlock($inv->fresh());

        $this->assertSame('10.00', number_format((float) $unlock->admin_fee_usd, 2, '.', ''));
        $this->assertSame('90.00', number_format((float) $unlock->emi_pool_usd, 2, '.', ''));
        $this->assertCount(3, $unlock->emis);
        $this->assertSame(Investment::STATUS_UNLOCKING, $inv->fresh()->status);

        $company = app(CompanyReserveLedger::class)->user();
        $adminFee = LedgerEntry::query()
            ->where('user_id', $company->id)
            ->where('entry_type', LedgerEntry::TYPE_STAKE_UNLOCK_ADMIN_FEE)
            ->where('reference_type', 'stake_unlock')
            ->where('reference_id', $unlock->id)
            ->first();

        $this->assertNotNull($adminFee);
        $this->assertEqualsWithDelta(10.0, (float) $adminFee->amount_usd, 0.001);

        $emis = $unlock->emis->sortBy('emi_number')->values();
        $this->assertEqualsWithDelta(30.0, (float) $emis[0]->amount_usd, 0.001);
        $this->assertEqualsWithDelta(30.0, (float) $emis[1]->amount_usd, 0.001);
        $this->assertEqualsWithDelta(30.0, (float) $emis[2]->amount_usd, 0.001);
        $this->assertTrue($emis[0]->due_at->greaterThan(now()->addDays(29)));
        $this->assertTrue($emis[2]->due_at->greaterThan(now()->addDays(89)));
    }

    public function test_due_emis_credit_member_wallet(): void
    {
        SiteSetting::set(SiteSetting::KEY_ADDRESS, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');

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
        $svc = app(StakeUnlockService::class);
        $unlock = $svc->startUnlock($inv->fresh());

        $balanceBefore = (float) $user->fresh()->balance_usd;

        Carbon::setTestNow(now()->addDays(31));
        $paid = $svc->releaseDueEmis();
        $this->assertSame(1, $paid);

        $emi1 = StakeUnlockEmi::query()
            ->where('stake_unlock_id', $unlock->id)
            ->where('emi_number', 1)
            ->first();
        $this->assertSame(StakeUnlockEmi::STATUS_PAID, $emi1->status);

        $this->assertEqualsWithDelta(
            $balanceBefore + 30.0,
            (float) $user->fresh()->balance_usd,
            0.001,
        );

        Carbon::setTestNow(now()->addDays(60));
        $this->assertSame(2, $svc->releaseDueEmis());
        $this->assertSame(Investment::STATUS_UNLOCKED, $inv->fresh()->status);
        $this->assertSame('completed', $unlock->fresh()->status);

        Carbon::setTestNow();
    }

    public function test_flexible_after_10_days_has_no_unlock_fee(): void
    {
        SiteSetting::set(SiteSetting::KEY_ADDRESS, '0xcccccccccccccccccccccccccccccccccccccccc');

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
        Carbon::setTestNow(now()->addDays(10));

        $unlock = app(StakeUnlockService::class)->startUnlock($inv->fresh());

        $this->assertSame('0.00', number_format((float) $unlock->admin_fee_usd, 2, '.', ''));
        $this->assertSame('100.00', number_format((float) $unlock->emi_pool_usd, 2, '.', ''));
        $this->assertCount(3, $unlock->emis);
        $this->assertEqualsWithDelta(33.33, (float) $unlock->emis[0]->amount_usd, 0.01);
        $this->assertEqualsWithDelta(100.0, (float) $unlock->emis->sum(fn ($e) => (float) $e->amount_usd), 0.01);
        $this->assertSame(
            0,
            LedgerEntry::query()
                ->where('entry_type', LedgerEntry::TYPE_STAKE_UNLOCK_ADMIN_FEE)
                ->where('reference_id', $unlock->id)
                ->count(),
        );

        Carbon::setTestNow();
    }
}
