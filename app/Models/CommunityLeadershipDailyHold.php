<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommunityLeadershipDailyHold extends Model
{
    protected $fillable = [
        'user_id',
        'hold_date',
        'rank_level',
        'team_volume_usd',
        'self_hold_usd',
        'qualified_directs',
    ];

    protected function casts(): array
    {
        return [
            'hold_date' => 'date',
            'rank_level' => 'integer',
            'team_volume_usd' => 'decimal:2',
            'self_hold_usd' => 'decimal:2',
            'qualified_directs' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
