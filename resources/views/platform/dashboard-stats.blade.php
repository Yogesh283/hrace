@php
    $cards = [
        'deposits' => [
            'label' => __('Deposits'),
            'icon' => 'bs.box-arrow-in-down',
            'tone' => 'success',
            'route' => 'platform.data.ledger-entries',
            'hint' => __('Wallet credits'),
        ],
        'withdrawals' => [
            'label' => __('Withdrawals'),
            'icon' => 'bs.box-arrow-up-right',
            'tone' => 'danger',
            'route' => 'platform.data.withdrawals',
            'hint' => __('Member payouts'),
        ],
        'users' => [
            'label' => __('Users'),
            'icon' => 'bs.people',
            'tone' => 'vip',
            'route' => 'platform.systems.users',
            'hint' => __('Registrations'),
        ],
        'investments' => [
            'label' => __('Investments'),
            'icon' => 'bs.cash-stack',
            'tone' => 'gold',
            'route' => 'platform.data.investments',
            'hint' => __('Growth plans'),
        ],
        'income_payouts' => [
            'label' => __('Income payouts'),
            'icon' => 'bs.graph-up-arrow',
            'tone' => 'income',
            'route' => 'platform.data.ledger-entries',
            'hint' => __('ROI & commissions'),
        ],
        'race_coin_swaps' => [
            'label' => __('Race Coin swaps'),
            'icon' => 'bs.arrow-left-right',
            'tone' => 'vip',
            'route' => 'platform.data.race-coin-swaps',
            'hint' => __('USDT → Race Coin'),
        ],
        'race_coin_supply' => [
            'label' => __('Race Coin supply'),
            'icon' => 'bs.cash-coin',
            'tone' => 'gold',
            'route' => 'platform.data.race-coin-swaps',
            'hint' => __('In member wallets'),
            'race_coin' => true,
        ],
    ];
@endphp

<section class="rx-dash" aria-label="{{ __('Admin overview') }}">
    <header class="rx-dash-hero">
        <div class="rx-dash-hero__brand">
            <img src="{{ asset('images/Race  Logo.png') }}" alt="" width="48" height="48" class="rx-dash-hero__logo">
            <div>
                <p class="rx-dash-hero__eyebrow">{{ config('app.name') }} · {{ __('Admin') }}</p>
                <h2 class="rx-dash-hero__title">{{ __('Platform overview') }}</h2>
                <p class="rx-dash-hero__meta">
                    {{ __('Today') }} & {{ __('Total') }} · {{ now()->format('l, M j, Y') }}
                </p>
            </div>
        </div>
        <div class="rx-dash-hero__chips">
            <span class="rx-dash-chip rx-dash-chip--live">
                <span class="rx-dash-chip__dot"></span>{{ __('Live data') }}
            </span>
            <span class="rx-dash-chip">{{ __('Updated') }} {{ now()->format('H:i') }}</span>
        </div>
    </header>

    <div class="rx-dash-section">
        <div class="rx-dash-section__head">
            <h3 class="rx-dash-section__title">{{ __('Key metrics') }}</h3>
            <p class="rx-dash-section__desc">{{ __('Amounts in USD unless noted. Demo ledger rows excluded.') }}</p>
        </div>

        <div class="rx-dash-grid">
            @foreach ($cards as $key => $meta)
                @php
                    $row = $dashboard[$key] ?? [];
                    $countOnly = ! empty($row['is_count_only']);
                    $isRaceCoin = ! empty($meta['race_coin']) || ! empty($row['is_race_coin']);
                    $todayVal = $countOnly
                        ? number_format($row['today_count'] ?? 0)
                        : ($isRaceCoin
                            ? ($row['today_amount'] ?? '0.0000 RC')
                            : '$'.($row['today_amount'] ?? '0.00'));
                    $totalVal = $countOnly
                        ? number_format($row['total_count'] ?? 0)
                        : ($isRaceCoin
                            ? ($row['total_amount'] ?? '0.0000 RC')
                            : '$'.($row['total_amount'] ?? '0.00'));
                @endphp
                <article class="rx-dash-card rx-dash-card--{{ $meta['tone'] }}">
                    <div class="rx-dash-card__glow" aria-hidden="true"></div>
                    <div class="rx-dash-card__top">
                        <div class="rx-dash-card__icon-wrap">
                            <x-orchid-icon :path="$meta['icon']" class="rx-dash-card__icon"/>
                        </div>
                        <div class="rx-dash-card__titles">
                            <h4 class="rx-dash-card__name">{{ $meta['label'] }}</h4>
                            <p class="rx-dash-card__hint">{{ $meta['hint'] }}</p>
                        </div>
                    </div>

                    <div class="rx-dash-card__metrics">
                        <div class="rx-dash-metric">
                            <span class="rx-dash-metric__pill">{{ __('Today') }}</span>
                            <span class="rx-dash-metric__value">{{ $todayVal }}</span>
                            <span class="rx-dash-metric__sub">
                                @if ($countOnly)
                                    {{ __('new members') }}
                                @else
                                    {{ number_format($row['today_count'] ?? 0) }} {{ __('txns') }}
                                @endif
                            </span>
                        </div>
                        <div class="rx-dash-metric rx-dash-metric--total">
                            <span class="rx-dash-metric__pill">{{ __('Total') }}</span>
                            <span class="rx-dash-metric__value">{{ $totalVal }}</span>
                            <span class="rx-dash-metric__sub">
                                @if ($countOnly)
                                    {{ __('all members') }}
                                @else
                                    {{ number_format($row['total_count'] ?? 0) }} {{ __('txns') }}
                                @endif
                            </span>
                        </div>
                    </div>

                    @if (Route::has($meta['route']))
                        <a href="{{ route($meta['route']) }}" class="rx-dash-card__link">
                            {{ __('View details') }}
                            <x-orchid-icon path="bs.arrow-right" class="rx-dash-card__link-icon"/>
                        </a>
                    @endif
                </article>
            @endforeach
        </div>
    </div>

    <div class="rx-dash-section rx-dash-section--links">
        <div class="rx-dash-section__head">
            <h3 class="rx-dash-section__title">{{ __('Quick access') }}</h3>
        </div>
        <div class="rx-dash-links">
            <a href="{{ route('platform.data.team') }}" class="rx-dash-link">
                <x-orchid-icon path="bs.diagram-3"/><span>{{ __('Team structure') }}</span>
            </a>
            <a href="{{ route('platform.data.treasury') }}" class="rx-dash-link">
                <x-orchid-icon path="bs.wallet2"/><span>{{ __('Treasury') }}</span>
            </a>
            <a href="{{ route('platform.data.race-coin-swaps') }}" class="rx-dash-link">
                <x-orchid-icon path="bs.arrow-left-right"/><span>{{ __('Race Coin swaps') }}</span>
            </a>
        </div>
    </div>
</section>
