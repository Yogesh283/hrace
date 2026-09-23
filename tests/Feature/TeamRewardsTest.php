<?php

namespace Tests\Feature;

use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\LedgerWriter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TeamRewardsTest extends TestCase
{
    use RefreshDatabase;

    public function test_activation_no_longer_pays_team_reward(): void
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

        $this->assertNull($member->fresh()->id_activated_at);

        $this->assertNull(
            LedgerEntry::query()
                ->where('user_id', $sponsor->id)
                ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_TEAM_REWARD)
                ->first(),
        );
    }
}
