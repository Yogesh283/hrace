<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OnChainLendingPosition extends Model
{
    protected $table = 'on_chain_lending_positions';

    protected $fillable = [
        'chain_id',
        'contract_address',
        'position_id',
        'wallet_address',
        'product_type',
        'repayment_option',
        'selected_amount',
        'security_amount',
        'disbursement_amount',
        'repayment_amount',
        'repaid_amount',
        'status',
        'start_time',
        'due_time',
        'program_end_time',
        'race_position_notional',
        'create_tx_hash',
        'create_log_index',
        'raw',
    ];

    protected function casts(): array
    {
        return [
            'selected_amount' => 'decimal:8',
            'security_amount' => 'decimal:8',
            'disbursement_amount' => 'decimal:8',
            'repayment_amount' => 'decimal:8',
            'repaid_amount' => 'decimal:8',
            'race_position_notional' => 'decimal:8',
            'raw' => 'array',
        ];
    }

    public function scopeActive($query)
    {
        return $query->whereIn('status', ['Active', 'ACTIVE', '1']);
    }
}
