<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IcoRaceTransfer extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'user_id',
        'coins_amount',
        'admin_fee_usdt',
        'fee_tx_hash',
        'wallet_address',
        'status',
        'payout_tx_hash',
        'completed_at',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'coins_amount' => 'decimal:8',
            'admin_fee_usdt' => 'decimal:2',
            'completed_at' => 'datetime',
            'meta' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
