<?php

namespace App\Models;

use App\Support\MemberCode;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;
use Orchid\Filters\Types\Like;
use Orchid\Filters\Types\Where;
use Orchid\Filters\Types\WhereDateStartEnd;
use Orchid\Platform\Models\User as OrchidUser;

class User extends OrchidUser
{
    public const LENDING_STATUS_ACTIVE = 'ACTIVE';

    public const LENDING_STATUS_BLOCKED = 'BLOCKED';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'permissions',
        'wallet_address',
        'balance_usd',
        'level',
        'referral_code',
        'joined_with_code',
        'referred_by',
        'is_blocked',
        'withdrawals_disabled',
        'lending_user_status',
        'lending_blocked_at',
        'lending_blocked_by',
        'lending_block_reason',
        'id_activated_at',
        'bonza_rank_at',
        'bonza_direct_bonus_at',
        'placement_l1_done_at',
        'placement_l2_done_at',
        'participation_activated_at',
        'compound_rewards_enabled',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'permissions',
    ];

    /**
     * @var array<string, string>
     */
    protected $appends = [
        'member_code',
    ];

    protected $casts = [
        'permissions' => 'array',
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'is_blocked' => 'boolean',
        'withdrawals_disabled' => 'boolean',
        'id_activated_at' => 'datetime',
        'bonza_rank_at' => 'datetime',
        'bonza_direct_bonus_at' => 'datetime',
        'placement_l1_done_at' => 'datetime',
        'placement_l2_done_at' => 'datetime',
        'participation_activated_at' => 'datetime',
        'last_income_claim_at' => 'datetime',
        'compound_rewards_enabled' => 'boolean',
        'lending_blocked_at' => 'datetime',
        'level' => 'integer',
        'balance_usd' => 'decimal:2',
        'member_number' => 'integer',
    ];

    /**
     * @var array<string, string>
     */
    protected $allowedFilters = [
        'id' => Where::class,
        'name' => Like::class,
        'email' => Like::class,
        'updated_at' => WhereDateStartEnd::class,
        'created_at' => WhereDateStartEnd::class,
    ];

    /**
     * @var list<string>
     */
    protected $allowedSorts = [
        'id',
        'name',
        'email',
        'updated_at',
        'created_at',
    ];

    protected static function booted(): void
    {
        static::creating(function (User $user) {
            if (blank($user->referral_code)) {
                $user->referral_code = static::generateUniqueReferralCode();
            }
            if ($user->member_number === null) {
                $user->member_number = static::allocateMemberNumber();
            }
            $user->level = (int) ($user->level ?? 1);
            $user->is_blocked = (bool) ($user->is_blocked ?? false);
            $user->lending_user_status = $user->lending_user_status ?? self::LENDING_STATUS_ACTIVE;
        });

        static::created(function (User $user) {
            UserWallet::query()->firstOrCreate(
                ['user_id' => $user->id],
                ['balance_usd' => $user->balance_usd ?? 0],
            );
        });
    }

    public function getMemberCodeAttribute(): string
    {
        return MemberCode::format($this->member_number);
    }

    public static function allocateMemberNumber(): int
    {
        $next = (int) static::query()->max('member_number') + 1;
        if ($next < 1000) {
            $next = 1000;
        }
        if ($next <= 9999 && ! static::query()->where('member_number', $next)->exists()) {
            return $next;
        }

        for ($i = 0; $i < 40; $i++) {
            $n = random_int(1000, 9999);
            if (! static::query()->where('member_number', $n)->exists()) {
                return $n;
            }
        }

        throw new \RuntimeException('Could not assign a unique 4-digit member number.');
    }

    public function referrer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referred_by');
    }

    public function referrals(): HasMany
    {
        return $this->hasMany(User::class, 'referred_by');
    }

    public function investments(): HasMany
    {
        return $this->hasMany(Investment::class);
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(LedgerEntry::class);
    }

    public function userWallet(): HasOne
    {
        return $this->hasOne(UserWallet::class);
    }

    public static function generateUniqueReferralCode(): string
    {
        do {
            $code = strtoupper(Str::random(8));
        } while (static::query()->where('referral_code', $code)->exists());

        return $code;
    }

    public static function idByWallet(?string $wallet): ?int
    {
        $wallet = strtolower(trim((string) $wallet));
        if (! preg_match('/^0x[a-f0-9]{40}$/', $wallet)) {
            return null;
        }

        return static::query()->where('wallet_address', $wallet)->value('id');
    }

    public function canRequestWithdrawal(): bool
    {
        return ! (bool) $this->withdrawals_disabled;
    }

    public function isLendingAccessActive(): bool
    {
        return ($this->lending_user_status ?? self::LENDING_STATUS_ACTIVE) === self::LENDING_STATUS_ACTIVE;
    }

    /**
     * @return array<string, mixed>
     */
    public function lendingAccessForUi(): array
    {
        $blocked = ! $this->isLendingAccessActive();

        return [
            'status' => $blocked ? self::LENDING_STATUS_BLOCKED : self::LENDING_STATUS_ACTIVE,
            'blocked' => $blocked,
            'reason' => $blocked ? (string) ($this->lending_block_reason ?? '') : null,
            'blocked_at' => $blocked ? $this->lending_blocked_at?->toIso8601String() : null,
        ];
    }

    public function lendingBlockedByAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'lending_blocked_by');
    }

    public function lendingAdminActions(): HasMany
    {
        return $this->hasMany(LendingAdminAction::class);
    }
}
