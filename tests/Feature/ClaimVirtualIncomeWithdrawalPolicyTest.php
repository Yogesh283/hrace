<?php

namespace Tests\Feature;

use App\Models\IncomeWalletTransaction;
use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Models\Withdrawal;
use App\Services\Income\CompanyReserveLedger;
use App\Services\Income\IncomeClaimService;
use App\Services\Income\InvestmentRecorder;
use App\Services\Income\VirtualIncomeWalletService;
use App\Services\Income\WalletBalanceService;
use App\Services\Income\WithdrawalService;
use App\Support\RewardPlan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClaimVirtualIncomeWithdrawalPolicyTest extends TestCase
{
    use RefreshDatabase;

    private function seedMemberWithBalance(string $deposit = '1000.00'): User
    {
        $member = User::factory()->create(['participation_activated_at' => now()]);
        app(VirtualIncomeWalletService::class)->credit(
            $member,
            IncomeWalletTransaction::TYPE_ADJUSTMENT,
            $deposit,
            'test:seed',
            'test_virtual_seed_'.spl_object_id($member),
        );

        return $member;
    }

    private function accrueOnce(User $member): Investment
    {
        $inv = app(InvestmentRecorder::class)->record($member, '100.00', 180);
        $this->artisan('income:pay-roi')->assertSuccessful();

        return $inv->fresh();
    }

    public function test_accrual_does_not_credit_virtual_wallet_until_claim(): void
    {
        $member = User::factory()->create(['participation_activated_at' => now()]);
        $before = app(WalletBalanceService::class)->virtualIncomeBalance($member);

        $inv = app(InvestmentRecorder::class)->record($member, '100.00', 180);
        $this->artisan('income:pay-roi')->assertSuccessful();

        $inv = $inv->fresh();
        $this->assertDatabaseHas('ledger_entries', [
            'user_id' => $member->id,
            'entry_type' => LedgerEntry::TYPE_ROI_ACCRUAL,
            'reference_id' => $inv->id,
        ]);
        $this->assertGreaterThan(0, (float) $inv->accrued_reward_usd);
        $this->assertSame($before, app(WalletBalanceService::class)->virtualIncomeBalance($member->fresh()));
    }

    public function test_claim_creates_virtual_balance_with_zero_admin_fee(): void
    {
        $member = $this->seedMemberWithBalance();
        $inv = $this->accrueOnce($member);
        $accrued = (float) $inv->accrued_reward_usd;

        $result = app(IncomeClaimService::class)->claimAccruedIncome($member);

        $this->assertGreaterThan(0, (float) $result['claimed_usd']);
        $this->assertSame('0.0000', number_format((float) $inv->fresh()->accrued_reward_usd, 4, '.', ''));

        $this->assertDatabaseHas('ledger_entries', [
            'user_id' => $member->id,
            'entry_type' => LedgerEntry::TYPE_INCOME_CLAIM,
            'reference_id' => $inv->id,
        ]);

        $company = app(CompanyReserveLedger::class)->user();
        $this->assertSame(
            0,
            LedgerEntry::query()
                ->where('user_id', $company->id)
                ->where('entry_type', LedgerEntry::TYPE_WITHDRAWAL_ADMIN_FEE)
                ->where('meta->source', WithdrawalService::ADMIN_FEE_SOURCE)
                ->count(),
        );

        $wallet = app(WalletBalanceService::class)->virtualIncomeBalance($member->fresh());
        $this->assertEqualsWithDelta(1000.0 + $accrued, (float) $wallet, 0.05);
    }

    public function test_accumulated_accruals_add_and_claim_in_one_sum(): void
    {
        $member = $this->seedMemberWithBalance();
        $inv = app(InvestmentRecorder::class)->record($member, '100.00', 180);

        $inv->forceFill(['next_roi_at' => now()->subDays(3)])->save();
        $this->artisan('income:pay-roi')->assertSuccessful();

        $accrued = (float) $inv->fresh()->accrued_reward_usd;
        $this->assertGreaterThan(0.5, $accrued);

        $claimed = app(IncomeClaimService::class)->claimAccruedIncome($member);
        $this->assertEqualsWithDelta($accrued, (float) $claimed['claimed_usd'], 0.0001);
    }

    public function test_admin_fee_examples_on_withdrawal(): void
    {
        $cases = [
            ['50', '1.00'],
            ['99', '1.00'],
            ['100', '1.00'],
            ['500', '5.00'],
        ];

        foreach ($cases as [$gross, $admin]) {
            $calc = RewardPlan::calculateWalletWithdrawalFee($gross);
            $this->assertSame($admin, $calc['admin_fee_usd'], "admin fee for gross {$gross}");
        }
    }

    public function test_fifty_and_five_hundred_withdrawal_end_to_end_fees(): void
    {
        $member = $this->seedMemberWithBalance('2000.00');

        $w50 = app(WithdrawalService::class)->request(
            $member,
            '50',
            '0x1234567890123456789012345678901234567890',
        );
        $this->assertSame('1.00', number_format((float) $w50->admin_fee_usd, 2, '.', ''));
        $this->assertSame('44.00', number_format((float) $w50->net_usd, 2, '.', ''));

        $w500 = app(WithdrawalService::class)->request(
            $member,
            '500',
            '0x1234567890123456789012345678901234567890',
        );
        $this->assertSame('5.00', number_format((float) $w500->admin_fee_usd, 2, '.', ''));
        $this->assertSame('445.00', number_format((float) $w500->net_usd, 2, '.', ''));
    }

    public function test_admin_fee_charged_only_once_per_withdrawal(): void
    {
        $member = $this->seedMemberWithBalance('500.00');
        $withdrawal = app(WithdrawalService::class)->request(
            $member,
            '100',
            '0x1234567890123456789012345678901234567890',
        );

        app(WithdrawalService::class)->approve($withdrawal->fresh());

        $count = LedgerEntry::query()
            ->where('entry_type', LedgerEntry::TYPE_WITHDRAWAL_ADMIN_FEE)
            ->where('reference_id', $withdrawal->id)
            ->where('meta->source', WithdrawalService::ADMIN_FEE_SOURCE)
            ->count();

        $this->assertSame(1, $count);
    }

    public function test_user_cannot_bypass_fee_through_frontend_payload(): void
    {
        $member = $this->seedMemberWithBalance('2000.00');

        $response = $this->actingAs($member)->post(route('withdrawals.store'), [
            'amount_usd' => '500',
            'destination_address' => '0x1234567890123456789012345678901234567890',
            'admin_fee_usd' => '0.01',
            'net_usd' => '999.00',
            'team_reward_usd' => '0.00',
        ]);

        $response->assertRedirect();
        $withdrawal = Withdrawal::query()->where('user_id', $member->id)->latest('id')->first();
        $this->assertNotNull($withdrawal);
        $this->assertSame('5.00', number_format((float) $withdrawal->admin_fee_usd, 2, '.', ''));
        $this->assertSame('445.00', number_format((float) $withdrawal->net_usd, 2, '.', ''));
    }

    public function test_claim_has_zero_admin_fee_even_when_user_posts_fake_fee(): void
    {
        $member = $this->seedMemberWithBalance();
        $this->accrueOnce($member);

        $response = $this->actingAs($member)->post(route('income.claim'), [
            'admin_fee_usd' => '99.00',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('ledger_entries', [
            'user_id' => $member->id,
            'entry_type' => LedgerEntry::TYPE_INCOME_CLAIM,
        ]);

        $company = app(CompanyReserveLedger::class)->user();
        $this->assertSame(
            0,
            LedgerEntry::query()
                ->where('user_id', $company->id)
                ->where('entry_type', LedgerEntry::TYPE_WITHDRAWAL_ADMIN_FEE)
                ->count(),
        );
    }
}
