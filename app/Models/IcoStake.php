<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IcoStake extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_WITHDRAWN = 'withdrawn';

    protected $fillable = [
        'user_id',
        'phase_id',
        'purchase_price_usd',
        'usdt_paid',
        'race_amount',
        'duration_days',
        'daily_reward_percent',
        'status',
        'tx_hash',
        'purchased_at',
        'unlock_at',
        'last_claim_at',
        'total_claimed_race_coin',
        'claim_count',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'phase_id' => 'integer',
            'purchase_price_usd' => 'decimal:8',
            'usdt_paid' => 'decimal:2',
            'race_amount' => 'decimal:8',
            'duration_days' => 'integer',
            'daily_reward_percent' => 'decimal:4',
            'purchased_at' => 'datetime',
            'unlock_at' => 'datetime',
            'last_claim_at' => 'datetime',
            'total_claimed_race_coin' => 'decimal:8',
            'claim_count' => 'integer',
            'meta' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isUnlocked(): bool
    {
        return $this->unlock_at !== null && now()->greaterThanOrEqualTo($this->unlock_at);
    }
}
