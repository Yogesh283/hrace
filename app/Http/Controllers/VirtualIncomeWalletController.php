<?php

namespace App\Http\Controllers;

use App\Models\IncomeWalletTransaction;
use App\Services\Income\VirtualIncomeWalletService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class VirtualIncomeWalletController extends Controller
{
    public function index(Request $request, VirtualIncomeWalletService $wallet): Response
    {
        $user = $request->user();
        $summary = $wallet->dashboardSummary($user);

        $history = IncomeWalletTransaction::query()
            ->where('user_id', $user->id)
            ->latest('id')
            ->limit(100)
            ->get()
            ->map(static fn (IncomeWalletTransaction $row) => [
                'id' => $row->id,
                'type' => $row->type,
                'type_label' => self::labelForType($row->type),
                'direction' => $row->direction,
                'amount' => number_format((float) $row->amount, 4, '.', ''),
                'asset' => $row->asset,
                'status' => $row->status,
                'source_reference' => $row->source_reference,
                'created_at' => $row->created_at?->toIso8601String(),
                'metadata' => $row->metadata,
            ])
            ->values()
            ->all();

        return Inertia::render('VirtualIncomeWallet', [
            'summary' => $summary,
            'history' => $history,
            'rewards_engine' => (string) config('blockchain.rewards_engine', 'hybrid'),
            'blockchain_only' => \App\Support\BlockchainMode::blockchainOnly(),
            'on_chain_income' => [
                'enabled' => (bool) config('income_vault.enabled'),
                'authoritative' => (bool) config('income_vault.authoritative_balance'),
                'contract' => config('income_vault.contract_address'),
                'settlement_token' => config('income_vault.settlement_token'),
            ],
            'on_chain_history' => $this->onChainHistory($user),
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function onChainHistory(\App\Models\User $user): array
    {
        if (! config('income_vault.enabled')) {
            return [];
        }
        $wallet = strtolower(trim((string) ($user->wallet_address ?? '')));
        if ($wallet === '') {
            return [];
        }

        return \App\Models\OnChainIncomeLedgerEntry::query()
            ->where('wallet_address', $wallet)
            ->latest('id')
            ->limit(50)
            ->get()
            ->map(static fn ($row) => [
                'event_name' => $row->event_name,
                'income_type' => $row->income_type,
                'amount' => $row->amount,
                'gross_amount' => $row->gross_amount,
                'team_reward' => $row->team_reward,
                'admin_fee' => $row->admin_fee,
                'net_amount' => $row->net_amount,
                'tx_hash' => $row->tx_hash,
                'block_number' => $row->block_number,
                'legacy_migrated' => (bool) $row->legacy_migrated,
                'created_at' => $row->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();
    }

    private static function labelForType(string $type): string
    {
        return match ($type) {
            IncomeWalletTransaction::TYPE_DAILY_REWARD => 'Daily Reward',
            IncomeWalletTransaction::TYPE_LEVEL_INCOME => 'Level Income',
            IncomeWalletTransaction::TYPE_TEAM_INCOME => 'Team Income',
            IncomeWalletTransaction::TYPE_REFERRAL_INCOME => 'Referral Income',
            IncomeWalletTransaction::TYPE_INCOME_CLAIM => 'Claim',
            IncomeWalletTransaction::TYPE_COMPOUND => 'Compound',
            IncomeWalletTransaction::TYPE_WITHDRAWAL => 'Withdrawal',
            IncomeWalletTransaction::TYPE_STAKE_UNLOCK_EMI => 'Stake unlock EMI',
            default => ucfirst(str_replace('_', ' ', $type)),
        };
    }
}
