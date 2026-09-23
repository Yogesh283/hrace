<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OnChainIncomeLedgerEntry extends Model
{
    protected $table = 'on_chain_income_ledger';

    protected $fillable = [
        'user_id',
        'wallet_address',
        'event_name',
        'income_type',
        'reference_id',
        'withdrawal_id',
        'amount',
        'gross_amount',
        'team_reward',
        'admin_fee',
        'net_amount',
        'tx_hash',
        'block_number',
        'log_index',
        'contract_address',
        'legacy_migrated',
        'raw',
        'chain_id',
        'block_hash',
        'event_signature',
    ];

    protected function casts(): array
    {
        return [
            'legacy_migrated' => 'boolean',
            'raw' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
