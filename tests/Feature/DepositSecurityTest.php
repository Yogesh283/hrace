<?php

namespace Tests\Feature;

use App\Models\User;
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
}
