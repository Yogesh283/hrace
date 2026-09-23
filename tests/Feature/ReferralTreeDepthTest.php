<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Income\ReferralTree;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReferralTreeDepthTest extends TestCase
{
    use RefreshDatabase;

    public function test_descendant_count_stops_at_level_ten(): void
    {
        $tree = app(ReferralTree::class);
        $leader = User::factory()->create();
        $parent = $leader;

        for ($depth = 1; $depth <= 12; $depth++) {
            $parent = User::factory()->create(['referred_by' => $parent->id]);
        }

        // Community referral / team UI: L1–L10 only
        $this->assertSame(10, $tree->referralDescendantCount($leader->id));
        $this->assertCount(10, $tree->referralDescendantIds($leader->id));

        // Generation / leadership volume: unlimited depth
        $this->assertCount(12, $tree->allReferralDescendantIds($leader->id));
        $this->assertCount(12, $tree->referralDescendantIds($leader->id, null));
    }
}
