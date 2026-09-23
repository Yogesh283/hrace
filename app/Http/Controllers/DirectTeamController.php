<?php

namespace App\Http\Controllers;

use App\Services\Income\ReferralTree;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DirectTeamController extends Controller
{
    public function index(Request $request, ReferralTree $tree): Response
    {
        $levels = $tree->referralLevelsForLeader($request->user()->id, 1);
        $level1 = $levels[0] ?? ['level' => 1, 'count' => 0, 'members' => []];

        return Inertia::render('DirectTeam', [
            'direct_count' => (int) ($level1['count'] ?? 0),
            'directTeam' => $level1['members'] ?? [],
        ]);
    }
}
