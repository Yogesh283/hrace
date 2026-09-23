<?php

declare(strict_types=1);

namespace App\Orchid\Layouts;

use Orchid\Screen\Layouts\Table;

/**
 * VIP-styled data tables for all admin list screens.
 */
abstract class AdminVipTable extends Table
{
    protected $template = 'platform.layouts.table';

    protected function striped(): bool
    {
        return true;
    }

    protected function hoverable(): bool
    {
        return true;
    }

    protected function bordered(): bool
    {
        return false;
    }
}
