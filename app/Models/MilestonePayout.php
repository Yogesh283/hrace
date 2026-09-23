<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Orchid\Filters\Filterable;
use Orchid\Screen\AsSource;

class MilestonePayout extends Model
{
    use AsSource;
    use Filterable;

    /**
     * @var list<string>
     */
    protected $allowedSorts = [
        'id',
        'user_id',
        'milestone_code',
        'created_at',
    ];

    protected $fillable = [
        'user_id',
        'milestone_code',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
