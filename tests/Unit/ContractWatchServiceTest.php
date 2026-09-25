<?php

namespace Tests\Unit;

use App\Services\Blockchain\ContractWatchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ContractWatchServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_snapshot_returns_watch_keys(): void
    {
        config([
            'blockchain.rpc_url' => '',
            'blockchain.rpc_urls' => [],
            'blockchain.indexer.rpc_urls' => [],
        ]);

        $snap = app(ContractWatchService::class)->snapshot();

        $this->assertArrayHasKey('addresses', $snap);
        $this->assertArrayHasKey('live', $snap);
        $this->assertArrayHasKey('events', $snap);
        $this->assertArrayHasKey('explorer', $snap);
        $this->assertArrayHasKey('race_ico', $snap['addresses']);
        $this->assertArrayHasKey('income_hold', $snap['addresses']);
        $this->assertArrayHasKey('community_engine', $snap['addresses']);
    }
}
