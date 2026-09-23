<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Orchid\Filters\Filterable;
use Orchid\Screen\AsSource;

class UserWallet extends Model
{
    use AsSource;
    use Filterable;

    /**
     * @var list<string>
     */
    protected $allowedSorts = [
        'id',
        'user_id',
        'balance_usd',
        'race_coin_balance',
        'created_at',
    ];

    protected $table = 'user_wallets';

    protected $fillable = [
        'user_id',
        'balance_usd',
        'race_coin_balance',
    ];

    protected function casts(): array
    {
        return [
            'balance_usd' => 'decimal:2',
            'race_coin_balance' => 'decimal:4',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
