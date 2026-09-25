@php
    $explorer = $explorer ?? 'https://bscscan.com';
    $addr = $addresses ?? [];
    $live = $live ?? [];
    $catalog = $catalog ?? [];
    $readiness = $readiness ?? [];
    $labels = [
        'race_token' => 'Race token',
        'race_ico' => 'RaceICO (sale)',
        'ico_contract' => 'ICO Contract (reserve)',
        'ico_admin_wallet' => 'ICO admin wallet',
        'community_engine' => 'Community Engine (staking)',
        'reward_vault' => 'Reward Vault',
        'income_hold' => 'Income hold',
        'reward_price_oracle' => 'Reward price oracle',
        'usdt' => 'USDT',
        'pancake_router' => 'Pancake router',
        'multisig' => 'MultiSig 3-of-5',
        'treasury' => 'Company treasury',
        'development_treasury' => 'Development treasury',
        'marketing_treasury' => 'Marketing treasury',
        'operations_treasury' => 'Operations treasury',
        'fee_admin_wallet' => 'Fee admin wallet',
    ];
@endphp

<div class="rx-bc-card mb-3">
    <p class="mb-1"><strong>{{ __('Network') }}:</strong> {{ $network ?? '—' }} · {{ __('Chain') }} {{ $chain_id ?? '—' }}</p>
    <p class="mb-0 small text-muted">
        {{ ($live['rpc_ok'] ?? false) ? __('Live RPC snapshot — read-only.') : __('RPC snapshot unavailable. Check BSC_RPC_URL.') }}
        · <a href="{{ $explorer }}" target="_blank" rel="noopener">{{ __('Block explorer') }}</a>
        · <a href="{{ route('platform.data.blockchain-overview') }}">{{ __('ICO + stakes overview') }}</a>
        · <a href="{{ route('platform.data.ico-contract') }}">{{ __('Start ICO / deposit / withdraw') }}</a>
    </p>
</div>

@if (!empty($live['ico']))
    <h5 class="mb-2">{{ __('RaceICO live') }}</h5>
    <div class="rx-bc-grid">
        <div class="rx-bc-card">
            <p class="rx-bc-card__label">{{ __('Phase') }}</p>
            <p class="rx-bc-card__value">{{ $live['ico']['phase'] ?? '—' }}</p>
        </div>
        <div class="rx-bc-card">
            <p class="rx-bc-card__label">{{ __('Completed') }}</p>
            <p class="rx-bc-card__value">{{ $live['ico']['completed'] ?? '—' }}</p>
        </div>
        <div class="rx-bc-card">
            <p class="rx-bc-card__label">{{ __('RACE sold') }}</p>
            <p class="rx-bc-card__value">{{ $live['ico']['sold_race'] ?? '—' }}</p>
        </div>
        <div class="rx-bc-card">
            <p class="rx-bc-card__label">{{ __('RACE held') }}</p>
            <p class="rx-bc-card__value">{{ $live['ico']['held_race'] ?? '—' }}</p>
        </div>
        <div class="rx-bc-card">
            <p class="rx-bc-card__label">{{ __('Funds raised') }}</p>
            <p class="rx-bc-card__value">{{ $live['ico']['raised_usdt'] ?? '—' }} USDT</p>
        </div>
    </div>
@endif

@if (!empty($live['engine']))
    <h5 class="mb-2">{{ __('Staking engine live') }}</h5>
    <div class="rx-bc-grid">
        <div class="rx-bc-card">
            <p class="rx-bc-card__label">{{ __('Claim enabled') }}</p>
            <p class="rx-bc-card__value">{{ $live['engine']['claim_enabled'] ?? '—' }}</p>
        </div>
        <div class="rx-bc-card">
            <p class="rx-bc-card__label">{{ __('Locked RACE') }}</p>
            <p class="rx-bc-card__value">{{ $live['engine']['locked_race'] ?? '—' }}</p>
        </div>
        <div class="rx-bc-card">
            <p class="rx-bc-card__label">{{ __('Stakes created') }}</p>
            <p class="rx-bc-card__value">{{ $live['engine']['stakes_created'] ?? '—' }}</p>
        </div>
    </div>
@endif

@if (!empty($live['token']) || !empty($live['oracle']) || !empty($live['reserve']))
    <h5 class="mb-2">{{ __('Token / reserve (read-only)') }}</h5>
    <div class="rx-bc-grid">
        @if (!empty($live['token']['total_supply']))
            <div class="rx-bc-card">
                <p class="rx-bc-card__label">{{ __('Total supply') }}</p>
                <p class="rx-bc-card__value">{{ $live['token']['total_supply'] }}</p>
            </div>
        @endif
        @if (!empty($live['token']['admin_race']))
            <div class="rx-bc-card">
                <p class="rx-bc-card__label">{{ __('Admin RACE') }}</p>
                <p class="rx-bc-card__value">{{ $live['token']['admin_race'] }}</p>
            </div>
        @endif
        @if (!empty($live['reserve']['available_race']))
            <div class="rx-bc-card">
                <p class="rx-bc-card__label">{{ __('Reserve available') }}</p>
                <p class="rx-bc-card__value">{{ $live['reserve']['available_race'] }}</p>
            </div>
        @endif
        @if (!empty($live['oracle']['price_usdt']))
            <div class="rx-bc-card">
                <p class="rx-bc-card__label">{{ __('Oracle price') }}</p>
                <p class="rx-bc-card__value">${{ $live['oracle']['price_usdt'] }}</p>
            </div>
        @endif
    </div>
@endif

@if (!empty($readiness))
    <h5 class="mb-2">{{ __('Live-test readiness') }}</h5>
    <ul class="mb-3 small">
        @foreach ($readiness as $row)
            <li>{{ $row['ok'] ? '✓' : '✗' }} {{ $row['label'] }}</li>
        @endforeach
    </ul>
@endif

<h5 class="mb-2">{{ __('All contracts — role + live status') }}</h5>
<div class="table-responsive rx-admin-table-wrap mb-3">
    <table class="table rx-admin-table table-sm mb-0">
        <thead>
            <tr>
                <th>{{ __('Name') }}</th>
                <th>{{ __('What it does') }}</th>
                <th>{{ __('Live now') }}</th>
                <th>{{ __('Address') }}</th>
                <th></th>
            </tr>
        </thead>
        <tbody>
            @if (!empty($catalog))
                @foreach ($catalog as $row)
                    <tr>
                        <td><strong>{{ $row['label'] }}</strong></td>
                        <td class="small">{{ $row['role'] }}</td>
                        <td class="small">{{ $row['status'] }}</td>
                        <td>
                            @if ($row['address'] !== '')
                                <code class="rx-bc-addr user-select-all">{{ $row['address'] }}</code>
                            @else
                                <span class="text-muted">{{ __('Not set') }}</span>
                            @endif
                        </td>
                        <td>
                            @if ($row['explorer_url'] !== '')
                                <a href="{{ $row['explorer_url'] }}" target="_blank" rel="noopener">{{ __('Watch') }}</a>
                            @endif
                        </td>
                    </tr>
                @endforeach
            @else
                @foreach ($labels as $key => $label)
                    @php $value = trim((string) ($addr[$key] ?? '')); @endphp
                    <tr>
                        <td>{{ $label }}</td>
                        <td colspan="2" class="text-muted">—</td>
                        <td>
                            @if ($value !== '')
                                <code class="rx-bc-addr user-select-all">{{ $value }}</code>
                            @else
                                <span class="text-muted">{{ __('Not set') }}</span>
                            @endif
                        </td>
                        <td>
                            @if ($value !== '')
                                <a href="{{ $explorer }}/address/{{ $value }}" target="_blank" rel="noopener">{{ __('Watch') }}</a>
                            @endif
                        </td>
                    </tr>
                @endforeach
            @endif
        </tbody>
    </table>
</div>

<div class="rx-bc-card mb-3">
    <h5 class="mb-2">{{ __('Recent on-chain events') }}</h5>
    @if (empty($events))
        <p class="mb-0 small text-muted">{{ __('No indexed events yet. Enable the blockchain indexer.') }}</p>
    @else
        <div class="table-responsive rx-admin-table-wrap">
            <table class="table rx-admin-table table-sm mb-0">
                <thead>
                    <tr>
                        <th>{{ __('Event') }}</th>
                        <th>{{ __('Wallet') }}</th>
                        <th>{{ __('Tx') }}</th>
                        <th>{{ __('Time') }}</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($events as $row)
                        <tr>
                            <td>{{ $row['event'] }}</td>
                            <td><code>{{ $row['wallet'] !== '' ? \Illuminate\Support\Str::limit($row['wallet'], 12, '…') : '—' }}</code></td>
                            <td>
                                @if ($row['tx'] !== '')
                                    <a href="{{ $explorer }}/tx/{{ $row['tx'] }}" target="_blank" rel="noopener">
                                        {{ \Illuminate\Support\Str::limit($row['tx'], 12, '…') }}
                                    </a>
                                @else
                                    —
                                @endif
                            </td>
                            <td class="small">{{ $row['time'] }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @endif
</div>
