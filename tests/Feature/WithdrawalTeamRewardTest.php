<?php

namespace Tests\Feature;

use App\Models\IncomeWalletTransaction;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Models\Withdrawal;
use App\Services\Income\CompanyReserveLedger;
use App\Services\Income\LedgerWriter;
use App\Services\Income\VirtualIncomeWalletService;
use App\Services\Income\WithdrawalService;
use App\Support\RewardPlan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WithdrawalTeamRewardTest extends TestCase
{
    use RefreshDatabase;

    private function fundVirtual(User $user, string $amount): void
    {
        app(VirtualIncomeWalletService::class)->credit(
            $user,
            IncomeWalletTransaction::TYPE_ADJUSTMENT,
            $amount,
            'test:seed',
            'wtr_seed_'.$user->id.'_'.$amount,
        );
    }

    public function test_dual_fee_examples_match_business_rule(): void
    {
        $cases = [
            ['50', '5.00', '1.00', '44.00'],
            ['99', '9.90', '1.00', '88.10'],
            ['100', '10.00', '1.00', '89.00'],
            ['1000', '100.00', '10.00', '890.00'],
        ];

        foreach ($cases as [$gross, $team, $admin, $net]) {
            $calc = RewardPlan::calculateWalletWithdrawalFee($gross);
            $this->assertSame('dual', $calc['mode'], "mode for {$gross}");
            $this->assertSame($team, $calc['team_reward_usd'], "team for {$gross}");
            $this->assertSame($team, $calc['fee_usd'], "fee_usd alias for {$gross}");
            $this->assertSame($admin, $calc['admin_fee_usd'], "admin for {$gross}");
            $this->assertSame($net, $calc['net_usd'], "net for {$gross}");
            $this->assertSame(
                bcadd($team, $admin, 2),
                $calc['total_fee_usd'],
                "total for {$gross}",
            );
        }
    }

    public function test_income_withdrawal_applies_team_reward_and_separate_admin_fee(): void
    {
        $sponsor = User::factory()->create([
            'participation_activated_at' => now(),
        ]);
        $member = User::factory()->create([
            'referred_by' => $sponsor->id,
            'participation_activated_at' => now(),
        ]);

        $this->fundVirtual($member, '100.00');

        $withdrawal = app(WithdrawalService::class)->request(
            $member,
            '100',
            '0x1234567890123456789012345678901234567890',
        );

        $this->assertSame(Withdrawal::STATUS_PENDING, $withdrawal->status);
        $this->assertEqualsWithDelta(10.0, (float) $withdrawal->team_reward_usd, 0.001);
        $this->assertEqualsWithDelta(10.0, (float) $withdrawal->fee_usd, 0.001);
        $this->assertEqualsWithDelta(1.0, (float) $withdrawal->admin_fee_usd, 0.001);
        $this->assertEqualsWithDelta(89.0, (float) $withdrawal->net_usd, 0.001);

        // L1 gets 25% of $10 team pool = $2.50
        $l1 = LedgerEntry::query()
            ->where('user_id', $sponsor->id)
            ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_TEAM_REWARD)
            ->where('reference_id', $withdrawal->id)
            ->first();
        $this->assertNotNull($l1);
        $this->assertEqualsWithDelta(2.5, (float) $l1->amount_usd, 0.001);
        $this->assertSame(1, (int) ($l1->meta['level'] ?? 0));

        $company = app(CompanyReserveLedger::class)->user();

        // Separate $1 Admin Fee
        $adminFee = LedgerEntry::query()
            ->where('user_id', $company->id)
            ->where('entry_type', LedgerEntry::TYPE_WITHDRAWAL_ADMIN_FEE)
            ->where('reference_id', $withdrawal->id)
            ->where('meta->source', WithdrawalService::ADMIN_FEE_SOURCE)
            ->first();
        $this->assertNotNull($adminFee);
        $this->assertEqualsWithDelta(1.0, (float) $adminFee->amount_usd, 0.001);

        // Remaining 75% of team pool → unallocated (not the Admin Fee)
        $unallocated = LedgerEntry::query()
            ->where('user_id', $company->id)
            ->where('entry_type', LedgerEntry::TYPE_WITHDRAWAL_ADMIN_FEE)
            ->where('reference_id', $withdrawal->id)
            ->where('meta->source', 'team_reward_unallocated')
            ->first();
        $this->assertNotNull($unallocated);
        $this->assertEqualsWithDelta(7.5, (float) $unallocated->amount_usd, 0.001);
    }

    public function test_fifty_dollar_withdrawal_dual_fee_end_to_end(): void
    {
        $member = User::factory()->create([
            'participation_activated_at' => now(),
        ]);
        $this->fundVirtual($member, '50.00');

        $withdrawal = app(WithdrawalService::class)->request(
            $member,
            '50',
            '0x1234567890123456789012345678901234567890',
        );

        $this->assertSame('5.00', number_format((float) $withdrawal->team_reward_usd, 2, '.', ''));
        $this->assertSame('1.00', number_format((float) $withdrawal->admin_fee_usd, 2, '.', ''));
        $this->assertSame('44.00', number_format((float) $withdrawal->net_usd, 2, '.', ''));
    }

    public function test_l2_team_reward_pays_when_two_activated_directs(): void
    {
        $l2 = User::factory()->create(['participation_activated_at' => now()]);
        $l1 = User::factory()->create([
            'referred_by' => $l2->id,
            'participation_activated_at' => now(),
        ]);
        User::factory()->create([
            'referred_by' => $l2->id,
            'participation_activated_at' => now(),
        ]);
        $member = User::factory()->create([
            'referred_by' => $l1->id,
            'participation_activated_at' => now(),
        ]);

        $this->fundVirtual($member, '100.00');

        $withdrawal = app(WithdrawalService::class)->request(
            $member,
            '100',
            '0x1234567890123456789012345678901234567890',
        );

        $l1Pay = LedgerEntry::query()
            ->where('user_id', $l1->id)
            ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_TEAM_REWARD)
            ->where('reference_id', $withdrawal->id)
            ->first();
        $this->assertNotNull($l1Pay);
        $this->assertEqualsWithDelta(2.5, (float) $l1Pay->amount_usd, 0.001);

        $l2Pay = LedgerEntry::query()
            ->where('user_id', $l2->id)
            ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_TEAM_REWARD)
            ->where('reference_id', $withdrawal->id)
            ->where('meta->level', 2)
            ->first();
        $this->assertNotNull($l2Pay);
        $this->assertEqualsWithDelta(1.5, (float) $l2Pay->amount_usd, 0.001);
    }

    public function test_l2_team_reward_skipped_without_two_activated_directs(): void
    {
        $l2 = User::factory()->create(['participation_activated_at' => now()]);
        $l1 = User::factory()->create([
            'referred_by' => $l2->id,
            'participation_activated_at' => now(),
        ]);
        $member = User::factory()->create([
            'referred_by' => $l1->id,
            'participation_activated_at' => now(),
        ]);

        $this->fundVirtual($member, '100.00');

        $withdrawal = app(WithdrawalService::class)->request(
            $member,
            '100',
            '0x1234567890123456789012345678901234567890',
        );

        $this->assertNotNull(
            LedgerEntry::query()
                ->where('user_id', $l1->id)
                ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_TEAM_REWARD)
                ->where('reference_id', $withdrawal->id)
                ->first(),
        );

        $this->assertSame(
            0,
            LedgerEntry::query()
                ->where('user_id', $l2->id)
                ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_TEAM_REWARD)
                ->where('reference_id', $withdrawal->id)
                ->count(),
        );
    }

    public function test_duplicate_team_reward_not_paid_twice_on_same_withdrawal(): void
    {
        $sponsor = User::factory()->create(['participation_activated_at' => now()]);
        $member = User::factory()->create([
            'referred_by' => $sponsor->id,
            'participation_activated_at' => now(),
        ]);
        $this->fundVirtual($member, '100.00');

        $withdrawal = app(WithdrawalService::class)->request(
            $member,
            '100',
            '0x1234567890123456789012345678901234567890',
        );

        $svc = app(\App\Services\Income\AffiliateTeamRewardsService::class);
        $again = $svc->onWithdrawal($member->fresh(), $withdrawal->fresh());
        $this->assertSame('2.50', $again);

        $this->assertSame(
            1,
            LedgerEntry::query()
                ->where('user_id', $sponsor->id)
                ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_TEAM_REWARD)
                ->where('reference_id', $withdrawal->id)
                ->count(),
        );

        $this->assertSame(
            1,
            LedgerEntry::query()
                ->where('entry_type', LedgerEntry::TYPE_WITHDRAWAL_ADMIN_FEE)
                ->where('reference_id', $withdrawal->id)
                ->where('meta->source', WithdrawalService::ADMIN_FEE_SOURCE)
                ->count(),
        );
    }

    public function test_client_cannot_override_server_side_fees(): void
    {
        $member = User::factory()->create(['participation_activated_at' => now()]);
        $this->fundVirtual($member, '1000.00');

        $withdrawal = app(WithdrawalService::class)->request(
            $member,
            '1000',
            '0x1234567890123456789012345678901234567890',
        );

        // Only amount is accepted from caller; fees always recomputed server-side.
        $this->assertSame('100.00', number_format((float) $withdrawal->team_reward_usd, 2, '.', ''));
        $this->assertSame('10.00', number_format((float) $withdrawal->admin_fee_usd, 2, '.', ''));
        $this->assertSame('890.00', number_format((float) $withdrawal->net_usd, 2, '.', ''));
    }

    public function test_stake_unlock_fee_stays_admin_only_not_team_rewards(): void
    {
        \App\Models\SiteSetting::set(\App\Models\SiteSetting::KEY_ADDRESS, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

        $sponsor = User::factory()->create(['participation_activated_at' => now()]);
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

        $inv = app(\App\Services\Income\InvestmentRecorder::class)->record($member, '100.00', 0);
        app(\App\Services\Income\StakeUnlockService::class)->startUnlock($inv->fresh());

        $this->assertSame(
            0,
            LedgerEntry::query()
                ->where('user_id', $sponsor->id)
                ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_TEAM_REWARD)
                ->count(),
        );

        $company = app(CompanyReserveLedger::class)->user();
        $this->assertTrue(
            LedgerEntry::query()
                ->where('user_id', $company->id)
                ->where('entry_type', LedgerEntry::TYPE_STAKE_UNLOCK_ADMIN_FEE)
                ->exists(),
        );
    }
}
