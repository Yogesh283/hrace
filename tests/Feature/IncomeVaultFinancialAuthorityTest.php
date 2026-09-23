<?php

namespace Tests\Feature;

use App\Models\IncomeWalletTransaction;
use App\Models\User;
use App\Support\IncomeVaultFinancialAuthority;
use App\Services\Income\VirtualIncomeWalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IncomeVaultFinancialAuthorityTest extends TestCase
{
    use RefreshDatabase;

    public function test_authoritative_mode_blocks_virtual_credit(): void
    {
        config([
            'income_vault.enabled' => true,
            'income_vault.authoritative_balance' => true,
            'income_vault.contract_address' => '0x0000000000000000000000000000000000000001',
        ]);

        $user = User::factory()->create();
        $this->expectException(\RuntimeException::class);
        app(VirtualIncomeWalletService::class)->credit(
            $user,
            IncomeWalletTransaction::TYPE_DAILY_REWARD,
            '10.0000',
        );
    }

    public function test_read_model_mirror_allowed_when_authoritative(): void
    {
        config([
            'income_vault.enabled' => true,
            'income_vault.authoritative_balance' => true,
            'income_vault.contract_address' => '0x0000000000000000000000000000000000000001',
        ]);

        $this->assertTrue(
            IncomeVaultFinancialAuthority::isReadModelMirrorWrite(['read_model_mirror' => true]),
        );
    }
}
