<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StakeUnlockEmi extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_PAID = 'paid';

    protected $fillable = [
        'stake_unlock_id',
        'user_id',
        'emi_number',
        'amount_usd',
        'due_at',
        'paid_at',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'amount_usd' => 'decimal:2',
            'due_at' => 'datetime',
            'paid_at' => 'datetime',
            'emi_number' => 'integer',
        ];
    }

    public function stakeUnlock(): BelongsTo
    {
        return $this->belongsTo(StakeUnlock::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
