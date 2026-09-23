<?php

namespace Tests\Feature;

use App\Models\SiteSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TreasuryDepositAddressTest extends TestCase
{
    use RefreshDatabase;

    public function test_deposit_page_uses_address_from_database(): void
    {
        SiteSetting::set(SiteSetting::KEY_ADDRESS, '0x1111111111111111111111111111111111111111');
        SiteSetting::set(SiteSetting::KEY_NETWORK_LABEL, 'BEP20 Test Network');

        $user = User::factory()->create();

        $response = $this->actingAs($user)->get(route('deposit'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Deposit')
            ->where('depositAddress.address', '0x1111111111111111111111111111111111111111')
            ->where('depositAddress.network', 'BEP20 Test Network')
            ->where('depositAddress.source', 'database')
        );
    }

    public function test_deposit_verification_uses_database_treasury_address(): void
    {
        SiteSetting::set(SiteSetting::KEY_ADDRESS, '0x2222222222222222222222222222222222222222');

        $this->assertSame(
            '0x2222222222222222222222222222222222222222',
            SiteSetting::treasuryAddress(),
        );
    }
}
