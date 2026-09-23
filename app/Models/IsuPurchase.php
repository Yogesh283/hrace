<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Orchid\Filters\Filterable;
use Orchid\Screen\AsSource;

class IsuPurchase extends Model
{
    use AsSource;
    use Filterable;

    /**
     * @var list<string>
     */
    protected $allowedSorts = [
        'id',
        'user_id',
        'usdt_amount',
        'isu_coins_amount',
        'duration_days',
        'created_at',
    ];

    protected $fillable = [
        'user_id',
        'investment_id',
        'usdt_amount',
        'isu_coins_amount',
        'price_usd',
        'duration_days',
        'tx_hash',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'usdt_amount' => 'decimal:2',
            'isu_coins_amount' => 'decimal:4',
            'price_usd' => 'decimal:4',
            'duration_days' => 'integer',
            'meta' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function investment(): BelongsTo
    {
        return $this->belongsTo(Investment::class);
    }
}
