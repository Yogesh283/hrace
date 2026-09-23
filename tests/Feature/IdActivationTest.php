<?php

namespace Tests\Feature;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\LedgerWriter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IdActivationTest extends TestCase
{
    use RefreshDatabase;

    public function test_deposit_does_not_pay_activation_referral(): void
    {
        $sponsor = User::factory()->create(['id_activated_at' => now()]);

        $member = User::factory()->create([
            'referred_by' => $sponsor->id,
            'id_activated_at' => null,
        ]);

        app(LedgerWriter::class)->record(
            $member,
            LedgerEntry::TYPE_WALLET_DEPOSIT,
            '10.00',
            'deposit',
        );

        $this->assertDatabaseMissing('ledger_entries', [
            'user_id' => $sponsor->id,
            'entry_type' => LedgerEntry::TYPE_ACTIVATION_REFERRAL,
            'reference_id' => $member->id,
        ]);
    }

    public function test_deposit_does_not_activate_id(): void
    {
        $member = User::factory()->create(['id_activated_at' => null]);

        app(LedgerWriter::class)->record(
            $member,
            LedgerEntry::TYPE_WALLET_DEPOSIT,
            '10.00',
            'deposit',
        );

        $this->assertNull($member->fresh()->id_activated_at);
    }

    public function test_first_investment_activates_member_id(): void
    {
        $user = User::factory()->create(['id_activated_at' => null]);

        $this->actingAs($user)->post(route('investments.store'), [
            'amount_usd' => '500',
            'duration_days' => 180,
            'payment_method' => 'usdt_wallet',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $this->assertNotNull($user->fresh()->participation_activated_at);
        $this->assertDatabaseHas('investments', [
            'user_id' => $user->id,
            'amount_usd' => '500.00',
        ]);
        $this->assertSame(1, Investment::query()->where('user_id', $user->id)->count());
    }
}
