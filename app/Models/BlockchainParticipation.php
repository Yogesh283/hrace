<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BlockchainParticipation extends Model
{
    protected $fillable = [
        'user_id',
        'investment_id',
        'wallet_address',
        'tx_hash',
        'stake_index',
        'principal_usdt',
        'lock_seconds',
        'daily_rate_bps',
        'contract_address',
        'synced_at',
    ];

    protected function casts(): array
    {
        return [
            'stake_index' => 'integer',
            'principal_usdt' => 'decimal:8',
            'lock_seconds' => 'integer',
            'daily_rate_bps' => 'integer',
            'synced_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function investment(): BelongsTo
    {
        return $this->belongsTo(Investment::class);
    }
}
