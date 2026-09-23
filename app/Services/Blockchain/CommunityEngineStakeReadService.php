<?php

namespace App\Services\Blockchain;

use App\Models\BlockchainEngineStake;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Schema;

/**
 * Serves indexed CommunityEngine stakes for member UI (read-only).
 */
class CommunityEngineStakeReadService
{
    private ?CommunityEngineRpcReader $rpcReader;

    public function __construct(
        private readonly BlockchainWalletIndexerSyncService $walletSync,
    ) {
        $this->rpcReader = CommunityEngineRpcReader::fromConfig();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function stakesForUser(User $user, bool $enrichLiveState = true): array
    {
        if (! Schema::hasTable('blockchain_engine_stakes')) {
            return [];
        }

        $this->walletSync->syncForUser($user);

        $wallet = strtolower(trim((string) ($user->wallet_address ?? '')));
        if ($wallet === '' || ! preg_match('/^0x[a-f0-9]{40}$/', $wallet)) {
            return [];
        }

        $rows = BlockchainEngineStake::query()
            ->where(function (Builder $q) use ($user, $wallet) {
                $q->where('user_id', $user->id)
                    ->orWhereRaw('LOWER(wallet_address) = ?', [$wallet]);
            })
            ->orderBy('stake_index')
            ->limit(50)
            ->get();

        return $rows->map(fn (BlockchainEngineStake $row) => $this->payloadForRow($row, $wallet, $enrichLiveState))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function payloadForRow(BlockchainEngineStake $row, string $wallet, bool $enrichLiveState): array
    {
        $lockSeconds = (int) $row->lock_seconds;
        $lockDays = $lockSeconds > 0 ? (int) round($lockSeconds / 86400) : 0;
        $withdrawn = (bool) $row->withdrawn;
        $startedAt = $row->started_at ? (int) $row->started_at : null;
        $unlockAt = $row->unlock_at ? (int) $row->unlock_at : null;
        $stakedRace = (string) $row->staked_race;
        $principalUsdt = (string) $row->principal_usdt;

        if ($enrichLiveState && $this->rpcReader !== null) {
            $live = $this->rpcReader->readStakeAt($wallet, (int) $row->stake_index);
            if ($this->isPlausibleLiveStake($live, $row)) {
                $stakedRace = (string) ($live['staked_race'] ?? $stakedRace);
                $principalUsdt = (string) ($live['principal_usdt'] ?? $principalUsdt);
                $lockSeconds = (int) ($live['lock_seconds'] ?? $lockSeconds);
                $lockDays = $lockSeconds > 0 ? (int) round($lockSeconds / 86400) : 0;
                $startedAt = isset($live['started_at']) ? (int) $live['started_at'] : $startedAt;
                $unlockAt = isset($live['unlock_at']) ? (int) $live['unlock_at'] : $unlockAt;
                $withdrawn = (bool) ($live['withdrawn'] ?? $withdrawn);
            }
        }

        $status = $withdrawn
            ? BlockchainEngineStake::STATUS_WITHDRAWN
            : (string) $row->status;

        return [
            'stake_index' => (int) $row->stake_index,
            'ico_purchase_id' => $row->ico_purchase_id !== null ? (int) $row->ico_purchase_id : null,
            'wallet_address' => strtolower((string) $row->wallet_address),
            'principal_usdt' => $principalUsdt,
            'staked_race' => $stakedRace,
            'lock_seconds' => $lockSeconds,
            'lock_days' => $lockDays,
            'plan_label' => $lockDays > 0 ? "{$lockDays}D" : 'Flexible',
            'daily_rate_bps' => (int) $row->daily_rate_bps,
            'daily_roi_percent' => number_format((int) $row->daily_rate_bps / 100, 2, '.', ''),
            'started_at' => $startedAt,
            'unlock_at' => $unlockAt,
            'source_type' => (string) $row->source_type,
            'withdrawn' => $withdrawn,
            'status' => $status,
            'tx_hash' => (string) $row->tx_hash,
            'block_number' => $row->block_number,
        ];
    }

    /**
     * @param  array<string, mixed>|null  $live
     */
    private function isPlausibleLiveStake(?array $live, BlockchainEngineStake $row): bool
    {
        if (! is_array($live)) {
            return false;
        }

        $liveRace = (string) ($live['staked_race'] ?? '');
        $indexedRace = (string) $row->staked_race;
        if ($liveRace === '' || ! is_numeric($liveRace)) {
            return false;
        }
        if (function_exists('bccomp') && bccomp($liveRace, '1000000000', 8) > 0) {
            return false;
        }

        $lockSeconds = (int) ($live['lock_seconds'] ?? -1);
        if ($lockSeconds < 0 || $lockSeconds > 86400 * 2000) {
            return false;
        }

        if ($indexedRace !== '' && function_exists('bccomp')) {
            $maxDelta = bcadd($indexedRace, bcdiv($indexedRace, '2', 8), 8);
            if (bccomp($liveRace, $maxDelta, 8) > 0) {
                return false;
            }
        }

        return true;
    }
}
