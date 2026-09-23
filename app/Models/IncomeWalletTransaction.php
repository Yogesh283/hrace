<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IncomeWalletTransaction extends Model
{
    public const DIRECTION_CREDIT = 'credit';

    public const DIRECTION_DEBIT = 'debit';

    public const STATUS_POSTED = 'posted';

    public const STATUS_PENDING = 'pending';

    public const STATUS_FAILED = 'failed';

    public const TYPE_DAILY_REWARD = 'daily_reward';

    public const TYPE_LEVEL_INCOME = 'level_income';

    public const TYPE_TEAM_INCOME = 'team_income';

    public const TYPE_REFERRAL_INCOME = 'referral_income';

    public const TYPE_OTHER_INCOME = 'other_income';

    public const TYPE_INCOME_CLAIM = 'income_claim';

    public const TYPE_COMPOUND = 'compound';

    public const TYPE_COMPOUND_REFUND = 'compound_refund';

    public const TYPE_WITHDRAWAL = 'withdrawal';

    public const TYPE_STAKE_UNLOCK_EMI = 'stake_unlock_emi';

    public const TYPE_ADJUSTMENT = 'adjustment';

    protected $fillable = [
        'user_id',
        'wallet_address',
        'type',
        'source_reference',
        'amount',
        'asset',
        'direction',
        'status',
        'idempotency_key',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:4',
            'metadata' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
