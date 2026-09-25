<?php

namespace Tests\Feature;

use App\Services\Blockchain\BlockchainContractPayload;
use App\Support\LegacyParticipationGuard;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LegacyParticipationDisabledTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'participation_contract.legacy.application_enabled' => false,
            'blockchain.contracts.community_engine' => '0xbdDeA78d9Ef21BF7E8577de8BFe599E5dd0456ef',
            'blockchain.contracts.participation' => '0x9BF2E3405c0cB666C6664BD7651dab3F656fEDA5',
        ]);
    }

    public function test_engine_payload_does_not_expose_legacy_participation_contract(): void
    {
        $payload = BlockchainContractPayload::enginePayload();

        $this->assertSame('0xbdDeA78d9Ef21BF7E8577de8BFe599E5dd0456ef', $payload['engine_contract']);
        $this->assertSame('', $payload['participation_contract']);
        $this->assertSame('0xbdDeA78d9Ef21BF7E8577de8BFe599E5dd0456ef', $payload['contract']);
        $this->assertArrayHasKey('income_hold', $payload);
    }

    public function test_legacy_guard_blocks_legacy_contract_address(): void
    {
        $reason = LegacyParticipationGuard::blockReasonForContract('0x9BF2E3405c0cB666C6664BD7651dab3F656fEDA5');

        $this->assertNotNull($reason);
    }

    public function test_participation_verify_route_rejects_when_only_legacy_would_apply(): void
    {
        config(['blockchain.contracts.community_engine' => '']);

        $user = \App\Models\User::factory()->create([
            'wallet_address' => '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
        ]);

        $this->actingAs($user)
            ->postJson(route('participation.verify_onchain'), [
                'tx_hash' => '0x'.str_repeat('a', 64),
            ])
            ->assertStatus(422);
    }
}
