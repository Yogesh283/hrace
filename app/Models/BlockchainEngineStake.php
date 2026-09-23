<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Indexed RaceCommunityEngine stake (read model). On-chain Engine is source of truth.
 */
class BlockchainEngineStake extends Model
{
    public const SOURCE_ICO = 'ico';

    public const SOURCE_PARTICIPATION = 'participation';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_WITHDRAWN = 'withdrawn';

    public const STATUS_COMPLETED = 'completed';

    protected $fillable = [
        'user_id',
        'wallet_address',
        'stake_index',
        'ico_purchase_id',
        'principal_usdt',
        'staked_race',
        'lock_seconds',
        'daily_rate_bps',
        'started_at',
        'unlock_at',
        'source_type',
        'withdrawn',
        'status',
        'tx_hash',
        'block_number',
        'contract_address',
    ];

    protected function casts(): array
    {
        return [
            'stake_index' => 'integer',
            'ico_purchase_id' => 'integer',
            'lock_seconds' => 'integer',
            'daily_rate_bps' => 'integer',
            'started_at' => 'integer',
            'unlock_at' => 'integer',
            'withdrawn' => 'boolean',
            'block_number' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
