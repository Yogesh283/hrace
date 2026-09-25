@php
    $ico = $ico_live ?? [];
    $engine = $engine_live ?? [];
    $token = $token_live ?? [];
    $indexed = $indexed ?? [];
    $addr = $addresses ?? [];
    $explorer = $explorer ?? 'https://bscscan.com';
    $rpcOk = (bool) ($rpc_ok ?? false);
@endphp

<div class="rx-bc-card mb-3">
    <p class="mb-1"><strong>{{ __('Network') }}:</strong> {{ $network ?? '—' }} · {{ __('Chain') }} {{ $chain_id ?? '—' }}</p>
    <p class="mb-0 small text-muted">
        {{ $rpcOk ? __('Live RPC connected.') : __('RPC unavailable — showing indexed DB where possible.') }}
        · <a href="{{ $explorer }}" target="_blank" rel="noopener">{{ __('Explorer') }}</a>
    </p>
</div>

<h5 class="mb-2">{{ __('ICO (on-chain)') }}</h5>
<div class="rx-bc-grid">
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('Phase') }}</p>
        <p class="rx-bc-card__value">{{ $ico['phase'] ?? '—' }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('ICO completed') }}</p>
        <p class="rx-bc-card__value">{{ $ico['completed'] ?? '—' }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('RACE sold') }}</p>
        <p class="rx-bc-card__value">{{ $ico['sold_race'] ?? '—' }}</p>
        <p class="rx-bc-card__hint">{{ __('Max allocation 600,000') }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('RACE remaining (ICO)') }}</p>
        <p class="rx-bc-card__value">
            @php
                $soldRaw = preg_replace('/[^0-9.]/', '', (string) ($ico['sold_race'] ?? ''));
                $soldNum = is_numeric($soldRaw) ? (float) $soldRaw : null;
                echo $soldNum === null ? '—' : number_format(max(0, 600000 - $soldNum), 4);
            @endphp
        </p>
        <p class="rx-bc-card__hint">{{ __('600,000 − sold') }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('RACE held (ICO)') }}</p>
        <p class="rx-bc-card__value">{{ $ico['held_race'] ?? '—' }}</p>
        <p class="rx-bc-card__hint">{{ __('Unstaked holds') }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('Funds raised') }}</p>
        <p class="rx-bc-card__value">{{ $ico['raised_usdt'] ?? '—' }} USDT</p>
        <p class="rx-bc-card__hint">{{ __('On-chain totalRaisedUsdt') }}</p>
    </div>
</div>

<h5 class="mb-2 mt-3">{{ __('ICO (indexed purchases)') }}</h5>
<div class="rx-bc-grid">
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('Purchase rows') }}</p>
        <p class="rx-bc-card__value">{{ number_format((int) ($indexed['ico_buys'] ?? 0)) }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('USDT paid (index)') }}</p>
        <p class="rx-bc-card__value">{{ number_format((float) ($indexed['ico_usdt'] ?? 0), 2) }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('RACE bought (index)') }}</p>
        <p class="rx-bc-card__value">{{ number_format((float) ($indexed['ico_race'] ?? 0), 4) }}</p>
    </div>
</div>

<h5 class="mb-2 mt-3">{{ __('Stakes (engine + index)') }}</h5>
<div class="rx-bc-grid">
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('Stakes created (live)') }}</p>
        <p class="rx-bc-card__value">{{ $engine['stakes_created'] ?? '—' }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('Locked RACE (live)') }}</p>
        <p class="rx-bc-card__value">{{ $engine['locked_race'] ?? '—' }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('Users with stake') }}</p>
        <p class="rx-bc-card__value">{{ number_format((int) ($indexed['stake_users'] ?? 0)) }}</p>
        <p class="rx-bc-card__hint">{{ __('From indexed DB') }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('Active stake rows') }}</p>
        <p class="rx-bc-card__value">{{ number_format((int) ($indexed['stake_rows'] ?? 0)) }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('Stake USDT total') }}</p>
        <p class="rx-bc-card__value">{{ number_format((float) ($indexed['stake_usdt'] ?? 0), 2) }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('Stake RACE total') }}</p>
        <p class="rx-bc-card__value">{{ number_format((float) ($indexed['stake_race'] ?? 0), 4) }}</p>
    </div>
</div>

@if (!empty($token))
    <h5 class="mb-2 mt-3">{{ __('Token (read-only)') }}</h5>
    <div class="rx-bc-grid">
        <div class="rx-bc-card">
            <p class="rx-bc-card__label">{{ __('Total supply') }}</p>
            <p class="rx-bc-card__value">{{ $token['total_supply'] ?? '—' }}</p>
        </div>
        <div class="rx-bc-card">
            <p class="rx-bc-card__label">{{ __('Admin RACE') }}</p>
            <p class="rx-bc-card__value">{{ $token['admin_race'] ?? '—' }}</p>
        </div>
    </div>
@endif

<h5 class="mb-2 mt-3">{{ __('Key contracts (visible only)') }}</h5>
<div class="table-responsive rx-admin-table-wrap">
    <table class="table rx-admin-table table-sm mb-0">
        <thead>
            <tr>
                <th>{{ __('Name') }}</th>
                <th>{{ __('Address') }}</th>
                <th></th>
            </tr>
        </thead>
        <tbody>
            @foreach ([
                'race_token' => 'RACE token',
                'race_ico' => 'RaceICO',
                'community_engine' => 'Community Engine',
                'reward_vault' => 'Reward Vault',
                'usdt' => 'USDT',
                'multisig' => 'MultiSig 3-of-5',
            ] as $key => $label)
                @php $value = trim((string) ($addr[$key] ?? '')); @endphp
                <tr>
                    <td>{{ __($label) }}</td>
                    <td>
                        @if ($value !== '')
                            <code class="rx-bc-addr user-select-all">{{ $value }}</code>
                        @else
                            <span class="text-muted">{{ __('Not set') }}</span>
                        @endif
                    </td>
                    <td>
                        @if ($value !== '')
                            <a href="{{ $explorer }}/address/{{ $value }}" target="_blank" rel="noopener">{{ __('View') }}</a>
                        @endif
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>
</div>

<p class="mt-3 mb-0">
    <a class="btn btn-primary btn-sm" href="{{ route('platform.data.blockchain-stakes') }}">{{ __('Open stake list + search') }}</a>
    <a class="btn btn-outline-secondary btn-sm" href="{{ route('platform.data.contracts-watch') }}">{{ __('Full contracts watch') }}</a>
</p>
