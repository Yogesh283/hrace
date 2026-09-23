<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Blockchain\UsdtTransferVerifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DepositSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_manual_deposit_route_is_disabled(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post('/deposits', ['amount_usd' => '100'])
            ->assertNotFound();
    }

    public function test_onchain_verify_requires_connected_wallet(): void
    {
        $user = User::factory()->create(['wallet_address' => null]);

        $this->actingAs($user)
            ->postJson(route('deposits.verify_onchain'), [
                'tx_hash' => '0x'.str_repeat('a', 64),
                'amount_usd' => 100,
            ])
            ->assertUnprocessable()
            ->assertJson(['error' => 'Connect your crypto wallet before depositing.']);
    }

    public function test_mainnet_rejects_non_official_usdt_contract(): void
    {
        config([
            'blockchain.chain_id' => 56,
            'blockchain.contracts.usdt' => '0x1111111111111111111111111111111111111111',
            'wallet.usdt_contract_bep20' => '0x1111111111111111111111111111111111111111',
        ]);

        $verifier = app(UsdtTransferVerifier::class);
        $result = $verifier->verifyTransferToTreasury(
            '0x'.str_repeat('b', 64),
            100,
            '0x2222222222222222222222222222222222222222',
            'deposit',
        );

        $this->assertFalse($result['ok']);
        $this->assertStringContainsString('Flash / fake USDT', (string) ($result['reason'] ?? ''));
    }

    public function test_testnet_rejects_mainnet_usdt_address(): void
    {
        config([
            'blockchain.chain_id' => 97,
            'blockchain.contracts.usdt' => UsdtTransferVerifier::OFFICIAL_USDT_MAINNET,
            'wallet.usdt_contract_bep20' => UsdtTransferVerifier::OFFICIAL_USDT_MAINNET,
        ]);

        $verifier = app(UsdtTransferVerifier::class);
        $result = $verifier->verifyTransferToTreasury(
            '0x'.str_repeat('c', 64),
            100,
            '0x2222222222222222222222222222222222222222',
            'deposit',
        );

        $this->assertFalse($result['ok']);
        $this->assertStringContainsString('Testnet', (string) ($result['reason'] ?? ''));
    }
}
