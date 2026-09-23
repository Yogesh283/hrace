<?php

namespace Tests\Feature;

use App\Models\IncomeWalletTransaction;
use App\Models\User;
use kornrunner\Keccak;
use App\Services\Blockchain\IncomeVaultSettlementSigner;
use App\Services\Blockchain\OnChainIncomeReadService;
use App\Services\Income\VirtualIncomeWalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OnChainIncomeVaultTest extends TestCase
{
    use RefreshDatabase;

    public function test_income_type_bytes32_matches_solidity_keccak_label(): void
    {
        config(['income_vault.income_type_labels.'.IncomeWalletTransaction::TYPE_DAILY_REWARD => 'daily_reward']);
        $signer = app(IncomeVaultSettlementSigner::class);
        $hex = $signer->incomeTypeBytes32(IncomeWalletTransaction::TYPE_DAILY_REWARD);
        $this->assertSame('0x'.Keccak::hash('daily_reward', 256), strtolower($hex));
    }

    public function test_virtual_wallet_delegates_when_authoritative_flag_set(): void
    {
        config([
            'income_vault.enabled' => true,
            'income_vault.authoritative_balance' => true,
            'income_vault.contract_address' => '0x0000000000000000000000000000000000000001',
        ]);

        $user = User::factory()->create(['wallet_address' => '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd']);
        $read = $this->mock(OnChainIncomeReadService::class);
        $read->shouldReceive('balanceForUser')->once()->andReturn('12.3400');
        $this->instance(OnChainIncomeReadService::class, $read);

        $bal = app(VirtualIncomeWalletService::class)->availableBalance($user);
        $this->assertSame('12.3400', $bal);
    }

    public function test_reconcile_command_registered(): void
    {
        $this->artisan('income:reconcile-onchain')
            ->assertFailed();
    }
}
