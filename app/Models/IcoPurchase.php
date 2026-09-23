<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Indexed on-chain ICO purchase. Blockchain is source of truth for RACE ownership.
 */
class IcoPurchase extends Model
{
    protected $fillable = [
        'purchase_id',
        'user_id',
        'wallet_address',
        'phase',
        'usdt_amount',
        'race_amount',
        'price',
        'tx_hash',
        'block_number',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'purchase_id' => 'integer',
            'phase' => 'integer',
            'block_number' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
