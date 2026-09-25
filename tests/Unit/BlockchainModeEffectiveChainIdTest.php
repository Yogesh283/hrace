<?php

namespace Tests\Unit;

use App\Support\BlockchainMode;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class BlockchainModeEffectiveChainIdTest extends TestCase
{
    public function test_forces_testnet_when_testnet_mock_usdt_configured(): void
    {
        Config::set('blockchain.chain_id', 56);
        Config::set('blockchain.contracts.usdt', '0xE30Fb617215c4EB5a0E4E6B1a5F537C0E28C8fEc');

        $this->assertSame(97, BlockchainMode::effectiveChainId());
    }

    public function test_respects_configured_chain_id_otherwise(): void
    {
        Config::set('blockchain.chain_id', 56);
        Config::set('blockchain.contracts.usdt', '0x55d398326f99059ff775485246999027b3197955');

        $this->assertSame(56, BlockchainMode::effectiveChainId());
    }
}
