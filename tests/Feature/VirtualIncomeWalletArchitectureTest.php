<?php

namespace Tests\Feature;

use App\Models\IncomeWalletTransaction;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\AffiliateNetworkRoiService;
use App\Services\Income\CommunityLeadershipService;
use App\Services\Income\IncomeClaimService;
use App\Services\Income\InvestmentRecorder;
use App\Services\Income\LedgerWriter;
use App\Services\Income\VirtualIncomeCompoundService;
use App\Services\Income\VirtualIncomeWalletService;
use App\Services\Income\WithdrawalService;
use App\Support\RewardPlan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VirtualIncomeWalletArchitectureTest extends TestCase
{
    use RefreshDatabase;

    private function fundVirtual(User $user, string $amount = '500.00'): void
    {
        app(VirtualIncomeWalletService::class)->credit(
            $user,
            IncomeWalletTransaction::TYPE_ADJUSTMENT,
            $amount,
            'test:fund',
            'fund_'.$user->id.'_'.$amount,
        );
    }

    public function test_daily_reward_claim_credits_virtual_wallet_without_per_event_mint(): void
    {
        $member = User::factory()->create(['participation_activated_at' => now()]);
        app(InvestmentRecorder::class)->record($member, '100.00', 180);
        $this->artisan('income:pay-roi')->assertSuccessful();
        app(IncomeClaimService::class)->claimAccruedIncome($member);

        $this->assertDatabaseHas('income_wallet_transactions', [
            'user_id' => $member->id,
            'type' => IncomeWalletTransaction::TYPE_INCOME_CLAIM,
            'direction' => IncomeWalletTransaction::DIRECTION_CREDIT,
        ]);
        $this->assertGreaterThan(0, (float) app(VirtualIncomeWalletService::class)->availableBalance($member));
    }

    public function test_level_income_credits_virtual_wallet_via_ledger_mirror(): void
    {
        $upline = User::factory()->create(['participation_activated_at' => now()]);
        $this->fundVirtual($upline, '100.00');

        app(LedgerWriter::class)->record(
            $upline,
            LedgerEntry::TYPE_COMMUNITY_LEADERSHIP,
            '3.50',
            'test',
            1,
            ['level' => 1],
        );

        $this->assertDatabaseHas('income_wallet_transactions', [
            'user_id' => $upline->id,
            'type' => IncomeWalletTransaction::TYPE_LEVEL_INCOME,
            'direction' => IncomeWalletTransaction::DIRECTION_CREDIT,
        ]);
    }

    public function test_multiple_sources_aggregate_in_one_balance(): void
    {
        $user = User::factory()->create(['participation_activated_at' => now()]);
        app(VirtualIncomeWalletService::class)->credit($user, IncomeWalletTransaction::TYPE_TEAM_INCOME, '10.0000', 't:1', 't1');
        app(VirtualIncomeWalletService::class)->credit($user, IncomeWalletTransaction::TYPE_LEVEL_INCOME, '5.5000', 'l:1', 'l1');

        $this->assertSame('15.5000', app(VirtualIncomeWalletService::class)->availableBalance($user));
    }

    public function test_compound_debits_once_and_idempotent_reserve(): void
    {
        $user = User::factory()->create(['participation_activated_at' => now(), 'wallet_address' => '0x1234567890123456789012345678901234567890']);
        $this->fundVirtual($user, '20.00');
        $svc = app(VirtualIncomeCompoundService::class);

        $a = $svc->reserve($user, '10', 'compound-key-1', 0);
        $b = $svc->reserve($user, '10', 'compound-key-1', 0);
        $this->assertSame($a['transaction_id'], $b['transaction_id']);

        $this->assertSame('10.0000', app(VirtualIncomeWalletService::class)->availableBalance($user));
    }

    public function test_compound_confirm_idempotent_on_tx_hash(): void
    {
        $this->mock(\App\Services\Blockchain\CompoundTransactionVerifier::class, function ($mock) {
            $mock->shouldReceive('verify')->andReturn(['ok' => true, 'reason' => null, 'log_index' => 1]);
        });

        $user = User::factory()->create(['participation_activated_at' => now(), 'wallet_address' => '0x1234567890123456789012345678901234567890']);
        $this->fundVirtual($user, '20.00');
        $svc = app(VirtualIncomeCompoundService::class);
        $svc->reserve($user, '10', 'compound-key-2', 0);

        $tx = '0x'.str_repeat('ab', 32);
        $row1 = $svc->confirmOnChain($user, 'compound-key-2', $tx);
        $row2 = $svc->confirmOnChain($user, 'compound-key-2', $tx);
        $this->assertSame($row1->id, $row2->id);
        $this->assertSame($tx, $row2->metadata['tx_hash'] ?? null);
    }

    public function test_compound_confirm_bogus_tx_refunds_virtual_balance(): void
    {
        $this->mock(\App\Services\Blockchain\CompoundTransactionVerifier::class, function ($mock) {
            $mock->shouldReceive('verify')->andReturn(['ok' => false, 'reason' => 'receipt_missing', 'log_index' => null]);
        });

        $user = User::factory()->create(['participation_activated_at' => now(), 'wallet_address' => '0x1234567890123456789012345678901234567890']);
        $this->fundVirtual($user, '20.00');
        $svc = app(VirtualIncomeCompoundService::class);
        $svc->reserve($user, '10', 'compound-key-bogus', 0);

        try {
            $svc->confirmOnChain($user, 'compound-key-bogus', '0x'.str_repeat('cd', 32));
            $this->fail('Expected validation exception');
        } catch (\Illuminate\Validation\ValidationException) {
            // expected
        }

        $this->assertSame('20.0000', app(VirtualIncomeWalletService::class)->availableBalance($user));
    }

    public function test_withdrawal_admin_fee_examples(): void
    {
        foreach ([['50', '1.00'], ['99', '1.00'], ['100', '1.00'], ['500', '5.00']] as [$g, $fee]) {
            $calc = RewardPlan::calculateWalletWithdrawalFee($g);
            $this->assertSame($fee, $calc['admin_fee_usd']);
        }
    }

    public function test_duplicate_withdrawal_request_cannot_double_debit_virtual_wallet(): void
    {
        $member = User::factory()->create(['participation_activated_at' => now()]);
        $this->fundVirtual($member, '200.00');
        $svc = app(WithdrawalService::class);

        $svc->request($member, '50', '0x1234567890123456789012345678901234567890');
        $this->assertSame('150.0000', app(VirtualIncomeWalletService::class)->availableBalance($member->fresh()));

        $this->assertSame(
            1,
            \App\Models\IncomeWalletTransaction::query()
                ->where('user_id', $member->id)
                ->where('type', IncomeWalletTransaction::TYPE_WITHDRAWAL)
                ->count(),
        );
    }

    public function test_dashboard_summary_single_combined_balance(): void
    {
        $user = User::factory()->create();
        app(VirtualIncomeWalletService::class)->credit($user, IncomeWalletTransaction::TYPE_DAILY_REWARD, '2.0000', 'd:1', 'd1');
        $summary = app(VirtualIncomeWalletService::class)->dashboardSummary($user);
        $this->assertSame('2.0000', $summary['available_balance_usd']);
    }

    public function test_income_history_preserves_source_type(): void
    {
        $user = User::factory()->create();
        app(VirtualIncomeWalletService::class)->credit($user, IncomeWalletTransaction::TYPE_TEAM_INCOME, '1.0000', 'w:1', 'w1');
        $this->assertDatabaseHas('income_wallet_transactions', [
            'user_id' => $user->id,
            'type' => IncomeWalletTransaction::TYPE_TEAM_INCOME,
        ]);
    }
}
