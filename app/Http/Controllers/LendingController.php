<?php

namespace App\Http\Controllers;

use App\Models\OnChainLendingPosition;
use App\Support\LendingAccessGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LendingController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $wallet = strtolower(trim((string) ($user->wallet_address ?? '')));

        $positions = $wallet === ''
            ? []
            : OnChainLendingPosition::query()
                ->where('wallet_address', $wallet)
                ->orderByDesc('id')
                ->limit(50)
                ->get()
                ->map(static fn (OnChainLendingPosition $row) => [
                    'position_id' => $row->position_id,
                    'product_type' => $row->product_type,
                    'repayment_option' => $row->repayment_option,
                    'selected_amount' => (string) $row->selected_amount,
                    'security_amount' => (string) $row->security_amount,
                    'disbursement_amount' => (string) $row->disbursement_amount,
                    'repayment_amount' => (string) $row->repayment_amount,
                    'repaid_amount' => (string) $row->repaid_amount,
                    'status' => $row->status,
                    'start_time' => $row->start_time,
                    'due_time' => $row->due_time,
                    'race_position_notional' => (string) $row->race_position_notional,
                ])
                ->values()
                ->all();

        return Inertia::render('Lending', [
            'lending_access' => $user->lendingAccessForUi(),
            'positions' => $positions,
            'lending_enabled' => (bool) config('race_lending.enabled'),
        ]);
    }

    public function storeSmartLending(Request $request): JsonResponse
    {
        if ($blocked = LendingAccessGuard::abortIfBlocked($request->user())) {
            return $blocked;
        }

        $request->validate([
            'selected_amount' => ['required', 'numeric', 'min:100', 'max:499'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Lending access verified. Proceed with on-chain Smart Lending.',
            'product' => 'smart_lending',
        ]);
    }

    public function storeSmartPro(Request $request): JsonResponse
    {
        if ($blocked = LendingAccessGuard::abortIfBlocked($request->user())) {
            return $blocked;
        }

        $request->validate([
            'selected_amount' => ['required', 'numeric', 'in:500,1000'],
            'repayment_option' => ['required', 'string', 'in:30,90,180'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Lending access verified. Proceed with on-chain Smart Pro Lending.',
            'product' => 'smart_pro',
        ]);
    }

    public function storeRepaymentPlan(Request $request): JsonResponse
    {
        if ($blocked = LendingAccessGuard::abortIfBlocked($request->user())) {
            return $blocked;
        }

        $request->validate([
            'position_id' => ['required', 'integer', 'min:1'],
            'repayment_option' => ['required', 'string', 'in:30,90,180'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Lending access verified. Proceed with on-chain repayment plan.',
            'product' => 'repayment_plan',
        ]);
    }
}
