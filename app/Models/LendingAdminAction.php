<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LendingAdminAction extends Model
{
    public const ACTION_BLOCK = 'BLOCK';

    public const ACTION_UNBLOCK = 'UNBLOCK';

    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'admin_id',
        'action',
        'reason',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id');
    }
}
