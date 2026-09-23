<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Orchid\Filters\Filterable;
use Orchid\Screen\AsSource;

class Withdrawal extends Model
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
        'created_at',
    ];
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_PENDING = 'pending';
    public const STATUS_REJECTED = 'rejected';

    /**
     * @return array<string, string>
     */
    public static function statusLabels(): array
    {
        return [
            self::STATUS_PENDING => 'Pending',
            self::STATUS_COMPLETED => 'Completed',
            self::STATUS_REJECTED => 'Rejected',
        ];
    }

    protected $fillable = [
        'user_id',
        'amount_usd',
        'fee_usd',
        'team_reward_usd',
        'admin_fee_usd',
        'net_usd',
        'destination_address',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'amount_usd' => 'decimal:2',
            'fee_usd' => 'decimal:2',
            'team_reward_usd' => 'decimal:2',
            'admin_fee_usd' => 'decimal:2',
            'net_usd' => 'decimal:2',
        ];
    }

    /** Team Reward pool (10% of gross). Falls back to fee_usd for legacy rows. */
    public function teamRewardUsd(): string
    {
        if ($this->team_reward_usd !== null) {
            return number_format((float) $this->team_reward_usd, 2, '.', '');
        }

        return number_format((float) $this->fee_usd, 2, '.', '');
    }

    public function adminFeeUsd(): string
    {
        return number_format((float) ($this->admin_fee_usd ?? 0), 2, '.', '');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
