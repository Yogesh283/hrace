<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

class UserFullDataDepositEntriesLayout extends UserFullDataLedgerEntriesLayout
{
    public $target = 'deposit_entries';

    protected $title = 'Latest deposits';
}
