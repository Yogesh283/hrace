<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IncomeMigrationPlan extends Model
{
    public const STATUS_PENDING = 'PENDING';

    public const STATUS_SIGNED = 'SIGNED';

    public const STATUS_SUBMITTED = 'SUBMITTED';

    public const STATUS_CONFIRMED = 'CONFIRMED';

    public const STATUS_FAILED = 'FAILED';

    public const STATUS_RECONCILED = 'RECONCILED';

    protected $fillable = [
        'user_id',
        'wallet_address',
        'migration_id',
        'legacy_balance_usd',
        'planned_amount_usd',
        'income_type',
        'source_reference',
        'nonce',
        'deadline',
        'chain_id',
        'vault_address',
        'status',
        'tx_hash',
        'signature_payload',
        'failure_reason',
    ];

    protected function casts(): array
    {
        return [
            'signature_payload' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
