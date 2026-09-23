<?php

namespace App\Http\Controllers;

use App\Models\LedgerEntry;
use App\Support\IncomeCatalog;
use App\Support\RewardPlan;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BonzaBusterController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $cfg = RewardPlan::bonzaBuster();
        $percent = RewardPlan::bonzaBusterDirectPercent() ?? 0.0;

        $earned = (float) (LedgerEntry::query()
            ->production()
            ->where('user_id', $user->id)
            ->where('entry_type', LedgerEntry::TYPE_BONZA_BUSTER)
            ->where('amount_usd', '>', 0)
            ->sum('amount_usd') ?? 0);

        $count = (int) LedgerEntry::query()
            ->production()
            ->where('user_id', $user->id)
            ->where('entry_type', LedgerEntry::TYPE_BONZA_BUSTER)
            ->where('amount_usd', '>', 0)
            ->count();

        $transactions = IncomeCatalog::formatLedgerRows(
            LedgerEntry::query()
                ->production()
                ->where('user_id', $user->id)
                ->where('entry_type', LedgerEntry::TYPE_BONZA_BUSTER)
                ->where('amount_usd', '>', 0)
                ->latest('id')
                ->limit(100)
                ->get([
                    'id',
                    'entry_type',
                    'amount_usd',
                    'balance_after_usd',
                    'reference_type',
                    'reference_id',
                    'meta',
                    'created_at',
                ]),
        );

        return Inertia::render('BonzaBuster', [
            'program' => [
                'name' => 'Bonanza',
                'enabled' => (bool) ($cfg['enabled'] ?? true),
                'direct_percent' => $percent,
                'earned_usd' => number_format($earned, 2, '.', ''),
                'payout_count' => $count,
                'trigger' => collect(IncomeCatalog::items())->firstWhere('key', 'bonza_buster')['trigger'] ?? '',
            ],
            'transactions' => $transactions,
        ]);
    }
}
