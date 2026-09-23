<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserWallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MemberWithdrawalDisabledTest extends TestCase
{
    use RefreshDatabase;

    public function test_member_cannot_submit_withdrawal_when_admin_disabled(): void
    {
        $member = User::factory()->create([
            'withdrawals_disabled' => true,
        ]);
        UserWallet::query()->where('user_id', $member->id)->update(['balance_usd' => 100]);
        $member->forceFill(['balance_usd' => 100])->save();

        $this->actingAs($member)
            ->post(route('withdrawals.store'), [
                'amount_usd' => '50',
                'destination_address' => '0x1234567890123456789012345678901234567890',
            ])
            ->assertSessionHasErrors('amount_usd');
    }

    public function test_member_can_submit_withdrawal_when_enabled(): void
    {
        $member = User::factory()->create([
            'withdrawals_disabled' => false,
        ]);
        UserWallet::query()->where('user_id', $member->id)->update(['balance_usd' => 100]);
        $member->forceFill(['balance_usd' => 100])->save();

        $this->actingAs($member)
            ->post(route('withdrawals.store'), [
                'amount_usd' => '50',
                'destination_address' => '0x1234567890123456789012345678901234567890',
            ])
            ->assertRedirect();
    }
}
