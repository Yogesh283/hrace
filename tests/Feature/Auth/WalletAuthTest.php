<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WalletAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_wallet_login_nonce_rejects_unknown_wallet(): void
    {
        $response = $this->postJson(route('wallet-auth.nonce'), [
            'address' => '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
            'action' => 'login',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['address']);
    }

    public function test_wallet_register_nonce_requires_valid_join_code(): void
    {
        $response = $this->postJson(route('wallet-auth.nonce'), [
            'address' => '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
            'action' => 'register',
            'join_code' => 'INVALID1',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['join_code']);
    }

    public function test_wallet_register_nonce_returns_message_for_valid_sponsor(): void
    {
        $sponsor = User::factory()->create([
            'referral_code' => 'SPONSOR1',
            'is_blocked' => false,
        ]);

        $this->assertDatabaseHas('users', [
            'referral_code' => 'SPONSOR1',
            'is_blocked' => 0,
        ]);

        $response = $this->postJson(route('wallet-auth.nonce'), [
            'address' => '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
            'action' => 'register',
            'join_code' => 'SPONSOR1',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['nonce', 'message']);

        $this->assertStringContainsString('Action: register', $response->json('message'));
        $this->assertStringContainsString('SPONSOR1', $response->json('message'));
    }

    public function test_wallet_login_nonce_returns_message_for_existing_wallet(): void
    {
        User::factory()->create([
            'wallet_address' => '0x742d35cc6634c0532925a3b844bc9e7595f0beb0',
            'is_blocked' => false,
        ]);

        $response = $this->postJson(route('wallet-auth.nonce'), [
            'address' => '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
            'action' => 'login',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['nonce', 'message']);

        $this->assertStringContainsString('Action: login', $response->json('message'));
    }

    public function test_login_and_register_pages_render_in_english(): void
    {
        $this->get(route('login'))->assertOk();
        $this->get(route('register'))->assertOk();
        $this->get(route('register', ['join_code' => 'SPONSOR1']))
            ->assertRedirect(route('register'));
    }

    public function test_register_page_accepts_valid_join_code_query(): void
    {
        User::factory()->create([
            'referral_code' => 'SPONSOR1',
            'is_blocked' => false,
        ]);

        $this->followingRedirects()
            ->get(route('register', ['join_code' => 'sponsor1']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Auth/Register')
                ->where('join_code', 'SPONSOR1')
                ->where('join_code_locked', true));
    }
}
