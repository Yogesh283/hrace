<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserFundTransaction extends Model
{
    public const TYPE_ICO_STAKE = 'ico_stake';

    public const TYPE_ENGINE_STAKE = 'engine_stake';

    public const TYPE_RACE_COIN_SWAP = 'race_coin_swap';

    public const TYPE_RACE_COIN_DEBIT = 'race_coin_debit';

    public const TYPE_WALLET_DEPOSIT = 'wallet_deposit';

    public const TYPE_WITHDRAWAL = 'withdrawal';

    public const DIR_IN = 'in';

    public const DIR_OUT = 'out';

    public const DIR_INFO = 'info';

    protected $fillable = [
        'user_id',
        'type',
        'direction',
        'amount_usd',
        'amount_race',
        'tx_hash',
        'stake_index',
        'reference_type',
        'reference_id',
        'title',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'amount_usd' => 'decimal:8',
            'amount_race' => 'decimal:18',
            'stake_index' => 'integer',
            'meta' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
