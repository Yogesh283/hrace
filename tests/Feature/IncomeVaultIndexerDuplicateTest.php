<?php

namespace Tests\Feature;

use App\Models\OnChainIncomeLedgerEntry;
use App\Services\Blockchain\IncomeVaultIndexer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IncomeVaultIndexerDuplicateTest extends TestCase
{
    use RefreshDatabase;

    public function test_duplicate_event_identity_updates_not_duplicates_rows(): void
    {
        $this->artisan('migrate');

        $indexer = app(IncomeVaultIndexer::class);
        $payload = [
            'user' => '0xabcabcabcabcabcabcabcabcabcabcabcabcabca',
            'wallet' => '0xabcabcabcabcabcabcabcabcabcabcabcabcabca',
            'amount' => '10.00000000',
        ];

        $indexer->ingestEvent('IncomeCredited', $payload, '0xtx1', 100, 0, '0xvault', 97, '0xblock', '0xsig');
        $indexer->ingestEvent('IncomeCredited', $payload, '0xtx1', 100, 0, '0xvault', 97, '0xblock', '0xsig');

        $this->assertSame(1, OnChainIncomeLedgerEntry::query()->count());
    }
}
