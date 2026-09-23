<?php

namespace App\Console\Commands;

use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\LedgerWriter;
use App\Support\IncomeCatalog;
use App\Support\MemberCode;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class IncomeSeedMemberTransactionsCommand extends Command
{
    protected $signature = 'income:seed-member-transactions
                            {member_number : 4-digit member number (e.g. 8646 for RC8646)}
                            {--fresh : Remove existing income ledger rows for this user first}
                            {--dry-run : Show what would be created without writing}';

    protected $description = 'TEST ONLY: Create sample ledger credits (excluded from dashboard via ledger:purge-demo)';

    /**
     * @return list<array{type: string, amount: string, reference_type: string, meta: array<string, mixed>}>
     */
    private function incomeRows(): array
    {
        return [
            [
                'type' => LedgerEntry::TYPE_ACTIVATION_REFERRAL,
                'amount' => '3.00',
                'reference_type' => 'activation',
                'meta' => ['level' => 1, 'note' => 'ID activation referral L1'],
            ],
            [
                'type' => LedgerEntry::TYPE_AFFILIATE_PLACEMENT,
                'amount' => '1.00',
                'reference_type' => 'placement',
                'meta' => ['level' => 1, 'note' => 'Affiliate placement direct'],
            ],
            [
                'type' => LedgerEntry::TYPE_ROI_DAILY,
                'amount' => '2.50',
                'reference_type' => 'investment',
                'meta' => ['note' => 'Built for Growth daily ROI'],
            ],
            [
                'type' => LedgerEntry::TYPE_ROI_MONTHLY,
                'amount' => '5.00',
                'reference_type' => 'investment',
                'meta' => ['note' => 'Trading ROI monthly accrual'],
            ],
            [
                'type' => LedgerEntry::TYPE_AFFILIATE_REFERRAL,
                'amount' => '5.00',
                'reference_type' => 'investment',
                'meta' => ['level' => 1, 'principal_usd' => '100.00'],
            ],
            [
                'type' => LedgerEntry::TYPE_REFERRAL_DIRECT,
                'amount' => '5.00',
                'reference_type' => 'referral',
                'meta' => ['note' => 'Direct referral bonus'],
            ],
            [
                'type' => LedgerEntry::TYPE_AFFILIATE_SPONSOR,
                'amount' => '2.50',
                'reference_type' => 'sponsor',
                'meta' => ['note' => 'Affiliate sponsor'],
            ],
            [
                'type' => LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI,
                'amount' => '0.75',
                'reference_type' => 'roi',
                'meta' => ['level' => 1, 'note' => 'Network of ROI L1'],
            ],
            [
                'type' => LedgerEntry::TYPE_AFFILIATE_R10_LEADERSHIP,
                'amount' => '100.00',
                'reference_type' => 'r10_leadership',
                'meta' => ['period' => now()->format('Y-m'), 'rank' => 'R1', 'level' => 1],
            ],
            [
                'type' => LedgerEntry::TYPE_AFFILIATE_TEAM_REWARD,
                'amount' => '2.50',
                'reference_type' => 'leadership_connection',
                'meta' => ['level' => 1, 'note' => 'Team reward on downline activation'],
            ],
            [
                'type' => LedgerEntry::TYPE_AFFILIATE_MTH,
                'amount' => '1.00',
                'reference_type' => 'mth',
                'meta' => ['level' => 1, 'note' => 'Legacy MTH row (catalog grouping)'],
            ],
        ];
    }

    public function handle(LedgerWriter $ledger): int
    {
        \App\Support\IncomeVaultFinancialAuthority::assertVirtualWalletMutationAllowed();

        $memberNumber = (int) $this->argument('member_number');
        $user = User::query()->where('member_number', $memberNumber)->first();

        if (! $user) {
            $this->error('No user with member number '.$memberNumber.' ('.MemberCode::format($memberNumber).').');

            return self::FAILURE;
        }

        $incomeTypes = collect($this->incomeRows())->pluck('type')->all();
        $dryRun = (bool) $this->option('dry-run');

        if ($this->option('fresh') && ! $dryRun) {
            $deleted = LedgerEntry::query()
                ->where('user_id', $user->id)
                ->whereIn('entry_type', $incomeTypes)
                ->delete();

            $this->warn("Removed {$deleted} existing income ledger row(s). Wallet balance is not recalculated — run fresh only on empty/test accounts.");
        }

        $existing = LedgerEntry::query()
            ->where('user_id', $user->id)
            ->whereIn('entry_type', $incomeTypes)
            ->pluck('entry_type')
            ->all();

        $rows = $this->incomeRows();
        $created = 0;
        $skipped = 0;
        $table = [];

        foreach ($rows as $i => $row) {
            if (in_array($row['type'], $existing, true)) {
                $skipped++;
                $table[] = [$row['type'], $row['amount'], 'skip (exists)'];

                continue;
            }

            $table[] = [$row['type'], $row['amount'], $dryRun ? 'would create' : 'created'];

            if ($dryRun) {
                $created++;

                continue;
            }

            DB::transaction(function () use ($ledger, $user, $row, $i) {
                $ledger->record(
                    $user->fresh(),
                    $row['type'],
                    $row['amount'],
                    $row['reference_type'],
                    $i + 1,
                    array_merge($row['meta'], ['seed' => 'income:seed-member-transactions']),
                );
            });

            $created++;
        }

        $this->info(MemberCode::format($memberNumber).' — '.$user->name.' <'.$user->email.'>');
        $this->table(['entry_type', 'amount_usd', 'status'], $table);

        $summary = IncomeCatalog::summarizeForUser($user->id);
        $earned = collect($summary)->filter(fn ($r) => $r['has_earned'])->count();
        $total = array_sum(array_map(fn ($r) => (float) $r['amount_usd'], $summary));

        $this->newLine();
        $this->info("Dashboard income boxes: {$earned}/".count($summary).' with credits · $'.number_format($total, 2).' total');

        if ($dryRun) {
            $this->comment('Dry run — no database changes.');
        } else {
            $user->refresh();
            $wallet = $user->userWallet?->balance_usd ?? $user->balance_usd;
            $this->comment('Wallet balance after seed: $'.number_format((float) $wallet, 2));
        }

        return self::SUCCESS;
    }
}
