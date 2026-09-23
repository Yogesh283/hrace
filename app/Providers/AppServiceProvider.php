<?php

namespace App\Providers;

use App\Models\User;
use App\Support\AdminAsset;
use Illuminate\Support\Facades\View;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Orchid\Platform\Dashboard;
use Orchid\Platform\Models\Role;
use Orchid\Platform\Models\User as OrchidUser;
use Orchid\Support\Facades\Dashboard as DashboardFacade;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(
            \App\Services\Blockchain\CompoundTransactionVerifier::class,
            static fn () => \App\Services\Blockchain\CompoundTransactionVerifier::make(),
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if (! $this->app->runningUnitTests()) {
            \App\Support\BlockchainConfigValidator::assertOrThrow();
        }

        DashboardFacade::useModel(OrchidUser::class, User::class);
        DashboardFacade::useModel(Role::class, Role::class);

        $this->registerAdminStylesheets();

        Vite::prefetch(concurrency: 3);
    }

    private function registerAdminStylesheets(): void
    {
        $this->app->booted(function (): void {
            $url = AdminAsset::vipCss();
            $this->app->make(Dashboard::class)->registerResource('stylesheets', $url);
        });

        View::composer('platform::app', function (): void {
            view()->startPush(
                'stylesheets',
                '<link rel="stylesheet" href="'.e(AdminAsset::vipCss()).'" data-turbo-track="reload">'."\n",
            );
        });
    }
}
