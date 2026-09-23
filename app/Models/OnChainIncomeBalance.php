<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OnChainIncomeBalance extends Model
{
    protected $table = 'on_chain_income_balances';

    protected $fillable = [
        'user_id',
        'wallet_address',
        'balance_amount',
        'total_credited',
        'total_withdrawn_gross',
        'last_indexed_at',
    ];

    protected function casts(): array
    {
        return [
            'last_indexed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
