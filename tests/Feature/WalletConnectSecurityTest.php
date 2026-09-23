<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\WalletAuthService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\WalletLinkTestHelper;
use Tests\TestCase;

class WalletConnectSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_unauthenticated_user_cannot_request_wallet_link_nonce(): void
    {
        $this->postJson(route('wallet.connect.nonce'), [
            'address' => WalletLinkTestHelper::ADDRESS,
        ])->assertUnauthorized();
    }

    public function test_unauthenticated_user_cannot_post_wallet_connect(): void
    {
        $this->post(route('wallet.connect'), [
            'address' => WalletLinkTestHelper::ADDRESS,
            'signature' => '0x'.str_repeat('a', 130),
        ])->assertRedirect(route('login'));
    }

    public function test_valid_signature_links_wallet(): void
    {
        $user = User::factory()->create(['wallet_address' => null]);

        $nonceResponse = $this->actingAs($user)->postJson(route('wallet.connect.nonce'), [
            'address' => WalletLinkTestHelper::ADDRESS,
        ]);

        $nonceResponse->assertOk();
        $message = (string) $nonceResponse->json('message');
        $this->assertNotSame('', $message);

        $signature = WalletLinkTestHelper::signPersonalMessage($message);

        $this->actingAs($user)
            ->post(route('wallet.connect'), [
                'address' => WalletLinkTestHelper::ADDRESS,
                'signature' => $signature,
            ])
            ->assertRedirect()
            ->assertSessionHas('status');

        $this->assertSame(
            strtolower(WalletLinkTestHelper::ADDRESS),
            strtolower((string) $user->fresh()->wallet_address),
        );
    }

    public function test_invalid_signature_fails(): void
    {
        $user = User::factory()->create(['wallet_address' => null]);
        $service = app(WalletAuthService::class);

        $payload = $service->issueWalletLinkNonce((int) $user->id, WalletLinkTestHelper::ADDRESS);
        $signature = WalletLinkTestHelper::signPersonalMessage($payload['message'].'x');

        $this->actingAs($user)
            ->post(route('wallet.connect'), [
                'address' => WalletLinkTestHelper::ADDRESS,
                'signature' => $signature,
            ])
            ->assertSessionHasErrors('signature');
    }

    public function test_wrong_wallet_in_signature_fails(): void
    {
        $user = User::factory()->create(['wallet_address' => null]);
        $other = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';

        $nonceResponse = $this->actingAs($user)->postJson(route('wallet.connect.nonce'), [
            'address' => WalletLinkTestHelper::ADDRESS,
        ]);

        $message = (string) $nonceResponse->json('message');
        $signature = WalletLinkTestHelper::signPersonalMessage($message);

        $this->actingAs($user)
            ->post(route('wallet.connect'), [
                'address' => $other,
                'signature' => $signature,
            ])
            ->assertSessionHasErrors('signature');
    }

    public function test_replay_nonce_fails(): void
    {
        $user = User::factory()->create(['wallet_address' => null]);
        $service = app(WalletAuthService::class);
        $address = WalletLinkTestHelper::ADDRESS;

        $payload = $service->issueWalletLinkNonce((int) $user->id, $address);
        $signature = WalletLinkTestHelper::signPersonalMessage($payload['message']);

        $this->assertTrue($service->verifyWalletLinkSignature((int) $user->id, $address, $signature));
        $this->assertFalse($service->verifyWalletLinkSignature((int) $user->id, $address, $signature));
    }

    public function test_expired_nonce_fails(): void
    {
        $user = User::factory()->create(['wallet_address' => null]);
        $service = app(WalletAuthService::class);
        $address = strtolower(WalletLinkTestHelper::ADDRESS);

        $payload = $service->issueWalletLinkNonce((int) $user->id, $address);
        $signature = WalletLinkTestHelper::signPersonalMessage($payload['message']);

        cache()->forget('wallet_link:'.$user->id.':'.$address);

        $this->actingAs($user)
            ->post(route('wallet.connect'), [
                'address' => WalletLinkTestHelper::ADDRESS,
                'signature' => $signature,
            ])
            ->assertSessionHasErrors('signature');
    }

    public function test_malformed_signature_fails_validation(): void
    {
        $user = User::factory()->create(['wallet_address' => null]);

        $this->actingAs($user)->postJson(route('wallet.connect.nonce'), [
            'address' => WalletLinkTestHelper::ADDRESS,
        ])->assertOk();

        $this->actingAs($user)
            ->post(route('wallet.connect'), [
                'address' => WalletLinkTestHelper::ADDRESS,
                'signature' => '0x1234',
            ])
            ->assertSessionHasErrors('signature');
    }

    public function test_address_only_without_signature_fails(): void
    {
        $user = User::factory()->create(['wallet_address' => null]);

        $this->actingAs($user)
            ->post(route('wallet.connect'), [
                'address' => WalletLinkTestHelper::ADDRESS,
            ])
            ->assertSessionHasErrors('signature');
    }

    public function test_existing_wallet_user_cannot_relink_via_nonce(): void
    {
        $user = User::factory()->create([
            'wallet_address' => '0x1111111111111111111111111111111111111111',
        ]);

        $this->actingAs($user)->postJson(route('wallet.connect.nonce'), [
            'address' => WalletLinkTestHelper::ADDRESS,
        ])->assertStatus(422);
    }
}
