<?php

namespace App\Support;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Support\RewardPlan;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class IncomeCatalog
{
    /**
     * @return list<array{key: string, label: string, short_label?: string, types: list<string>, route?: string, trigger?: string}>
     */
    public static function items(): array
    {
        return config('income_catalog.items', []);
    }

    /**
     * @return list<string>
     */
    public static function typesForKey(string $key): array
    {
        foreach (self::items() as $item) {
            if (($item['key'] ?? '') === $key) {
                return $item['types'] ?? [];
            }
        }

        return [];
    }

    public static function labelForType(string $entryType): string
    {
        foreach (self::items() as $item) {
            if (in_array($entryType, $item['types'], true)) {
                return $item['label'];
            }
        }

        return ucfirst(str_replace('_', ' ', $entryType));
    }

    /**
     * @return array<string, string>
     */
    public static function typeLabelsMap(): array
    {
        $map = [
            LedgerEntry::TYPE_WALLET_DEPOSIT => 'Wallet deposit',
            LedgerEntry::TYPE_WALLET_WITHDRAWAL => 'Wallet withdrawal',
            LedgerEntry::TYPE_WITHDRAWAL_ADMIN_FEE => 'Withdrawal admin fee',
            LedgerEntry::TYPE_STAKE_UNLOCK_ADMIN_FEE => 'Stake unlock admin fee',
            LedgerEntry::TYPE_STAKE_UNLOCK_EMI => 'Stake unlock EMI',
            LedgerEntry::TYPE_COMPOUND_REINVEST => 'Daily compound',
            LedgerEntry::TYPE_INVESTMENT_DEBIT => 'Investment',
        ];

        foreach (self::items() as $item) {
            foreach ($item['types'] as $type) {
                $map[$type] = $item['label'];
            }
        }

        return $map;
    }

    /**
     * @return list<array{key: string, label: string, short_label: string, amount_usd: string, count: int, has_earned: bool, route: string, trigger: string, types: list<string>}>
     */
    public static function applyIncomeKeyFilter(Builder $query, string $incomeKey): void
    {
        if ($incomeKey === 'community_referrals') {
            $query->where('entry_type', LedgerEntry::TYPE_COMMUNITY_REFERRAL);

            return;
        }

        if ($incomeKey === 'affiliate_referral') {
            $query->where(function (Builder $q) {
                $q->where('entry_type', LedgerEntry::TYPE_COMMUNITY_REFERRAL)
                    ->where('meta->level', 1);
            });

            return;
        }

        if ($incomeKey === 'affiliate_sponsor') {
            $query->where(function (Builder $q) {
                $q->where('entry_type', LedgerEntry::TYPE_COMMUNITY_REFERRAL)
                    ->where('meta->level', '>=', 2);
            });

            return;
        }

        $types = self::typesForKey($incomeKey);
        if ($types !== []) {
            $query->whereIn('entry_type', $types);
        }
    }

    /**
     * @return array{sum: float, count: int}
     */
    public static function totalsForIncomeKey(int $userId, string $incomeKey): array
    {
        $query = LedgerEntry::query()
            ->production()
            ->where('user_id', $userId)
            ->where('amount_usd', '>', 0);

        self::applyIncomeKeyFilter($query, $incomeKey);

        return [
            'sum' => (float) ($query->sum('amount_usd') ?? 0),
            'count' => (int) (clone $query)->count(),
        ];
    }

    public static function summarizeForUser(int $userId): array
    {
        /** @var Collection<string, object{entry_type: string, total: string|float, cnt: int}> $totals */
        $totals = LedgerEntry::query()
            ->production()
            ->where('user_id', $userId)
            ->where('amount_usd', '>', 0)
            ->where('entry_type', '!=', LedgerEntry::TYPE_WALLET_DEPOSIT)
            ->selectRaw('entry_type, SUM(amount_usd) as total, COUNT(*) as cnt')
            ->groupBy('entry_type')
            ->get()
            ->keyBy('entry_type');

        $summary = [];

        foreach (self::items() as $item) {
            $key = (string) ($item['key'] ?? '');
            if (in_array($key, ['affiliate_referral', 'affiliate_sponsor'], true)) {
                $scoped = self::totalsForIncomeKey($userId, $key);
                $sum = $scoped['sum'];
                $count = $scoped['count'];
            } else {
                $sum = 0.0;
                $count = 0;

                foreach ($item['types'] as $type) {
                    $row = $totals->get($type);
                    if ($row) {
                        $sum += (float) $row->total;
                        $count += (int) $row->cnt;
                    }
                }
            }

            $summary[] = [
                'key' => $item['key'],
                'label' => $item['label'],
                'short_label' => $item['short_label'] ?? $item['label'],
                'amount_usd' => number_format($sum, 2, '.', ''),
                'count' => $count,
                'has_earned' => $sum > 0,
                'route' => $item['route'] ?? 'dashboard',
                'trigger' => $item['trigger'] ?? '',
                'types' => $item['types'],
            ];
        }

        return $summary;
    }

    public static function totalIncomeUsd(int $userId): string
    {
        $sum = (float) (LedgerEntry::query()
            ->production()
            ->where('user_id', $userId)
            ->where('amount_usd', '>', 0)
            ->where('entry_type', '!=', LedgerEntry::TYPE_WALLET_DEPOSIT)
            ->sum('amount_usd') ?? 0);

        return number_format($sum, 2, '.', '');
    }

    /**
     * Shared props for all authenticated member pages (Inertia).
     *
     * @return array{
     *     total_income_usd: string,
     *     earned_count: int,
     *     program_count: int,
     *     programs: list<array<string, mixed>>,
     *     type_labels: array<string, string>
     * }
     */
    public static function hubForUser(int $userId): array
    {
        $programs = self::summarizeForUser($userId);
        $earnedCount = collect($programs)->where('has_earned', true)->count();

        $mapped = array_map(static function (array $row) use ($userId) {
            $routeName = $row['route'] ?? 'dashboard';
            $href = $routeName === 'transactions'
                ? route('transactions', ['income' => $row['key']])
                : route($routeName);

            $enriched = [
                ...$row,
                'href' => $href,
                'ledger_href' => route('transactions', ['income' => $row['key']]),
            ];

            return $enriched;
        }, $programs);

        return [
            'total_income_usd' => self::totalIncomeUsd($userId),
            'earned_count' => $earnedCount,
            'program_count' => count($programs),
            'programs' => $mapped,
            'type_labels' => self::typeLabelsMap(),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function recentEntriesForUser(int $userId, ?string $incomeKey = null, int $limit = 50): array
    {
        $query = LedgerEntry::query()
            ->production()
            ->where('user_id', $userId)
            ->latest('id');

        if ($incomeKey) {
            self::applyIncomeKeyFilter($query, $incomeKey);
        }

        $rows = $query
            ->limit($limit)
            ->get([
                'id',
                'entry_type',
                'amount_usd',
                'balance_after_usd',
                'reference_type',
                'reference_id',
                'meta',
                'created_at',
            ]);

        return self::formatLedgerRows($rows);
    }

    /**
     * @param  Collection<int, LedgerEntry>|list<LedgerEntry>  $rows
     * @return list<array<string, mixed>>
     */
    public static function formatLedgerRows(Collection|array $rows): array
    {
        $collection = $rows instanceof Collection ? $rows : collect($rows);
        $memberLabels = self::memberLabelsForEntries($collection);
        $investmentPrincipals = self::investmentPrincipalUsdForEntries($collection);

        return $collection
            ->map(static fn (LedgerEntry $row) => self::formatLedgerRow($row, $memberLabels, $investmentPrincipals))
            ->values()
            ->all();
    }

    /**
     * @param  array<int, string>  $memberLabels
     * @param  array<int, string>  $investmentPrincipals
     * @return array<string, mixed>
     */
    public static function formatLedgerRow(LedgerEntry $row, array $memberLabels = [], array $investmentPrincipals = []): array
    {
        $meta = is_array($row->meta) ? $row->meta : [];
        [$level, $levelLabel, $detail] = self::transactionContext($row, $meta, $memberLabels, $investmentPrincipals);

        return [
            'id' => $row->id,
            'entry_type' => $row->entry_type,
            'income_name' => self::labelForType((string) $row->entry_type),
            'income_key' => self::keyForEntry($row),
            'amount_usd' => $row->amount_usd,
            'balance_after_usd' => $row->balance_after_usd,
            'reference_type' => $row->reference_type,
            'reference_id' => $row->reference_id,
            'level' => $level,
            'level_label' => $levelLabel,
            'detail' => $detail,
            'created_at' => $row->created_at,
        ];
    }

    /**
     * @param  Collection<int, LedgerEntry>  $entries
     * @return array<int, string>
     */
    public static function memberLabelsForEntries(Collection $entries): array
    {
        $ids = [];

        foreach ($entries as $row) {
            $meta = is_array($row->meta) ? $row->meta : [];

            if (! empty($meta['from_user_id'])) {
                $ids[] = (int) $meta['from_user_id'];
            }

            if ($row->entry_type === LedgerEntry::TYPE_AFFILIATE_PLACEMENT && $row->reference_id) {
                $ids[] = (int) $row->reference_id;
            }
        }

        $ids = array_values(array_unique(array_filter($ids)));

        if ($ids === []) {
            return [];
        }

        return User::query()
            ->whereIn('id', $ids)
            ->get(['id', 'member_number'])
            ->mapWithKeys(static fn (User $user) => [
                $user->id => MemberCode::format($user->member_number),
            ])
            ->all();
    }

    /**
     * Map investment id → principal USD for ROI / investment-referenced ledger entries.
     *
     * @param  Collection<int, LedgerEntry>  $entries
     * @return array<int, string>
     */
    public static function investmentPrincipalUsdForEntries(Collection $entries): array
    {
        $ids = [];
        foreach ($entries as $row) {
            if (($row->reference_type ?? '') === 'investment' && $row->reference_id) {
                $ids[] = (int) $row->reference_id;
            }
        }

        $ids = array_values(array_unique(array_filter($ids)));
        if ($ids === []) {
            return [];
        }

        return Investment::query()
            ->whereIn('id', $ids)
            ->get(['id', 'amount_usd'])
            ->mapWithKeys(static fn (Investment $inv) => [
                (int) $inv->id => number_format((float) $inv->amount_usd, 2, '.', ''),
            ])
            ->all();
    }

    /**
     * @param  array<string, mixed>  $meta
     * @param  array<int, string>  $memberLabels
     * @param  array<int, string>  $investmentPrincipals
     * @return array{0: ?int, 1: ?string, 2: ?string}
     */
    private static function transactionContext(LedgerEntry $row, array $meta, array $memberLabels, array $investmentPrincipals): array
    {
        return match ($row->entry_type) {
            LedgerEntry::TYPE_AFFILIATE_PLACEMENT => self::affiliatePlacementContext($row, $meta, $memberLabels),
            LedgerEntry::TYPE_COMMUNITY_TEAM_REWARD => self::affiliateTeamRewardContext($row, $meta, $memberLabels),
            LedgerEntry::TYPE_COMMUNITY_REFERRAL => self::levelFromMetaContext($row, $meta, $memberLabels),
            LedgerEntry::TYPE_COMMUNITY_LEADERSHIP,
            LedgerEntry::TYPE_COMMUNITY_LEADERSHIP_SKIP,
            LedgerEntry::TYPE_COMMUNITY_LEADERSHIP_RANK11_MONTHLY => self::communityLeadershipContext($row, $meta),
            LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI => self::networkRoiContext($row, $meta, $memberLabels),
            LedgerEntry::TYPE_ROI_DAILY,
            LedgerEntry::TYPE_ROI_MONTHLY => self::roiContext($row, $meta, $investmentPrincipals),
            LedgerEntry::TYPE_ACTIVATION_REFERRAL,
            LedgerEntry::TYPE_AFFILIATE_REFERRAL,
            LedgerEntry::TYPE_AFFILIATE_SPONSOR => self::levelFromMetaContext($row, $meta, $memberLabels),
            LedgerEntry::TYPE_BONZA_BUSTER => self::bonzaBusterContext($row, $meta, $memberLabels),
            LedgerEntry::TYPE_AFFILIATE_R10_LEADERSHIP => self::affiliateR10LeadershipContext($row, $meta),
            default => [null, null, null],
        };
    }

    /**
     * @param  array<string, mixed>  $meta
     * @param  array<int, string>  $investmentPrincipals
     * @return array{0: ?int, 1: ?string, 2: ?string}
     */
    private static function roiContext(LedgerEntry $row, array $meta, array $investmentPrincipals): array
    {
        $invId = null;
        if (($row->reference_type ?? '') === 'investment' && $row->reference_id) {
            $invId = (int) $row->reference_id;
        }

        $principal = $invId ? ($investmentPrincipals[$invId] ?? null) : null;

        $parts = [];
        if ($principal !== null) {
            $parts[] = "Invested {$principal} USD";
        }
        if ($row->entry_type === LedgerEntry::TYPE_ROI_DAILY && isset($meta['roi_percent_daily'])) {
            $parts[] = rtrim(rtrim(number_format((float) $meta['roi_percent_daily'], 4, '.', ''), '0'), '.').'% daily';
        }
        if ($row->entry_type === LedgerEntry::TYPE_ROI_MONTHLY && isset($meta['roi_percent_monthly'])) {
            $parts[] = rtrim(rtrim(number_format((float) $meta['roi_percent_monthly'], 4, '.', ''), '0'), '.').'% monthly';
        }
        if ($invId) {
            $parts[] = "investment #{$invId}";
        }
        if ($row->entry_type === LedgerEntry::TYPE_ROI_DAILY && isset($meta['payout_index'], $meta['duration_days'])) {
            $parts[] = "day {$meta['payout_index']} / {$meta['duration_days']}";
        }

        return [null, null, $parts !== [] ? implode(' · ', $parts) : null];
    }

    /**
     * @param  array<string, mixed>  $meta
     * @param  array<int, string>  $memberLabels
     * @return array{0: ?int, 1: ?string, 2: ?string}
     */
    /**
     * @param  array<string, mixed>  $meta
     * @param  array<int, string>  $memberLabels
     * @return array{0: ?int, 1: ?string, 2: ?string}
     */
    private static function affiliateTeamRewardContext(LedgerEntry $row, array $meta, array $memberLabels): array
    {
        $level = isset($meta['level']) ? (int) $meta['level'] : null;
        $levelLabel = $level !== null ? 'Level '.$level : null;

        $fromId = (int) ($meta['from_user_id'] ?? 0);
        $fromCode = $fromId > 0 ? ($memberLabels[$fromId] ?? null) : null;

        $parts = [];
        if ($levelLabel !== null) {
            $parts[] = $levelLabel;
        }
        if (($row->reference_type ?? '') === 'withdrawal') {
            $gross = $meta['withdrawal_gross_usd'] ?? null;
            $parts[] = $gross !== null
                ? "from withdrawal {$gross} USD"
                : 'from downline withdrawal';
        }
        if ($fromCode !== null) {
            $parts[] = "member {$fromCode}";
        }

        return [$level, $levelLabel, $parts !== [] ? implode(' · ', $parts) : null];
    }

    /**
     * @param  array<string, mixed>  $meta
     * @param  array<int, string>  $memberLabels
     * @return array{0: ?int, 1: ?string, 2: ?string}
     */
    private static function affiliatePlacementContext(LedgerEntry $row, array $meta, array $memberLabels): array
    {
        $level = self::resolvePlacementLevel($meta);
        $tierLabel = match ($meta['placement_tier'] ?? '') {
            'direct_sponsor' => 'direct sponsor',
            'grandparent' => 'grandparent',
            default => $level === 1 ? 'direct sponsor' : ($level === 2 ? 'grandparent' : null),
        };

        $levelLabel = $level !== null ? 'Level '.$level : null;

        $fromId = (int) ($meta['from_user_id'] ?? $row->reference_id ?? 0);
        $fromCode = $fromId > 0 ? ($memberLabels[$fromId] ?? null) : null;

        $parts = [];
        if ($levelLabel !== null) {
            $parts[] = $tierLabel !== null
                ? "{$levelLabel} ({$tierLabel})"
                : $levelLabel;
        }
        if ($fromCode !== null) {
            $parts[] = "new member {$fromCode}";
        }

        return [$level, $levelLabel, $parts !== [] ? implode(' · ', $parts) : null];
    }

    /**
     * @param  array<string, mixed>  $meta
     * @param  array<int, string>  $memberLabels
     * @return array{0: ?int, 1: ?string, 2: ?string}
     */
    /**
     * @param  array<string, mixed>  $meta
     * @param  array<int, string>  $memberLabels
     * @return array{0: ?int, 1: ?string, 2: ?string}
     */
    private static function networkRoiContext(LedgerEntry $row, array $meta, array $memberLabels): array
    {
        if (! isset($meta['network_level'])) {
            return [null, null, null];
        }

        $level = (int) $meta['network_level'];
        $levelLabel = 'Level '.$level;

        $fromId = (int) ($meta['from_user_id'] ?? 0);
        $fromCode = $fromId > 0 ? ($memberLabels[$fromId] ?? null) : null;
        $pct = $meta['percent'] ?? null;

        $parts = [$levelLabel];
        if ($pct !== null) {
            $parts[] = (is_numeric($pct) ? rtrim(rtrim(number_format((float) $pct, 2, '.', ''), '0'), '.') : (string) $pct).'% of ROI';
        }
        if ($fromCode !== null) {
            $parts[] = "from {$fromCode}";
        }

        return [$level, $levelLabel, implode(' · ', $parts)];
    }

    /**
     * @param  array<string, mixed>  $meta
     * @param  array<int, string>  $memberLabels
     * @return array{0: ?int, 1: ?string, 2: ?string}
     */
    /**
     * @param  array<string, mixed>  $meta
     * @param  array<int, string>  $memberLabels
     * @return array{0: ?int, 1: ?string, 2: ?string}
     */
    private static function bonzaBusterContext(LedgerEntry $row, array $meta, array $memberLabels): array
    {
        $level = isset($meta['level']) ? (int) $meta['level'] : 1;
        $levelLabel = 'Level '.$level;

        $fromId = (int) ($meta['from_user_id'] ?? 0);
        $fromCode = $fromId > 0 ? ($memberLabels[$fromId] ?? null) : null;

        $parts = [$levelLabel];
        $pct = $meta['percent'] ?? null;
        if ($pct !== null && $pct !== '') {
            $parts[] = rtrim(rtrim(number_format((float) $pct, 2, '.', ''), '0'), '.').'% of referral principal';
        }
        if ($fromCode !== null) {
            $parts[] = "from {$fromCode}";
        }

        return [$level, $levelLabel, implode(' · ', $parts)];
    }

    private static function levelFromMetaContext(LedgerEntry $row, array $meta, array $memberLabels): array
    {
        if (! isset($meta['level'])) {
            return [null, null, null];
        }

        $level = (int) $meta['level'];
        $levelLabel = 'Level '.$level;

        $fromId = (int) ($meta['from_user_id'] ?? $row->reference_id ?? 0);
        $fromCode = $fromId > 0 ? ($memberLabels[$fromId] ?? null) : null;

        $detail = $fromCode !== null
            ? "{$levelLabel} · from {$fromCode}"
            : $levelLabel;

        return [$level, $levelLabel, $detail];
    }

    /**
     * @param  array<string, mixed>  $meta
     * @return array{0: ?int, 1: ?string, 2: ?string}
     */
    private static function communityLeadershipContext(LedgerEntry $row, array $meta): array
    {
        $level = isset($meta['level']) ? (int) $meta['level'] : null;
        $levelLabel = $level !== null ? 'Level '.$level : 'Community Leadership';

        $parts = [];
        if (isset($meta['reward_percent'])) {
            $parts[] = rtrim(rtrim(number_format((float) $meta['reward_percent'], 2, '.', ''), '0'), '.').'%';
        }
        if (isset($meta['period'])) {
            $parts[] = 'period '.$meta['period'];
        }

        return [$level, $levelLabel, $parts !== [] ? implode(' · ', $parts) : null];
    }

    private static function affiliateR10LeadershipContext(LedgerEntry $row, array $meta): array
    {
        $level = isset($meta['level']) ? (int) $meta['level'] : null;
        $rankCode = strtoupper(trim((string) ($meta['rank_code'] ?? '')));

        if ($rankCode === '' && $level !== null && $level >= 1 && $level <= 10) {
            $rankCode = 'R'.$level;
        }

        $levelLabel = $rankCode !== '' ? $rankCode : ($level !== null ? 'Level '.$level : null);

        $parts = [];
        if ($rankCode !== '') {
            $parts[] = "From {$rankCode} rank";
        }
        if ($level !== null) {
            $parts[] = "level {$level} team volume";
        }

        $period = $meta['period'] ?? null;
        if (is_string($period) && preg_match('/^\d{4}-\d{2}$/', $period)) {
            $parts[] = 'period '.substr($period, 0, 7);
        }

        $pct = $meta['team_volume_percent'] ?? $meta['month_reward_percent'] ?? null;
        $billable = $meta['billable_team_volume_usd'] ?? $meta['base_team_volume_usd'] ?? null;
        if ($pct !== null && $billable !== null) {
            $pctStr = rtrim(rtrim(number_format((float) $pct, 2, '.', ''), '0'), '.');
            $volStr = number_format((float) $billable, 2, '.', ',');
            $parts[] = "{$pctStr}% of \${$volStr} volume";
        }

        return [$level, $levelLabel, $parts !== [] ? implode(' · ', $parts) : null];
    }

    /**
     * @param  array<string, mixed>  $meta
     */
    private static function resolvePlacementLevel(array $meta): ?int
    {
        if (isset($meta['level'])) {
            return (int) $meta['level'];
        }

        return match ($meta['placement_tier'] ?? '') {
            'direct_sponsor' => 1,
            'grandparent' => 2,
            default => null,
        };
    }

    public static function keyForType(string $entryType): ?string
    {
        foreach (self::items() as $item) {
            if (in_array($entryType, $item['types'], true)) {
                return $item['key'];
            }
        }

        return null;
    }

    public static function keyForEntry(LedgerEntry $row): ?string
    {
        if ($row->entry_type === LedgerEntry::TYPE_COMMUNITY_REFERRAL) {
            return 'community_referrals';
        }

        if ($row->entry_type === LedgerEntry::TYPE_AFFILIATE_REFERRAL) {
            $level = (int) (($row->meta ?? [])['level'] ?? 1);

            return $level === 1 ? 'affiliate_referral' : 'affiliate_sponsor';
        }

        return self::keyForType((string) $row->entry_type);
    }
}
