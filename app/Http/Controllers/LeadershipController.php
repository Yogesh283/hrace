<?php

namespace App\Http\Controllers;

use App\Services\Income\CommunityLeadershipService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LeadershipController extends Controller
{
    public function index(Request $request, CommunityLeadershipService $leadership): Response
    {
        return Inertia::render('Leadership', $leadership->pagePropsFor($request->user()));
    }

    public function liveData(Request $request, CommunityLeadershipService $leadership): Response
    {
        return Inertia::render('LeadershipLiveData', $leadership->liveDataPagePropsFor($request->user()));
    }
}
