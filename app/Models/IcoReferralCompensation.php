<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IcoReferralCompensation extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_PAID = 'paid';

    protected $fillable = [
        'ico_purchase_id',
        'sponsor_user_id',
        'sponsor_wallet',
        'level',
        'amount_usd',
        'amount_race',
        'stake_tx_hash',
        'payout_tx_hash',
        'status',
        'idempotency_key',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'amount_usd' => 'decimal:2',
            'amount_race' => 'decimal:4',
        ];
    }
}
