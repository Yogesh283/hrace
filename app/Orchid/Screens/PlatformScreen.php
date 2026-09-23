<?php

declare(strict_types=1);

namespace App\Orchid\Screens;

use App\Services\Admin\AdminDashboardStats;
use Orchid\Screen\Action;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;

class PlatformScreen extends Screen
{
    public function query(AdminDashboardStats $stats): iterable
    {
        return [
            'dashboard' => $stats->summarize(),
        ];
    }

    public function name(): ?string
    {
        return __('Dashboard');
    }

    public function description(): ?string
    {
        return __('Overview with today & total metrics for all platform activity.');
    }

    /**
     * @return Action[]
     */
    public function commandBar(): iterable
    {
        return [];
    }

    public function layout(): iterable
    {
        return [
            Layout::view('platform::partials.update-assets'),
            Layout::view('platform.dashboard-stats'),
        ];
    }
}
