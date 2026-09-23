<?php

namespace Tests\Unit;

use App\Services\Blockchain\CompoundTransactionVerifier;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CompoundTransactionVerifierChainTest extends TestCase
{
    public function test_rejects_zero_chain_id(): void
    {
        config([
            'blockchain.chain_id' => 0,
            'blockchain.rpc_url' => 'https://rpc.test',
            'blockchain.contracts.community_engine' => '0xbdDeA78d9Ef21BF7E8577de8BFe599E5dd0456ef',
        ]);

        $verifier = CompoundTransactionVerifier::make();
        $result = $verifier->verify('0x'.str_repeat('1', 64), '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', 0);

        $this->assertFalse($result['ok']);
        $this->assertSame('chain_not_configured', $result['reason']);
    }

    public function test_rejects_unsupported_chain_id(): void
    {
        config([
            'blockchain.chain_id' => 1,
            'blockchain.rpc_url' => 'https://rpc.test',
            'blockchain.contracts.community_engine' => '0xbdDeA78d9Ef21BF7E8577de8BFe599E5dd0456ef',
        ]);

        $verifier = CompoundTransactionVerifier::make();
        $result = $verifier->verify('0x'.str_repeat('4', 64), '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', 0);

        $this->assertFalse($result['ok']);
        $this->assertSame('chain_not_configured', $result['reason']);
    }

    public function test_chain_97_proceeds_past_legacy_testnet_gate(): void
    {
        config([
            'blockchain.chain_id' => 97,
            'blockchain.rpc_url' => 'https://rpc.test',
            'blockchain.rpc_urls' => ['https://rpc.test'],
            'blockchain.indexer.rpc_urls' => ['https://rpc.test'],
            'blockchain.contracts.community_engine' => '0xbdDeA78d9Ef21BF7E8577de8BFe599E5dd0456ef',
        ]);

        Http::fake([
            '*' => Http::sequence()
                ->push(['jsonrpc' => '2.0', 'id' => 1, 'result' => '0x61'])
                ->push(['jsonrpc' => '2.0', 'id' => 1, 'result' => null]),
        ]);

        $verifier = CompoundTransactionVerifier::make();
        $result = $verifier->verify('0x'.str_repeat('2', 64), '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', 0);

        $this->assertFalse($result['ok']);
        $this->assertSame('receipt_missing', $result['reason']);
    }

    public function test_chain_56_configuration_supported(): void
    {
        config([
            'blockchain.chain_id' => 56,
            'blockchain.rpc_url' => 'https://rpc.test',
            'blockchain.rpc_urls' => ['https://rpc.test'],
            'blockchain.indexer.rpc_urls' => ['https://rpc.test'],
            'blockchain.contracts.community_engine' => '0x0000000000000000000000000000000000000001',
        ]);

        Http::fake([
            '*' => Http::sequence()
                ->push(['jsonrpc' => '2.0', 'id' => 1, 'result' => '0x38'])
                ->push(['jsonrpc' => '2.0', 'id' => 1, 'result' => null]),
        ]);

        $verifier = CompoundTransactionVerifier::make();
        $result = $verifier->verify('0x'.str_repeat('3', 64), '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', 0);

        $this->assertFalse($result['ok']);
        $this->assertSame('receipt_missing', $result['reason']);
    }
}
