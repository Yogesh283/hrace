<?php

namespace App\Console\Commands;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\ReferralTree;
use App\Support\RewardPlan;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class IncomeDiagnoseNetworkRoiCommand extends Command
{
    protected $signature = 'income:diagnose-network-roi
                            {--user= : Show detail for one upline user id}
                            {--limit=20 : Rows in sample tables}';

    protected $description = 'Audit Affiliate Network of ROI vs roi_daily ledger (DB report, no tinker).';

    public function handle(ReferralTree $tree): int
    {
        $limit = max(5, min(100, (int) $this->option('limit')));
        $userFilter = is_numeric($this->option('user')) ? (int) $this->option('user') : null;

        $this->info('Affiliate Network of ROI — database audit');
        $this->newLine();

        $roiDailyCount = LedgerEntry::query()->where('entry_type', LedgerEntry::TYPE_ROI_DAILY)->count();
        $roiDailySum = (string) LedgerEntry::query()->where('entry_type', LedgerEntry::TYPE_ROI_DAILY)->sum('amount_usd');
        $networkCount = LedgerEntry::query()->where('entry_type', LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI)->count();
        $networkSum = (string) LedgerEntry::query()->where('entry_type', LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI)->sum('amount_usd');
        $networkProdCount = LedgerEntry::query()->production()->where('entry_type', LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI)->count();
        $networkProdSum = (string) LedgerEntry::query()->production()->where('entry_type', LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI)->sum('amount_usd');

        $this->table(
            ['Ledger', 'Rows', 'Total USD'],
            [
                ['roi_daily (downline ROI paid)', (string) $roiDailyCount, $roiDailySum],
                ['affiliate_network_roi (all rows)', (string) $networkCount, $networkSum],
                ['affiliate_network_roi (production scope)', (string) $networkProdCount, $networkProdSum],
            ],
        );

        if ($roiDailyCount > 0 && $networkCount === 0) {
            $this->newLine();
            $this->error('ROI was paid but NO network-of-ROI rows exist.');
            $this->line('Run income:pay-roi after uplines exist, or check AffiliateNetworkRoiService is loaded on server.');
        } elseif ($roiDailyCount === 0) {
            $this->newLine();
            $this->warn('No roi_daily rows yet — network-of-ROI only triggers when income:pay-roi credits members.');
            $due = Investment::query()
                ->where('status', Investment::STATUS_ACTIVE)
                ->whereNotNull('next_roi_at')
                ->where('next_roi_at', '<=', now())
                ->count();
            $this->line("Investments due for ROI now: {$due}");
        } else {
            $this->newLine();
            $this->comment('Network-of-ROI is created in the same run as each roi_daily credit (see IncomePayRoiCommand).');
        }

        $activatedMembers = User::query()->whereNotNull('id_activated_at')->count();
        $this->newLine();
        $this->table(
            ['Members', 'Count'],
            [
                ['Activated IDs (first investment)', (string) $activatedMembers],
                ['Activated + at least 1 direct', (string) User::query()->whereNotNull('id_activated_at')->whereHas('referrals')->count()],
            ],
        );

        $this->newLine();
        $this->line('ROI Sharing gate: Level 1 (direct) only — recipient must be self $50+ active:');
        $levelRows = [];
        for ($l = 1; $l <= 10; $l++) {
            $pct = RewardPlan::networkRoiOfRoiPercentForLevel($l);
            $levelRows[] = [
                'L'.$l,
                $pct !== null ? $pct.'%' : '—',
                $l === 1 ? 'self $50+ active' : 'not paid (L1 only)',
            ];
        }
        $this->table(['Level', '% of downline ROI', 'Gate'], $levelRows);

        $this->newLine();
        $this->info('Top earners (affiliate_network_roi, production):');
        $top = LedgerEntry::query()
            ->production()
            ->select('user_id', DB::raw('SUM(amount_usd) as total'), DB::raw('COUNT(*) as cnt'))
            ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI)
            ->when($userFilter, fn ($q) => $q->where('user_id', $userFilter))
            ->groupBy('user_id')
            ->orderByDesc('total')
            ->limit($limit)
            ->get();

        if ($top->isEmpty()) {
            $this->warn('No production network-of-ROI credits yet.');
        } else {
            $this->table(
                ['User ID', 'Payments', 'Total USD'],
                $top->map(fn ($r) => [(string) $r->user_id, (string) $r->cnt, number_format((float) $r->total, 2, '.', '')])->all(),
            );
        }

        $this->newLine();
        $this->info("Last {$limit} affiliate_network_roi credits:");
        $recent = LedgerEntry::query()
            ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI)
            ->latest('id')
            ->limit($limit)
            ->get(['id', 'user_id', 'amount_usd', 'meta', 'created_at']);

        $recentRows = [];
        foreach ($recent as $row) {
            $meta = is_array($row->meta) ? $row->meta : [];
            $recentRows[] = [
                (string) $row->id,
                (string) $row->user_id,
                (string) $row->amount_usd,
                isset($meta['network_level']) ? 'L'.$meta['network_level'] : '—',
                (string) ($meta['from_user_id'] ?? '—'),
                $row->created_at?->toDateTimeString() ?? '',
            ];
        }
        $this->table(['ID', 'Upline', 'USD', 'Lvl', 'From user', 'At'], $recentRows);

        $this->newLine();
        $this->info('Sample: downline got roi_daily — did direct sponsor get network ROI?');
        $samples = LedgerEntry::query()
            ->where('entry_type', LedgerEntry::TYPE_ROI_DAILY)
            ->latest('id')
            ->limit(min(10, $limit))
            ->get(['id', 'user_id', 'amount_usd', 'reference_id', 'created_at']);

        $sampleRows = [];
        foreach ($samples as $roi) {
            $member = User::query()->find($roi->user_id);
            $sponsorId = $member?->referred_by;
            $sponsorShare = $sponsorId
                ? LedgerEntry::query()
                    ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI)
                    ->where('user_id', $sponsorId)
                    ->where('reference_id', $roi->reference_id)
                    ->where('meta->from_user_id', $roi->user_id)
                    ->sum('amount_usd')
                : 0;
            $directActives = $sponsorId
                ? User::query()->where('referred_by', $sponsorId)->whereNotNull('id_activated_at')->count()
                : 0;

            $sampleRows[] = [
                (string) $roi->user_id,
                (string) $roi->amount_usd,
                $sponsorId ? (string) $sponsorId : '—',
                $directActives >= 1 ? 'yes' : 'no ('.$directActives.' actives)',
                bccomp((string) $sponsorShare, '0', 2) > 0 ? (string) $sponsorShare : '0 (gate or blocked)',
            ];
        }
        $this->table(
            ['ROI user', 'ROI $', 'Sponsor', 'Sponsor 1+ active directs?', 'Sponsor L1 network ROI'],
            $sampleRows,
        );

        if ($userFilter !== null) {
            $this->renderUserDetail($userFilter, $tree);
        }

        return self::SUCCESS;
    }

    private function renderUserDetail(int $userId, ReferralTree $tree): void
    {
        $user = User::query()->find($userId);
        if (! $user) {
            $this->warn("User {$userId} not found.");

            return;
        }

        $directActives = User::query()
            ->where('referred_by', $userId)
            ->whereNotNull('participation_activated_at')
            ->count();

        $earned = LedgerEntry::query()
            ->production()
            ->where('user_id', $userId)
            ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI)
            ->sum('amount_usd');

        $selfActive = $user->participation_activated_at !== null;
        $l1Open = $selfActive && ! $user->is_blocked;

        $this->newLine();
        $this->info("User #{$userId} detail");
        $this->table(
            ['Field', 'Value'],
            [
                ['Self $50+ active', $selfActive ? 'yes' : 'no'],
                ['Direct $50+ referrals', (string) $directActives],
                ['Lifetime ROI Sharing (production)', number_format((float) $earned, 2, '.', '')],
                ['Blocked', $user->is_blocked ? 'yes' : 'no'],
            ],
        );

        $pct = RewardPlan::networkRoiOfRoiPercentForLevel(1);
        $this->line(sprintf(
            '  Level 1 (ROI Sharing): %s — %s%% when direct ROI pays',
            $l1Open ? 'OPEN' : 'closed (need self $50+ active, not blocked)',
            $pct ?? '0',
        ));
        $this->line('  Levels 2–10: not paid (ROI Sharing is L1 / direct only)');
    }
}
