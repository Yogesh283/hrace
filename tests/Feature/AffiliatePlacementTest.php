<?php

namespace Tests\Feature;

use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\AffiliatePlacementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AffiliatePlacementTest extends TestCase
{
    use RefreshDatabase;

    public function test_placement_income_is_disabled_on_new_referral(): void
    {
        $sponsor = User::factory()->create();
        $member = User::factory()->create(['referred_by' => $sponsor->id]);

        app(AffiliatePlacementService::class)->onNewReferralRegistration($member);

        $this->assertSame(
            0,
            LedgerEntry::query()
                ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_PLACEMENT)
                ->count(),
        );
    }
}
