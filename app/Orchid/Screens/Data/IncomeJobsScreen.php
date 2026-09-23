<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Support\BlockchainMode;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Artisan;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Fields\Label;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;
use Orchid\Support\Facades\Toast;

class IncomeJobsScreen extends Screen
{
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        $blockchainOnly = BlockchainMode::blockchainOnly();
        $today = Carbon::now()->format('Y-m-d');

        return [
            'engine_mode' => $blockchainOnly
                ? __('Blockchain-only — Laravel income jobs are skipped by scheduler. Manual runs still execute if you confirm.')
                : __('Hybrid / Laravel rewards engine — scheduler is active.'),
            'once_per_day_note' => __('Normal cron / normal buttons pay once per calendar day (date + time). Same-day duplicates are skipped.'),
            'roi_schedule' => __('Daily at 02:00'),
            'emi_schedule' => __('Daily at 02:30'),
            'leadership_schedule' => __('Daily at 03:00'),
            'rank11_schedule' => __('Monthly on day 1 at 04:00'),
            'rollover_schedule' => __('Hourly'),
            'testing_note' => __('TESTING ONLY: Force buttons can release income again today. Delete buttons remove today’s cron income so you can re-run. Do not use on live member balances without a backup.'),
            'today_label' => $today,
        ];
    }

    public function name(): ?string
    {
        return __('Income release (manual)');
    }

    public function description(): ?string
    {
        return __('Cron pays once per day. Use normal buttons for a normal cycle. Use Testing buttons to delete / re-run the same day.');
    }

    /**
     * @return Action[]
     */
    public function commandBar(): iterable
    {
        return [
            Button::make(__('Run daily ROI'))
                ->icon('bs.play-circle')
                ->confirm(__('Run income:pay-roi now? (only stakes that are due)'))
                ->method('runRoi'),

            Button::make(__('Release stake EMIs'))
                ->icon('bs.cash-stack')
                ->confirm(__('Run income:release-stake-emis now?'))
                ->method('runStakeEmis'),

            Button::make(__('Community Leadership'))
                ->icon('bs.award')
                ->confirm(__('Run income:pay-community-leadership now? (skips members already paid today)'))
                ->method('runCommunityLeadership'),

            Button::make(__('Rank 11 monthly royalty'))
                ->icon('bs.trophy')
                ->confirm(__('Run income:pay-community-leadership-rank11-monthly for the previous month?'))
                ->method('runRank11Monthly'),

            Button::make(__('Holding rollover'))
                ->icon('bs.arrow-repeat')
                ->confirm(__('Run income:rollover-holdings now?'))
                ->method('runRollover'),

            Button::make(__('Force ROI again (testing)'))
                ->icon('bs.lightning')
                ->class('btn btn-warning')
                ->confirm(__('TESTING: Mark all active stakes due and pay ROI again today?'))
                ->method('forceRoi'),

            Button::make(__('Force Leadership again (testing)'))
                ->icon('bs.lightning-fill')
                ->class('btn btn-warning')
                ->confirm(__('TESTING: Delete today’s Community Leadership income, then pay again?'))
                ->method('forceCommunityLeadership'),

            Button::make(__('Delete today Leadership (testing)'))
                ->icon('bs.trash')
                ->class('btn btn-danger')
                ->confirm(__('TESTING: Delete today’s Community Leadership ledger rows and recalculate wallets?'))
                ->method('purgeTodayLeadership'),

            Button::make(__('Delete today ROI (testing)'))
                ->icon('bs.trash-fill')
                ->class('btn btn-danger')
                ->confirm(__('TESTING: Delete today’s ROI + ROI Sharing ledger rows, roll back stake counters, recalculate wallets?'))
                ->method('purgeTodayRoi'),
        ];
    }

    public function layout(): iterable
    {
        $q = $this->query();

        return [
            Layout::rows([
                Label::make('engine_mode')
                    ->title(__('Rewards engine'))
                    ->value((string) ($q['engine_mode'] ?? '')),
                Label::make('once_per_day_note')
                    ->title(__('Once per day'))
                    ->value((string) ($q['once_per_day_note'] ?? '')),
                Label::make('roi_schedule')
                    ->title(__('Daily ROI (income:pay-roi)'))
                    ->value((string) ($q['roi_schedule'] ?? '')),
                Label::make('emi_schedule')
                    ->title(__('Stake unlock EMIs (income:release-stake-emis)'))
                    ->value((string) ($q['emi_schedule'] ?? '')),
                Label::make('leadership_schedule')
                    ->title(__('Community Leadership (income:pay-community-leadership)'))
                    ->value((string) ($q['leadership_schedule'] ?? '')),
                Label::make('rank11_schedule')
                    ->title(__('Rank 11 royalty (income:pay-community-leadership-rank11-monthly)'))
                    ->value((string) ($q['rank11_schedule'] ?? '')),
                Label::make('rollover_schedule')
                    ->title(__('Holding rollover (income:rollover-holdings)'))
                    ->value((string) ($q['rollover_schedule'] ?? '')),
            ])->title(__('Cron schedules (production)')),

            Layout::rows([
                Label::make('today_label')
                    ->title(__('Today (server date)'))
                    ->value((string) ($q['today_label'] ?? '')),
                Label::make('testing_note')
                    ->title(__('Testing tools'))
                    ->value((string) ($q['testing_note'] ?? '')),
            ])->title(__('Admin testing — run many times today')),
        ];
    }

    public function runRoi(): RedirectResponse
    {
        return $this->runCommand('income:pay-roi', __('Daily ROI job completed.'));
    }

    public function forceRoi(): RedirectResponse
    {
        return $this->runCommand('income:pay-roi', __('Force ROI (testing) completed.'), ['--force-due' => true]);
    }

    public function runStakeEmis(): RedirectResponse
    {
        return $this->runCommand('income:release-stake-emis', __('Stake EMI release completed.'));
    }

    public function runCommunityLeadership(): RedirectResponse
    {
        return $this->runCommand('income:pay-community-leadership', __('Community Leadership job completed.'));
    }

    public function forceCommunityLeadership(): RedirectResponse
    {
        return $this->runCommand(
            'income:pay-community-leadership',
            __('Force Community Leadership (testing) completed.'),
            ['--force' => true],
        );
    }

    public function runRank11Monthly(): RedirectResponse
    {
        return $this->runCommand(
            'income:pay-community-leadership-rank11-monthly',
            __('Rank 11 monthly royalty job completed.'),
        );
    }

    public function runRollover(): RedirectResponse
    {
        return $this->runCommand('income:rollover-holdings', __('Holding rollover job completed.'));
    }

    public function purgeTodayLeadership(): RedirectResponse
    {
        $today = Carbon::now()->format('Y-m-d');

        return $this->runCommand(
            'income:purge-cron-day',
            __('Deleted today’s Community Leadership income.'),
            [
                '--date' => $today,
                '--types' => 'leadership',
                '--yes' => true,
            ],
        );
    }

    public function purgeTodayRoi(): RedirectResponse
    {
        $today = Carbon::now()->format('Y-m-d');

        return $this->runCommand(
            'income:purge-cron-day',
            __('Deleted today’s ROI income.'),
            [
                '--date' => $today,
                '--types' => 'roi',
                '--yes' => true,
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $parameters
     */
    private function runCommand(string $command, string $successPrefix, array $parameters = []): RedirectResponse
    {
        try {
            Artisan::call($command, $parameters);
            $output = trim((string) Artisan::output());
            Toast::info($successPrefix.($output !== '' ? ' '.$output : ''));
        } catch (\Throwable $e) {
            report($e);
            Toast::error(__('Job failed: :message', ['message' => $e->getMessage()]));
        }

        return redirect()->route('platform.data.income-jobs');
    }
}
