<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Orchid\Filters\Filterable;
use Orchid\Screen\AsSource;

class RaceCoinSwap extends Model
{
    use AsSource;
    use Filterable;

    public const TYPE_SWAP_CREDIT = 'swap_credit';

    public const TYPE_ACTIVATION_DEBIT = 'activation_debit';

    public const TYPE_INVESTMENT_DEBIT = 'investment_debit';

    public const TYPE_ICO_CLAIM_CREDIT = 'ico_claim_credit';

    public const TYPE_ICO_TRANSFER_DEBIT = 'ico_transfer_debit';

    /**
     * @var list<string>
     */
    protected $allowedSorts = [
        'id',
        'user_id',
        'swap_type',
        'usdt_amount',
        'coins_amount',
        'created_at',
    ];

    /**
     * @return array<string, string>
     */
    public static function typeLabels(): array
    {
        return [
            self::TYPE_SWAP_CREDIT => 'USDT → Race Coin',
            self::TYPE_ACTIVATION_DEBIT => 'ID activation',
            self::TYPE_INVESTMENT_DEBIT => 'Package investment',
            self::TYPE_ICO_CLAIM_CREDIT => 'ICO daily claim',
            self::TYPE_ICO_TRANSFER_DEBIT => 'ICO wallet transfer',
        ];
    }

    protected $fillable = [
        'user_id',
        'swap_type',
        'usdt_amount',
        'coins_amount',
        'balance_after_coins',
        'tx_hash',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'usdt_amount' => 'decimal:2',
            'coins_amount' => 'decimal:4',
            'balance_after_coins' => 'decimal:4',
            'meta' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
