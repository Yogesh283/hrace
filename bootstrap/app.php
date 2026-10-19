<?php

use App\Console\Commands\DecentralizationCheckCommand;
use App\Console\Commands\IncomeMigrationReportCommand;
use App\Console\Commands\IncomeReconcileOnchainCommand;
use App\Console\Commands\IndexIncomeVaultEventsCommand;
use App\Console\Commands\IncomeRepairIndexCommand;
use App\Console\Commands\IncomeReconcilePendingCompoundsCommand;
use App\Console\Commands\IncomeReconcileWalletsCommand;
use App\Console\Commands\IncomeDiagnoseNetworkRoiCommand;
use App\Console\Commands\IncomeDiagnoseRoiCommand;
use App\Console\Commands\IncomePayCommunityLeadershipCommand;
use App\Console\Commands\IncomePayCommunityLeadershipRank11MonthlyCommand;
use App\Console\Commands\IncomePayRoiCommand;
use App\Console\Commands\IncomePurgeCronDayCommand;
use App\Console\Commands\IncomeReleaseStakeEmisCommand;
use App\Console\Commands\IncomeRolloverHoldingsCommand;
use App\Console\Commands\IndexBlockchainEventsCommand;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\RejectCentralizedRewardWrites;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;

return Application::configure(basePath: dirname(__DIR__))
    ->withCommands([
        IncomePayRoiCommand::class,
        IncomePayCommunityLeadershipCommand::class,
        IncomePayCommunityLeadershipRank11MonthlyCommand::class,
        IncomeReleaseStakeEmisCommand::class,
        IncomeRolloverHoldingsCommand::class,
        IncomeDiagnoseRoiCommand::class,
        IncomeDiagnoseNetworkRoiCommand::class,
        IncomePurgeCronDayCommand::class,
        IndexBlockchainEventsCommand::class,
        IncomeReconcileWalletsCommand::class,
        IncomeReconcilePendingCompoundsCommand::class,
        IncomeReconcileOnchainCommand::class,
        IncomeMigrationReportCommand::class,
        IndexIncomeVaultEventsCommand::class,
        IncomeRepairIndexCommand::class,
        DecentralizationCheckCommand::class,
    ])
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            RejectCentralizedRewardWrites::class,
        ]);

        $middleware->alias([
            'referral.register' => \App\Http\Middleware\RequireReferralForRegister::class,
        ]);

        // TokenPocket / in-app WebView often omit CSRF cookies on fetch.
        // Wallet login is still protected by signed nonce + throttle.
        $middleware->validateCsrfTokens(except: [
            'wallet-auth/nonce',
            'wallet-auth/login',
            'wallet-auth/register',
        ]);
    })
    ->withSchedule(function (Schedule $schedule): void {
        if (config('blockchain.rewards_engine') !== 'blockchain_only') {
            $schedule->command('income:pay-roi')->dailyAt('02:00');
            $schedule->command('income:pay-community-leadership')->dailyAt('03:00');
            $schedule->command('income:pay-community-leadership-rank11-monthly')->monthlyOn(1, '04:00');
            $schedule->command('income:release-stake-emis')->dailyAt('02:30');
            $schedule->command('income:rollover-holdings')->hourly();
        }

        if (config('blockchain.indexer.enabled')) {
            $schedule->command('blockchain:index-events')->everyMinute()->withoutOverlapping(4);
            $schedule->command('blockchain:backfill-ico-purchases --blocks=4000')->everyMinute()->withoutOverlapping(3);
        }
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
