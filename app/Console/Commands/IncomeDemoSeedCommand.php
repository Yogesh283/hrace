<?php

namespace App\Console\Commands;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Models\UserWallet;
use App\Services\Income\AccountActivationService;
use App\Services\Income\AffiliatePlacementService;
use App\Services\Income\InvestmentRecorder;
use App\Services\Income\LedgerWriter;
use App\Support\IncomeCatalog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class IncomeDemoSeedCommand extends Command
{
    protected $signature = 'income:demo-seed
                            {--fresh : Remove previous income-demo-* users first}
                            {--password=password : Login password for all demo users}';

    protected $description = 'Seed 10 demo users, trigger all income types, print dashboard income summary';

    private const EMAIL_PREFIX = 'income-demo-u';

    private const EMAIL_DOMAIN = '@rynex.test';

    public function handle(
        LedgerWriter $ledger,
        AccountActivationService $activation,
        AffiliatePlacementService $placement,
        InvestmentRecorder $investments,
    ): int {
        if ($this->option('fresh')) {
            $this->purgeDemoUsers();
        }

        $password = (string) $this->option('password');

        $this->info('Creating demo user tree (U00 + U1–U10)…');

        $users = $this->seedUsers($password);
        $this->seedDepositsAndActivations($ledger, $activation, $users);
        $this->seedPlacement($placement, $users);
        $this->seedInvestments($investments, $users, $ledger);
        $this->seedUnwiredIncomeTypes($ledger, $users);
        $this->accrueRoi();

        $this->newLine();
        $this->info('=== Income readiness (ledger types with credits) ===');
        $this->showGlobalTypeCounts();

        $this->newLine();
        $this->info('=== Per-user dashboard income (U01–U10) ===');
        $this->showUserSummaries(array_slice($users, 1, 10));

        $this->newLine();
        $this->comment('Demo emails: '.self::EMAIL_PREFIX.'00'.self::EMAIL_DOMAIN.' … '.self::EMAIL_PREFIX.'10'.self::EMAIL_DOMAIN);

        return self::SUCCESS;
    }

    private function purgeDemoUsers(): void
    {
        $ids = User::query()
            ->where('email', 'like', self::EMAIL_PREFIX.'%'.self::EMAIL_DOMAIN)
            ->pluck('id');

        if ($ids->isEmpty()) {
            return;
        }

        DB::table('ledger_entries')->whereIn('user_id', $ids)->delete();
        DB::table('investments')->whereIn('user_id', $ids)->delete();
        DB::table('milestone_payouts')->whereIn('user_id', $ids)->delete();
        UserWallet::query()->whereIn('user_id', $ids)->delete();
        User::query()->whereIn('id', $ids)->delete();

        $this->warn('Removed '.$ids->count().' previous demo user(s).');
    }

    /**
     * @return list<User>
     */
    private function seedUsers(string $password): array
    {
        $users = [];

        $users[] = $this->createUser('00', null, 'Demo Root U00', $password);

        $users[] = $this->createUser('01', $users[0]->id, 'Demo U01', $password);

        // U02–U05: directs of U01 ($1 each to U01); U06 chain tests $5 grandparent
        for ($n = 2; $n <= 5; $n++) {
            $users[] = $this->createUser(str_pad((string) $n, 2, '0', STR_PAD_LEFT), $users[1]->id, "Demo U{$n}", $password);
        }

        // U06–U10: chain under U05
        $parent = $users[5];
        for ($n = 6; $n <= 10; $n++) {
            $users[] = $this->createUser(str_pad((string) $n, 2, '0', STR_PAD_LEFT), $parent->id, "Demo U{$n}", $password);
            $parent = $users[count($users) - 1];
        }

        return $users;
    }

    private function createUser(string $suffix, ?int $referredBy, string $name, string $password): User
    {
        $email = self::EMAIL_PREFIX.$suffix.self::EMAIL_DOMAIN;

        $existing = User::query()->where('email', $email)->first();
        if ($existing) {
            return $existing;
        }

        return User::query()->create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($password),
            'email_verified_at' => now(),
            'referred_by' => $referredBy,
            'joined_with_code' => $referredBy
                ? User::query()->whereKey($referredBy)->value('referral_code')
                : null,
        ]);
    }

    /**
     * @param  list<User>  $users
     */
    private function seedDepositsAndActivations(LedgerWriter $ledger, AccountActivationService $activation, array $users): void
    {
        foreach ($users as $user) {
            DB::transaction(function () use ($ledger, $activation, $user) {
                $ledger->record(
                    $user,
                    LedgerEntry::TYPE_WALLET_DEPOSIT,
                    '10.00',
                    'deposit',
                    null,
                    ['demo_seed' => true],
                );
                $activation->tryActivateAfterDeposit($user->fresh());
            });
        }

        $this->line('  ✓ Deposits + ID activation for all demo users');
    }

    /**
     * @param  list<User>  $users
     */
    private function seedPlacement(AffiliatePlacementService $placement, array $users): void
    {
        if (! \App\Support\RewardPlan::affiliatePlacementEnabled()) {
            $this->line('  · Affiliate placement skipped (disabled)');

            return;
        }

        // Re-run placement logic for U02–U10 (created without registration hook)
        foreach (array_slice($users, 2) as $user) {
            DB::transaction(fn () => $placement->onNewReferralRegistration($user->fresh()));
        }

        $this->line('  ✓ Affiliate placement ($1 direct / $5 grandparent) applied');
    }

    /**
     * @param  list<User>  $users
     */
    private function seedInvestments(InvestmentRecorder $recorder, array $users, LedgerWriter $ledger): void
    {
        $investors = [
            $users[1]->id => '100.00', // U01
            $users[2]->id => '100.00', // U02
            $users[3]->id => '100.00', // U03
            $users[9]->id => '50.00',  // U10 — triggers uplines affiliate + R10
        ];

        foreach ($investors as $userId => $amount) {
            $user = User::query()->findOrFail($userId);
            if (config('income.deduct_investment_from_balance', false)) {
                DB::transaction(function () use ($ledger, $user, $amount) {
                    $ledger->record(
                        $user,
                        LedgerEntry::TYPE_WALLET_DEPOSIT,
                        bcadd($amount, '50', 2),
                        'deposit',
                        null,
                        ['demo_seed' => true, 'note' => 'Top-up for investment test'],
                    );
                });
            }
            $recorder->record($user->fresh(), $amount, 90);
        }

        Investment::query()
            ->whereIn('user_id', collect($users)->pluck('id'))
            ->where('status', Investment::STATUS_ACTIVE)
            ->update(['next_roi_at' => now()->subDay()]);

        $this->line('  ✓ Investments recorded (affiliate referral + R10 volume)');
    }

    /**
     * @param  list<User>  $users
     */
    private function seedUnwiredIncomeTypes(LedgerWriter $ledger, array $users): void
    {
        $recipient = $users[0]; // U00

        DB::transaction(function () use ($ledger, $recipient) {
            $ledger->record($recipient, LedgerEntry::TYPE_REFERRAL_DIRECT, '5.00', 'demo', 1, ['demo_seed' => true, 'note' => 'Direct referral bonus (simulated)']);
            $ledger->record($recipient, LedgerEntry::TYPE_AFFILIATE_SPONSOR, '2.50', 'demo', 2, ['demo_seed' => true, 'note' => 'Sponsor bonus (simulated)']);
            $ledger->record($recipient, LedgerEntry::TYPE_AFFILIATE_MTH, '7.25', 'demo', 3, ['demo_seed' => true, 'note' => 'Team MTH (simulated)']);
        });

        $this->line('  ✓ Simulated credits for Direct / Sponsor / MTH (not auto-paid in production yet)');
    }

    private function accrueRoi(): void
    {
        Artisan::call('income:pay-roi');
        $this->line('  ✓ '.trim(Artisan::output()));

        $period = now()->format('Y-m');
        Artisan::call('income:pay-r10-leadership', ['--period' => $period]);
        $this->line('  ✓ '.trim(Artisan::output()));
    }

    private function showGlobalTypeCounts(): void
    {
        $demoIds = User::query()
            ->where('email', 'like', self::EMAIL_PREFIX.'%'.self::EMAIL_DOMAIN)
            ->pluck('id');

        $rows = LedgerEntry::query()
            ->whereIn('user_id', $demoIds)
            ->where('amount_usd', '>', 0)
            ->selectRaw('entry_type, COUNT(*) as cnt, SUM(amount_usd) as total')
            ->groupBy('entry_type')
            ->orderBy('entry_type')
            ->get();

        $simulatedOnly = [
            LedgerEntry::TYPE_REFERRAL_DIRECT,
            LedgerEntry::TYPE_AFFILIATE_SPONSOR,
            LedgerEntry::TYPE_AFFILIATE_MTH,
        ];

        $table = [];
        foreach (IncomeCatalog::items() as $item) {
            $sum = 0.0;
            $cnt = 0;
            foreach ($item['types'] as $type) {
                $row = $rows->firstWhere('entry_type', $type);
                if ($row) {
                    $sum += (float) $row->total;
                    $cnt += (int) $row->cnt;
                }
            }
            $auto = ! array_intersect($item['types'], $simulatedOnly);
            $table[] = [
                $item['label'],
                $cnt > 0 ? 'YES' : 'NO',
                (string) $cnt,
                number_format($sum, 2),
                $auto ? 'Automatic' : ($cnt > 0 ? 'Simulated in demo' : 'Not wired yet'),
            ];
        }

        $this->table(
            ['Dashboard box', 'Credited?', 'Entries', 'Total USD (all demo users)', 'Source'],
            $table,
        );
    }

    /**
     * @param  list<User>  $users
     */
    private function showUserSummaries(array $users): void
    {
        foreach ($users as $user) {
            $plan = IncomeCatalog::summarizeForUser($user->id);
            $total = array_sum(array_map(fn ($r) => (float) $r['amount_usd'], $plan));
            $earned = collect($plan)->filter(fn ($r) => $r['has_earned'])->count();

            $this->newLine();
            $this->line("<fg=cyan>{$user->name}</> ({$user->email}) — total income: $".number_format($total, 2)." ({$earned}/".count($plan).' types)');

            $rows = [];
            foreach ($plan as $item) {
                $rows[] = [
                    $item['label'],
                    $item['has_earned'] ? '$'.$item['amount_usd'] : '$0.00',
                    $item['count'],
                ];
            }

            $this->table(['Income', 'Amount', 'Payments'], $rows);
        }
    }
}
