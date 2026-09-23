<?php

namespace App\Http\Controllers;

use App\Models\Investment;
use App\Services\Income\R10LeadershipService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SelfHoldController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $svc = app(R10LeadershipService::class);

        $investments = Investment::query()
            ->where('user_id', $user->id)
            ->where('status', Investment::STATUS_ACTIVE)
            ->latest('id')
            ->get([
                'id',
                'amount_usd',
                'duration_days',
                'roi_percent_daily',
                'roi_payouts_done',
                'total_roi_paid_usd',
                'status',
                'next_roi_at',
                'created_at',
            ]);

        return Inertia::render('SelfHold', [
            'self_hold_usd' => $svc->selfActiveHoldUsd($user->id),
            'investments' => $investments,
        ]);
    }
}
