<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\SiteSetting;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Services\Blockchain\BscJsonRpcClient;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\Fields\Input;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;
use Orchid\Support\Facades\Toast;

class IcoContractSettingsScreen extends Screen
{
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        $icoContract = SiteSetting::icoContractAddress();
        $raceIco = SiteSetting::raceIcoContractAddress();
        $adminWallet = SiteSetting::icoAdminWallet();
        $raceToken = (string) config('blockchain.contracts.race_token', '');
        $chainId = (int) config('blockchain.chain_id', 56);

        $status = $this->onChainStatus($raceToken, $icoContract, $adminWallet, $raceIco);

        $multisig = (string) config('blockchain.contracts.multisig', '');
        if ($multisig === '') {
            $multisig = '0x81BffBF2C2a258E662e9df0a0f6e34150b33F3df';
        }

        return [
            'ico_contract' => $icoContract,
            'race_ico_contract' => $raceIco,
            'ico_admin_wallet' => $adminWallet,
            'income_hold' => SiteSetting::incomeHoldAddress(),
            'race_token' => $raceToken,
            'chain_id' => $chainId,
            'multisig_contract' => $multisig,
            'multisig_signers' => [
                '0xCc2B87f8E8AABc295e1119E186c3021bA6F32339',
                '0x8B2Ac41931d4869E7a53144BaF5C1fa052E8Df24',
                '0xDE64cA155dEb48B459360FB8E3c4e7167Bfeb150',
                '0xE9db9ea0fC494fB1Fc743DAfD5a0a436cA19EECA',
                '0x71DDFC006c21756DF7b07fB4357f6F6B33CE11f9',
            ],
            'allocation_race' => '600000',
            'admin_race' => $status['admin_race'],
            'contract_race' => $status['contract_race'],
            'on_chain_admin' => $status['on_chain_admin'],
            'rpc_ok' => $status['rpc_ok'],
            'current_phase' => $status['current_phase'],
            'ico_completed' => $status['ico_completed'],
            'deposit_amount_wei' => '600000000000000000000000',
        ];
    }

    public function name(): ?string
    {
        return __('ICO Contract');
    }

    public function description(): ?string
    {
        return __('Total 1,000,000 RACE go to the admin wallet: deposit 600,000 into ICO Contract, keep 400,000 for LP. Admin can withdraw unsold ICO RACE. Every ICO buy sends USDT to this admin wallet.');
    }

    /**
     * @return Action[]
     */
    public function commandBar(): iterable
    {
        return [
            Link::make(__('Contracts watch'))
                ->icon('bs.eye')
                ->route('platform.data.contracts-watch'),
            Button::make(__('Save setup'))
                ->icon('bs.check-circle')
                ->method('save'),
        ];
    }

    public function layout(): iterable
    {
        return [
            Layout::rows([
                Input::make('ico_contract')
                    ->title(__('ICO Contract address'))
                    ->placeholder('0x…')
                    ->maxlength(42)
                    ->help(__('The ICO Contract that holds the 600,000 RACE reserve.')),
                Input::make('race_ico_contract')
                    ->title(__('RaceICO sale contract'))
                    ->placeholder('0x…')
                    ->maxlength(42)
                    ->help(__('Buy / hold / createStake contract. USDT from every buy goes to the admin wallet set on this contract.')),
                Input::make('ico_admin_wallet')
                    ->title(__('Admin wallet'))
                    ->placeholder('0x…')
                    ->maxlength(42)
                    ->help(__('Receives the 600,000 RACE and all ICO USDT. This wallet deposits RACE into ICO Contract. Not a panel role.')),
                Input::make('income_hold')
                    ->title(__('Income hold contract'))
                    ->placeholder('0x…')
                    ->maxlength(42)
                    ->help(__('Per-user on-chain income wallet. Daily claim / level / other RACE income is held here. Withdraw fee: $1 if value is $1–$99, 1% if $100+.')),
            ]),
            Layout::view('orchid.ico-contract-setup'),
        ];
    }

    public function save(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'ico_contract' => ['nullable', 'string', 'max:42', 'regex:/^(0x[a-fA-F0-9]{40})?$/'],
            'race_ico_contract' => ['nullable', 'string', 'max:42', 'regex:/^(0x[a-fA-F0-9]{40})?$/'],
            'ico_admin_wallet' => ['nullable', 'string', 'max:42', 'regex:/^(0x[a-fA-F0-9]{40})?$/'],
            'income_hold' => ['nullable', 'string', 'max:42', 'regex:/^(0x[a-fA-F0-9]{40})?$/'],
        ]);

        SiteSetting::set(SiteSetting::KEY_ICO_CONTRACT, $data['ico_contract'] ?? '');
        SiteSetting::set(SiteSetting::KEY_RACE_ICO_CONTRACT, $data['race_ico_contract'] ?? '');
        SiteSetting::set(SiteSetting::KEY_ICO_ADMIN_WALLET, $data['ico_admin_wallet'] ?? '');
        SiteSetting::set(SiteSetting::KEY_INCOME_HOLD, $data['income_hold'] ?? '');

        Toast::info(__('ICO Contract setup saved. On-chain admin wallet on RaceICO / ICO Contract must match this address so buy USDT and deposits work.'));

        return redirect()->route('platform.data.ico-contract');
    }

    /**
     * @return array{admin_race: string, contract_race: string, on_chain_admin: string, rpc_ok: bool, current_phase: string, ico_completed: string}
     */
    private function onChainStatus(string $raceToken, string $icoContract, string $adminWallet, string $raceIco = ''): array
    {
        $empty = [
            'admin_race' => '—',
            'contract_race' => '—',
            'on_chain_admin' => '—',
            'rpc_ok' => false,
            'current_phase' => '—',
            'ico_completed' => '—',
        ];

        if ($raceToken === '') {
            return $empty;
        }

        try {
            $rpc = BscJsonRpcClient::fromConfig();
            $adminRace = $adminWallet !== ''
                ? $this->formatRace($this->ethCallUint($rpc, $raceToken, $this->balanceOfData($adminWallet)))
                : '—';
            $contractRace = $icoContract !== ''
                ? $this->formatRace($this->ethCallUint($rpc, $raceToken, $this->balanceOfData($icoContract)))
                : '—';
            $onChainAdmin = $icoContract !== ''
                ? $this->ethCallAddress($rpc, $icoContract, '0xf851a440')
                : '—';

            $phase = '—';
            $completed = '—';
            if ($raceIco !== '') {
                $phaseRaw = $this->ethCallUint($rpc, $raceIco, '0xa3a40ea5');
                $phase = $phaseRaw === '0' ? '0 (not started)' : $phaseRaw;
                $doneHex = $rpc->call('eth_call', [['to' => $raceIco, 'data' => '0x204e8b17'], 'latest']);
                $completed = $this->hexToDec(is_string($doneHex) ? $doneHex : '0x0') === '0' ? 'no' : 'yes';
            }

            return [
                'admin_race' => $adminRace,
                'contract_race' => $contractRace,
                'on_chain_admin' => $onChainAdmin !== '' ? $onChainAdmin : '—',
                'rpc_ok' => true,
                'current_phase' => $phase,
                'ico_completed' => $completed,
            ];
        } catch (\Throwable) {
            return $empty;
        }
    }

    private function balanceOfData(string $account): string
    {
        return '0x70a08231'.str_pad(strtolower(substr($account, 2)), 64, '0', STR_PAD_LEFT);
    }

    private function ethCallUint(BscJsonRpcClient $rpc, string $to, string $data): string
    {
        $hex = $rpc->call('eth_call', [['to' => $to, 'data' => $data], 'latest']);
        if (! is_string($hex) || $hex === '' || $hex === '0x') {
            return '0';
        }

        return $this->hexToDec($hex);
    }

    private function ethCallAddress(BscJsonRpcClient $rpc, string $to, string $selector): string
    {
        $hex = $rpc->call('eth_call', [['to' => $to, 'data' => $selector], 'latest']);
        if (! is_string($hex) || strlen($hex) < 42) {
            return '';
        }

        return '0x'.substr($hex, -40);
    }

    private function hexToDec(string $hex): string
    {
        $hex = strtolower(preg_replace('/^0x/', '', $hex) ?? '');
        if ($hex === '') {
            return '0';
        }
        $dec = '0';
        foreach (str_split($hex) as $ch) {
            $dec = bcmul($dec, '16', 0);
            $dec = bcadd($dec, (string) hexdec($ch), 0);
        }

        return $dec;
    }

    private function formatRace(string $wei): string
    {
        if ($wei === '0') {
            return '0';
        }

        return rtrim(rtrim(bcdiv($wei, '1000000000000000000', 4), '0'), '.') ?: '0';
    }
}
