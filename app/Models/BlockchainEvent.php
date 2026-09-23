<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BlockchainEvent extends Model
{
    protected $fillable = [
        'user_id',
        'wallet_address',
        'contract_address',
        'event_name',
        'tx_hash',
        'log_index',
        'block_number',
        'payload',
        'block_time',
    ];

    protected function casts(): array
    {
        return [
            'log_index' => 'integer',
            'block_number' => 'integer',
            'payload' => 'array',
            'block_time' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
