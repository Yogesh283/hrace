<?php

namespace App\Http\Controllers;

use App\Services\Income\ReferralTree;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TeamController extends Controller
{
    public function index(Request $request, ReferralTree $tree): Response
    {
        $user = $request->user();

        // Total Team UI: full unlimited tree. Community referral income still L1–L10 on-chain.
        $levels = $tree->referralLevelsForLeader($user->id, null);
        $totalDownline = array_sum(array_map(
            static fn (array $row): int => (int) ($row['count'] ?? 0),
            $levels,
        ));
        $directVolume = $tree->downlineInvestmentVolumeUsdAtLevel($user->id, 1);
        $teamVolume = $tree->downlineInvestmentVolumeUsd($user->id, true);

        return Inertia::render('Team', [
            'stats' => [
                'direct_count' => $levels[0]['count'] ?? 0,
                'total_downline' => $totalDownline,
                'network_volume_usd' => $directVolume,
                'downline_volume_usd' => $teamVolume,
            ],
            'levels' => $levels,
        ]);
    }
}
