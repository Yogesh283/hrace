<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Orchid\Filters\Filterable;
use Orchid\Screen\AsSource;

class SupportTicket extends Model
{
    use AsSource;
    use Filterable;

    public const STATUS_OPEN = 'open';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_RESOLVED = 'resolved';

    public const STATUS_CLOSED = 'closed';

    /**
     * @var list<string>
     */
    protected $allowedSorts = [
        'id',
        'token',
        'status',
        'created_at',
    ];

    protected $fillable = [
        'user_id',
        'token',
        'subject',
        'message',
        'status',
        'admin_notes',
    ];

    protected static function booted(): void
    {
        static::creating(function (SupportTicket $ticket): void {
            if ($ticket->token !== null && $ticket->token !== '') {
                return;
            }

            do {
                $token = 'SUP-'.now()->format('Ymd').'-'.strtoupper(Str::random(6));
            } while (static::query()->where('token', $token)->exists());

            $ticket->token = $token;
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array<string, string>
     */
    public static function statusLabels(): array
    {
        return [
            self::STATUS_OPEN => 'Open',
            self::STATUS_IN_PROGRESS => 'In progress',
            self::STATUS_RESOLVED => 'Resolved',
            self::STATUS_CLOSED => 'Closed',
        ];
    }
}
