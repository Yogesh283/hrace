@php
    $ico = $ico_live ?? [];
    $reserve = $reserve_live ?? [];
    $engine = $engine_live ?? [];
    $token = $token_live ?? [];
    $hold = $hold_live ?? [];
    $oracle = $oracle_live ?? [];
    $indexed = $indexed ?? [];
    $catalog = $catalog ?? [];
    $readiness = $readiness ?? [];
    $memberFlow = $member_flow ?? [];
    $recentPurchases = $recent_purchases ?? [];
    $recentStakes = $recent_stakes ?? [];
    $events = $events ?? [];
    $explorer = $explorer ?? 'https://bscscan.com';
    $rpcOk = (bool) ($rpc_ok ?? false);
    $readyOk = collect($readiness)->where('ok', true)->count();
    $readyTotal = max(1, count($readiness));
@endphp

<div class="rx-bc-card mb-3">
    <p class="mb-1"><strong>{{ __('Network') }}:</strong> {{ $network ?? '—' }} · {{ __('Chain') }} {{ $chain_id ?? '—' }}</p>
    <p class="mb-0 small text-muted">
        {{ $rpcOk ? __('Live RPC connected.') : __('RPC unavailable — indexed DB still shown.') }}
        · {{ __('Live-test readiness') }}: {{ $readyOk }}/{{ $readyTotal }}
        · <a href="{{ $explorer }}" target="_blank" rel="noopener">{{ __('Explorer') }}</a>
    </p>
</div>

<h5 class="mb-2">{{ __('Live-test readiness (ICO 600k)') }}</h5>
<div class="table-responsive rx-admin-table-wrap mb-3">
    <table class="table rx-admin-table table-sm mb-0">
        <tbody>
            @foreach ($readiness as $row)
                <tr>
                    <td style="width:2.5rem">
                        @if ($row['ok'])
                            <span class="text-success">✓</span>
                        @else
                            <span class="text-danger">✗</span>
                        @endif
                    </td>
                    <td>{{ $row['label'] }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</div>

@if (!empty($memberFlow))
    <h5 class="mb-2">{{ __('Member ICO flow') }}</h5>
    <ol class="mb-3 small">
        @foreach ($memberFlow as $step)
            <li class="mb-1">{{ $step }}</li>
        @endforeach
    </ol>
@endif

<h5 class="mb-2">{{ __('ICO live (on-chain)') }}</h5>
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
        <p class="rx-bc-card__label">{{ __('Reserve available') }}</p>
        <p class="rx-bc-card__value">{{ $reserve['available_race'] ?? '—' }}</p>
        <p class="rx-bc-card__hint">{{ __('ICOContract available RACE') }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('Reserve wallet balance') }}</p>
        <p class="rx-bc-card__value">{{ $reserve['race_balance'] ?? '—' }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('Funds raised') }}</p>
        <p class="rx-bc-card__value">{{ $ico['raised_usdt'] ?? '—' }} USDT</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('RACE held (unstaked)') }}</p>
        <p class="rx-bc-card__value">{{ $ico['held_race'] ?? '—' }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('Oracle price') }}</p>
        <p class="rx-bc-card__value">{{ isset($oracle['price_usdt']) ? '$'.$oracle['price_usdt'] : '—' }}</p>
    </div>
</div>

<h5 class="mb-2 mt-3">{{ __('Overall report (indexed)') }}</h5>
<div class="rx-bc-grid">
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('ICO buyers') }}</p>
        <p class="rx-bc-card__value">{{ number_format((int) ($indexed['ico_users'] ?? 0)) }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('ICO purchase rows') }}</p>
        <p class="rx-bc-card__value">{{ number_format((int) ($indexed['ico_buys'] ?? 0)) }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('USDT raised (index)') }}</p>
        <p class="rx-bc-card__value">{{ number_format((float) ($indexed['ico_usdt'] ?? 0), 2) }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('RACE sold (index)') }}</p>
        <p class="rx-bc-card__value">{{ number_format((float) ($indexed['ico_race'] ?? 0), 4) }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('Stakes created (live)') }}</p>
        <p class="rx-bc-card__value">{{ $engine['stakes_created'] ?? '—' }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('Locked RACE (live)') }}</p>
        <p class="rx-bc-card__value">{{ $engine['locked_race'] ?? '—' }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('Active stake users') }}</p>
        <p class="rx-bc-card__value">{{ number_format((int) ($indexed['stake_users'] ?? 0)) }}</p>
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
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('IncomeHold RACE') }}</p>
        <p class="rx-bc-card__value">{{ $hold['held_race'] ?? '—' }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('Token total supply') }}</p>
        <p class="rx-bc-card__value">{{ $token['total_supply'] ?? '—' }}</p>
    </div>
</div>

<h5 class="mb-2 mt-3">{{ __('All contracts — role + live status') }}</h5>
<div class="table-responsive rx-admin-table-wrap mb-3">
    <table class="table rx-admin-table table-sm mb-0">
        <thead>
            <tr>
                <th>{{ __('Contract') }}</th>
                <th>{{ __('What it does') }}</th>
                <th>{{ __('Live now') }}</th>
                <th>{{ __('Address') }}</th>
                <th></th>
            </tr>
        </thead>
        <tbody>
            @forelse ($catalog as $row)
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
                            <a href="{{ $row['explorer_url'] }}" target="_blank" rel="noopener">{{ __('View') }}</a>
                        @endif
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="5" class="text-muted">{{ __('No contracts configured.') }}</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</div>

<h5 class="mb-2">{{ __('Recent ICO purchases (index)') }}</h5>
<div class="table-responsive rx-admin-table-wrap mb-3">
    <table class="table rx-admin-table table-sm mb-0">
        <thead>
            <tr>
                <th>#</th>
                <th>{{ __('Wallet') }}</th>
                <th>USDT</th>
                <th>RACE</th>
                <th>{{ __('Phase') }}</th>
                <th>{{ __('Tx') }}</th>
                <th>{{ __('Time') }}</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($recentPurchases as $row)
                <tr>
                    <td>{{ $row['id'] }}</td>
                    <td><code>{{ \Illuminate\Support\Str::limit($row['wallet'], 14, '…') }}</code></td>
                    <td>{{ $row['usdt'] }}</td>
                    <td>{{ $row['race'] }}</td>
                    <td>{{ $row['phase'] }}</td>
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
            @empty
                <tr>
                    <td colspan="7" class="text-muted">{{ __('No purchases yet — after member Buy & Stake, rows appear here.') }}</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</div>

<h5 class="mb-2">{{ __('Recent stakes (index)') }}</h5>
<div class="table-responsive rx-admin-table-wrap mb-3">
    <table class="table rx-admin-table table-sm mb-0">
        <thead>
            <tr>
                <th>#</th>
                <th>{{ __('Wallet') }}</th>
                <th>USDT</th>
                <th>RACE</th>
                <th>{{ __('Source') }}</th>
                <th>{{ __('Status') }}</th>
                <th>{{ __('Tx') }}</th>
                <th>{{ __('Time') }}</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($recentStakes as $row)
                <tr>
                    <td>{{ $row['id'] }}</td>
                    <td><code>{{ \Illuminate\Support\Str::limit($row['wallet'], 14, '…') }}</code></td>
                    <td>{{ $row['usdt'] }}</td>
                    <td>{{ $row['race'] }}</td>
                    <td>{{ $row['source'] }}</td>
                    <td>{{ $row['status'] }}</td>
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
            @empty
                <tr>
                    <td colspan="8" class="text-muted">{{ __('No stakes indexed yet.') }}</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</div>

<h5 class="mb-2">{{ __('Recent on-chain events') }}</h5>
<div class="table-responsive rx-admin-table-wrap mb-3">
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
            @forelse ($events as $row)
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
            @empty
                <tr>
                    <td colspan="4" class="text-muted">{{ __('No indexed events yet. Enable blockchain indexer.') }}</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</div>

<p class="mt-2 mb-0">
    <a class="btn btn-primary btn-sm" href="{{ route('platform.data.blockchain-stakes') }}">{{ __('Open stake list + search') }}</a>
    <a class="btn btn-outline-secondary btn-sm" href="{{ route('platform.data.contracts-watch') }}">{{ __('Contracts detail') }}</a>
    <a class="btn btn-outline-secondary btn-sm" href="{{ route('platform.data.ico-contract') }}">{{ __('ICO deposit / start phase') }}</a>
</p>
