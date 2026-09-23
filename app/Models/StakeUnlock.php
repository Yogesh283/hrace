<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StakeUnlock extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_COMPLETED = 'completed';

    protected $fillable = [
        'user_id',
        'investment_id',
        'principal_usd',
        'admin_fee_usd',
        'emi_pool_usd',
        'status',
        'unlocked_at',
    ];

    protected function casts(): array
    {
        return [
            'principal_usd' => 'decimal:2',
            'admin_fee_usd' => 'decimal:2',
            'emi_pool_usd' => 'decimal:2',
            'unlocked_at' => 'datetime',
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

    public function emis(): HasMany
    {
        return $this->hasMany(StakeUnlockEmi::class)->orderBy('emi_number');
    }
}
