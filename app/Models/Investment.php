<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Orchid\Filters\Filterable;
use Orchid\Screen\AsSource;

class Investment extends Model
{
    use AsSource;
    use Filterable;

    /**
     * @var list<string>
     */
    protected $allowedSorts = [
        'id',
        'user_id',
        'amount_usd',
        'status',
        'next_roi_at',
        'created_at',
    ];

    public const STATUS_ACTIVE = 'active';

    public const STATUS_COMPLETED = 'completed';

    /** Principal unlock started — waiting for EMI releases */
    public const STATUS_UNLOCKING = 'unlocking';

    /** All EMIs paid */
    public const STATUS_UNLOCKED = 'unlocked';

    protected $fillable = [
        'user_id',
        'amount_usd',
        'duration_days',
        'roi_percent_monthly',
        'roi_percent_daily',
        'total_roi_paid_usd',
        'accrued_reward_usd',
        'roi_payouts_done',
        'cap_multiplier',
        'status',
        'next_roi_at',
        'holding_completed_at',
        'rollover_count',
    ];

    protected function casts(): array
    {
        return [
            'amount_usd' => 'decimal:2',
            'duration_days' => 'integer',
            'roi_percent_monthly' => 'decimal:2',
            'roi_percent_daily' => 'decimal:4',
            'roi_payouts_done' => 'integer',
            'total_roi_paid_usd' => 'decimal:2',
            'accrued_reward_usd' => 'decimal:4',
            'cap_multiplier' => 'decimal:2',
            'next_roi_at' => 'datetime',
            'holding_completed_at' => 'datetime',
            'rollover_count' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function stakeUnlock(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(StakeUnlock::class);
    }

    public function roiCapUsd(): string
    {
        return bcmul((string) $this->amount_usd, (string) $this->cap_multiplier, 2);
    }

    public function remainingRoiCapacityUsd(): string
    {
        return bcsub($this->roiCapUsd(), (string) $this->total_roi_paid_usd, 2);
    }
}
