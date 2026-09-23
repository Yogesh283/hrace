<?php

namespace App\Services\Income;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Support\BlockchainMode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class IncomeClaimService
{
    public function __construct(
        protected LedgerWriter $ledger,
        protected IncomeAccrualService $accrual,
    ) {}

    public function claimIntervalHours(): int
    {
        return max(1, (int) config('income.claim.interval_hours', 24));
    }

    public function nextClaimAt(User $user): ?Carbon
    {
        if ($user->last_income_claim_at === null) {
            return null;
        }

        return $user->last_income_claim_at->copy()->addHours($this->claimIntervalHours());
    }

    /**
     * Move all accrued staking rewards into virtual USDT wallet. No Admin Fee.
     *
     * @return array{claimed_usd: string, virtual_balance_usd: string}
     */
    public function claimAccruedIncome(User $user): array
    {
        BlockchainMode::assertReadOnlyRewards();

        if (config('participation_contract.on_chain.enabled') || BlockchainMode::blockchainOnly()) {
            throw ValidationException::withMessages([
                'claim' => __('Income claim is for platform staking. On-chain rewards use wallet claim on the staking page.'),
            ]);
        }

        return DB::transaction(function () use ($user) {
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

            if ($locked->is_blocked) {
                throw ValidationException::withMessages([
                    'claim' => __('Account is blocked.'),
                ]);
            }

            $next = $this->nextClaimAt($locked);
            if ($next !== null && now()->lt($next)) {
                throw ValidationException::withMessages([
                    'claim' => __('Next claim available after :when.', [
                        'when' => $next->timezone(config('app.timezone'))->format('d M Y, h:i A'),
                    ]),
                ]);
            }

            $stakes = Investment::query()
                ->where('user_id', $locked->id)
                ->whereIn('status', [
                    Investment::STATUS_ACTIVE,
                    Investment::STATUS_COMPLETED,
                    Investment::STATUS_UNLOCKING,
                    Investment::STATUS_UNLOCKED,
                ])
                ->where('accrued_reward_usd', '>', 0)
                ->lockForUpdate()
                ->orderBy('id')
                ->get();

            if ($stakes->isEmpty()) {
                throw ValidationException::withMessages([
                    'claim' => __('Nothing to claim. Rewards accrue on the platform schedule.'),
                ]);
            }

            $totalClaim = '0.0000';
            foreach ($stakes as $stake) {
                $chunk = number_format((float) $stake->accrued_reward_usd, 4, '.', '');
                if (bccomp($chunk, '0', 4) <= 0) {
                    continue;
                }

                $this->ledger->record(
                    $locked,
                    LedgerEntry::TYPE_INCOME_CLAIM,
                    $chunk,
                    'investment',
                    $stake->id,
                    [
                        'source' => 'platform_income_claim',
                        'admin_fee_usd' => '0.00',
                        'note' => 'Accrued ROI claimed to virtual income — no Admin Fee',
                    ],
                );

                $stake->forceFill(['accrued_reward_usd' => '0.0000'])->save();
                $totalClaim = bcadd($totalClaim, $chunk, 4);
            }

            if (bccomp($totalClaim, '0', 4) <= 0) {
                throw ValidationException::withMessages([
                    'claim' => __('Nothing to claim.'),
                ]);
            }

            $locked->forceFill(['last_income_claim_at' => now()])->save();

            $wallet = app(WalletBalanceService::class)->virtualIncomeBalance($locked);

            return [
                'claimed_usd' => number_format((float) $totalClaim, 4, '.', ''),
                'virtual_balance_usd' => $wallet,
            ];
        });
    }
}
