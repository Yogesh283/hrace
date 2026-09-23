<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Orchid\Concerns\RequiresPlatformDataPermission;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;

/**
 * Read-only Multisig fund addresses (Company / Dev / Marketing / Ops).
 * Does NOT execute withdrawals — outflows require on-chain RaceMultiSig 3-of-5.
 */
class MultisigFundsScreen extends Screen
{
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        $c = config('blockchain.contracts', []);

        return [
            'funds' => [
                [
                    'label' => 'Company Treasury',
                    'purpose' => 'Fixed maturity 10% company fee + company reserves',
                    'address' => (string) ($c['treasury'] ?? ''),
                    'tokens' => 'RACE (contract supports RACE only)',
                ],
                [
                    'label' => 'Development Treasury',
                    'purpose' => 'Developer salaries, infra, software',
                    'address' => (string) ($c['development_treasury'] ?? ''),
                    'tokens' => 'RACE + USDT BEP20',
                ],
                [
                    'label' => 'Marketing Treasury',
                    'purpose' => 'Ads, campaigns, partnerships, promotions',
                    'address' => (string) ($c['marketing_treasury'] ?? ''),
                    'tokens' => 'RACE + USDT BEP20',
                ],
                [
                    'label' => 'Operations Treasury',
                    'purpose' => 'Legal, accounting, emergency / misc ops',
                    'address' => (string) ($c['operations_treasury'] ?? ''),
                    'tokens' => 'RACE + USDT BEP20',
                ],
            ],
            'multisig' => (string) ($c['multisig'] ?? ''),
            'threshold' => '3-of-5',
            'note' => 'Withdrawals are NOT available from this admin panel. Propose/confirm/execute only via RaceMultiSig signers. Laravel stores addresses for display/indexing only — no fake balances.',
        ];
    }

    public function name(): ?string
    {
        return __('Multisig funds');
    }

    public function description(): ?string
    {
        return __('Read-only on-chain fund addresses. Outflows require RaceMultiSig (3-of-5).');
    }

    public function commandBar(): iterable
    {
        return [];
    }

    public function layout(): iterable
    {
        return [
            Layout::view('orchid.multisig-funds'),
        ];
    }
}
