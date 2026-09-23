<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DecentralizationCheckCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_decentralization_check_runs(): void
    {
        config(['income_vault.authoritative_balance' => false]);

        $this->artisan('decentralization:check', ['--json' => true])
            ->assertSuccessful();
    }

    public function test_reconcile_index_only_without_vault(): void
    {
        config(['income_vault.contract_address' => '']);

        $this->artisan('income:reconcile-onchain', ['--index-only' => true, '--json' => true])
            ->assertSuccessful();
    }
}
