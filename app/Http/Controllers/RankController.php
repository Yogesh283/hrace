<?php

namespace App\Http\Controllers;

use App\Services\Income\R10LeadershipService;
use App\Support\RewardPlan;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RankController extends Controller
{
    public function index(Request $request, R10LeadershipService $leadership): Response
    {
        $user = $request->user();
        $self = $leadership->selfActiveHoldUsd($user->id);
        $current = $leadership->qualifyingRankRow($user->id, $self);
        $displayLevel = $current ? (int) ($current['level'] ?? 1) : 1;
        $team = $leadership->networkLevelTeamVolumeUsd($user->id, $displayLevel);

        $ranks = [];
        foreach (RewardPlan::r10LeadershipRanks() as $row) {
            $rankLevel = (int) ($row['level'] ?? 0);
            $levelTeam = $rankLevel >= 1
                ? $leadership->networkLevelTeamVolumeUsd($user->id, $rankLevel)
                : '0.00';
            $needSelf = number_format((float) ($row['self_hold_usd'] ?? 0), 2, '.', '');
            $needTeam = number_format((float) ($row['team_volume_usd'] ?? 0), 2, '.', '');
            $pct = (float) ($row['team_volume_percent'] ?? 0);
            $rate = bcdiv((string) $pct, '100', 8);
            $billable = $leadership->billableTeamVolumeUsd($levelTeam, $row);
            $ranks[] = [
                'code' => (string) ($row['code'] ?? ''),
                'level' => $rankLevel,
                'self_hold_usd' => (float) ($row['self_hold_usd'] ?? 0),
                'team_volume_usd' => (float) ($row['team_volume_usd'] ?? 0),
                'team_volume_percent' => $pct,
                'qualified' => bccomp($self, $needSelf, 2) >= 0 && bccomp($levelTeam, $needTeam, 2) >= 0,
                'example_monthly_usd' => bcmul($billable, $rate, 2),
            ];
        }

        return Inertia::render('Rank', [
            'self_hold_usd' => $self,
            'team_volume_usd' => $team,
            'current_rank_code' => $current['code'] ?? null,
            'ranks' => $ranks,
        ]);
    }
}
