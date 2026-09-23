<?php

namespace App\Services\Blockchain;

use App\Models\BlockchainEngineStake;
use App\Models\BlockchainEvent;
use App\Models\IcoPurchase;
use App\Models\User;

/**
 * Links indexed on-chain rows to Laravel users by wallet_address (read-model only).
 */
class BlockchainWalletIndexerSyncService
{
    public function syncForUser(User $user): void
    {
        $wallet = $this->normalizeWallet($user->wallet_address ?? '');
        if ($wallet === '') {
            return;
        }

        IcoPurchase::query()
            ->whereRaw('LOWER(wallet_address) = ?', [$wallet])
            ->where(function ($q) use ($user) {
                $q->whereNull('user_id')->orWhere('user_id', '!=', $user->id);
            })
            ->update(['user_id' => $user->id]);

        BlockchainEvent::query()
            ->whereRaw('LOWER(wallet_address) = ?', [$wallet])
            ->where(function ($q) use ($user) {
                $q->whereNull('user_id')->orWhere('user_id', '!=', $user->id);
            })
            ->update(['user_id' => $user->id]);

        if (\Illuminate\Support\Facades\Schema::hasTable('blockchain_engine_stakes')) {
            BlockchainEngineStake::query()
                ->whereRaw('LOWER(wallet_address) = ?', [$wallet])
                ->where(function ($q) use ($user) {
                    $q->whereNull('user_id')->orWhere('user_id', '!=', $user->id);
                })
                ->update(['user_id' => $user->id]);
        }
    }

    public function resolveUserIdForWallet(string $walletAddress): ?int
    {
        $wallet = $this->normalizeWallet($walletAddress);
        if ($wallet === '') {
            return null;
        }

        return User::query()
            ->whereRaw('LOWER(wallet_address) = ?', [$wallet])
            ->value('id');
    }

    private function normalizeWallet(?string $wallet): string
    {
        $wallet = strtolower(trim((string) $wallet));

        return preg_match('/^0x[a-f0-9]{40}$/', $wallet) ? $wallet : '';
    }
}
