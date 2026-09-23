<?php

namespace Tests\Feature;

use App\Models\IncomeWalletTransaction;
use App\Models\User;
use App\Models\Withdrawal;
use App\Services\Income\VirtualIncomeWalletService;
use App\Services\Income\WithdrawalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WithdrawalRejectRefundTest extends TestCase
{
    use RefreshDatabase;

    public function test_reject_restores_virtual_balance(): void
    {
        $user = User::factory()->create([
            'participation_activated_at' => now(),
            'wallet_address' => '0x1234567890123456789012345678901234567890',
        ]);

        app(VirtualIncomeWalletService::class)->credit(
            $user,
            IncomeWalletTransaction::TYPE_ADJUSTMENT,
            '100.00',
            'test',
            'seed:'.$user->id,
        );

        $before = app(VirtualIncomeWalletService::class)->availableBalance($user);
        $w = app(WithdrawalService::class)->request($user, '25.00', $user->wallet_address);
        $mid = app(VirtualIncomeWalletService::class)->availableBalance($user);
        $this->assertSame('75.0000', $mid);

        app(WithdrawalService::class)->reject($w->fresh());
        $after = app(VirtualIncomeWalletService::class)->availableBalance($user);
        $this->assertSame($before, $after);
        $this->assertSame(Withdrawal::STATUS_REJECTED, $w->fresh()->status);
    }

    public function test_duplicate_reject_does_not_double_refund(): void
    {
        $user = User::factory()->create([
            'participation_activated_at' => now(),
            'wallet_address' => '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        ]);

        app(VirtualIncomeWalletService::class)->credit(
            $user,
            IncomeWalletTransaction::TYPE_ADJUSTMENT,
            '50.00',
            'test',
            'seed2:'.$user->id,
        );

        $w = app(WithdrawalService::class)->request($user, '10.00', $user->wallet_address);
        app(WithdrawalService::class)->reject($w->fresh());
        $bal = app(VirtualIncomeWalletService::class)->availableBalance($user);
        app(WithdrawalService::class)->reject($w->fresh());
        $this->assertSame($bal, app(VirtualIncomeWalletService::class)->availableBalance($user));
    }
}
