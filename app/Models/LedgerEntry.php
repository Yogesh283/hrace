<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Orchid\Filters\Filterable;
use Orchid\Screen\AsSource;

class LedgerEntry extends Model
{
    use AsSource;
    use Filterable;

    /**
     * @var list<string>
     */
    protected $allowedSorts = [
        'id',
        'user_id',
        'entry_type',
        'amount_usd',
        'created_at',
    ];

    public const TYPE_REFERRAL_DIRECT = 'referral_direct';

    public const TYPE_AFFILIATE_MTH = 'affiliate_mth';

    /** @deprecated Legacy — use TYPE_COMMUNITY_TEAM_REWARD */
    public const TYPE_AFFILIATE_TEAM_REWARD = 'affiliate_team_reward';

    public const TYPE_COMMUNITY_TEAM_REWARD = 'community_team_reward';

    /** @deprecated Legacy */
    public const TYPE_AFFILIATE_SPONSOR = 'affiliate_sponsor';

    /** @deprecated Legacy */
    public const TYPE_AFFILIATE_R10 = 'affiliate_r10';

    /** @deprecated Legacy — use TYPE_COMMUNITY_LEADERSHIP */
    public const TYPE_AFFILIATE_R10_LEADERSHIP = 'affiliate_r10_leadership';

    public const TYPE_COMMUNITY_LEADERSHIP = 'community_leadership';

    public const TYPE_COMMUNITY_LEADERSHIP_SKIP = 'community_leadership_skip';

    public const TYPE_COMMUNITY_LEADERSHIP_RANK11_MONTHLY = 'community_leadership_rank11_monthly';

    public const TYPE_COMMUNITY_REFERRAL = 'community_referral';

    /** @deprecated Historical — Community Placement ($10) removed; keep for old ledger rows */
    public const TYPE_COMMUNITY_PLACEMENT_REFERRAL = 'community_placement_referral';

    /** @deprecated Historical — Community Placement matrix removed; keep for old ledger rows */
    public const TYPE_COMMUNITY_TEAM_PLACEMENT = 'community_team_placement';

    /** @deprecated Historical — Community Placement matrix removed; keep for old ledger rows */
    public const TYPE_COMMUNITY_TEAM_SPONSOR = 'community_team_sponsor';

    public const TYPE_ROI_MONTHLY = 'roi_monthly';

    public const TYPE_ROI_DAILY = 'roi_daily';

    /** Daily ROI accrued on stake — audit only; does not change withdrawable wallet until claim. */
    public const TYPE_ROI_ACCRUAL = 'roi_accrual';

    /** Claim accrued platform income into virtual USDT wallet — no Admin Fee. */
    public const TYPE_INCOME_CLAIM = 'income_claim';

    public const TYPE_INVESTMENT_DEBIT = 'investment_debit';

    public const TYPE_WALLET_DEPOSIT = 'wallet_deposit';

    public const TYPE_WALLET_WITHDRAWAL = 'wallet_withdrawal';

    /** Wallet withdraw fee credited to company / admin USDT BEP20 treasury */
    public const TYPE_WITHDRAWAL_ADMIN_FEE = 'withdrawal_admin_fee';

    /** Stake unlock: 10% principal fee to admin */
    public const TYPE_STAKE_UNLOCK_ADMIN_FEE = 'stake_unlock_admin_fee';

    /** Stake unlock EMI (30% tranche) credited to member wallet */
    public const TYPE_STAKE_UNLOCK_EMI = 'stake_unlock_emi';

    /** Daily ROI reinvested back into the same stake principal (wallet debit) */
    public const TYPE_COMPOUND_REINVEST = 'compound_reinvest';

    public const TYPE_ACTIVATION_REFERRAL = 'activation_referral';

    public const TYPE_AFFILIATE_PLACEMENT = 'affiliate_placement';

    public const TYPE_AFFILIATE_REFERRAL = 'affiliate_referral';

    public const TYPE_AFFILIATE_NETWORK_ROI = 'affiliate_network_roi';

    public const TYPE_BONZA_DIRECT_BONUS = 'bonza_direct_bonus';

    public const TYPE_BONZA_BUSTER = 'bonza_buster';

    protected $fillable = [
        'user_id',
        'entry_type',
        'amount_usd',
        'balance_after_usd',
        'reference_type',
        'reference_id',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'amount_usd' => 'decimal:4',
            'balance_after_usd' => 'decimal:4',
            'meta' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Exclude demo / seed ledger rows (not real platform income or wallet activity).
     */
    /**
     * Ledger rows that change member withdrawable (virtual) USDT balance.
     *
     * @return list<string>
     */
    public static function walletBalanceEntryTypes(): array
    {
        return [
            self::TYPE_REFERRAL_DIRECT,
            self::TYPE_AFFILIATE_MTH,
            self::TYPE_AFFILIATE_TEAM_REWARD,
            self::TYPE_COMMUNITY_TEAM_REWARD,
            self::TYPE_AFFILIATE_SPONSOR,
            self::TYPE_AFFILIATE_R10,
            self::TYPE_AFFILIATE_R10_LEADERSHIP,
            self::TYPE_COMMUNITY_LEADERSHIP,
            self::TYPE_COMMUNITY_LEADERSHIP_SKIP,
            self::TYPE_COMMUNITY_LEADERSHIP_RANK11_MONTHLY,
            self::TYPE_COMMUNITY_REFERRAL,
            self::TYPE_COMMUNITY_PLACEMENT_REFERRAL,
            self::TYPE_COMMUNITY_TEAM_PLACEMENT,
            self::TYPE_COMMUNITY_TEAM_SPONSOR,
            self::TYPE_ROI_MONTHLY,
            self::TYPE_ROI_DAILY,
            self::TYPE_INCOME_CLAIM,
            self::TYPE_INVESTMENT_DEBIT,
            self::TYPE_WALLET_DEPOSIT,
            self::TYPE_WALLET_WITHDRAWAL,
            self::TYPE_STAKE_UNLOCK_EMI,
            self::TYPE_COMPOUND_REINVEST,
            self::TYPE_ACTIVATION_REFERRAL,
            self::TYPE_AFFILIATE_PLACEMENT,
            self::TYPE_AFFILIATE_REFERRAL,
            self::TYPE_AFFILIATE_NETWORK_ROI,
            self::TYPE_BONZA_DIRECT_BONUS,
            self::TYPE_BONZA_BUSTER,
        ];
    }

    public function scopeProduction(Builder $query): Builder
    {
        return $query
            ->where(function (Builder $q) {
                $q->whereNull('reference_type')
                    ->orWhere('reference_type', '!=', 'demo');
            })
            ->where(function (Builder $q) {
                $q->whereNull('meta')
                    ->orWhere(function (Builder $q2) {
                        $q2->whereNull('meta->demo_seed')
                            ->whereNull('meta->seed');
                    });
            });
    }

    public function isDemo(): bool
    {
        if ($this->reference_type === 'demo') {
            return true;
        }

        $meta = $this->meta;
        if (! is_array($meta)) {
            return false;
        }

        return ! empty($meta['demo_seed']) || ! empty($meta['seed']);
    }
}
