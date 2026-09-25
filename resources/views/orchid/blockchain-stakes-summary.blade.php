@php
    $summary = $summary ?? ['users' => 0, 'rows' => 0, 'usdt' => '0', 'race' => '0'];
@endphp

<div class="rx-bc-grid">
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('Staking users') }}</p>
        <p class="rx-bc-card__value">{{ number_format((int) $summary['users']) }}</p>
        <p class="rx-bc-card__hint">{{ __('Unique wallets (active)') }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('Active stakes') }}</p>
        <p class="rx-bc-card__value">{{ number_format((int) $summary['rows']) }}</p>
        <p class="rx-bc-card__hint">{{ __('Indexed Engine rows') }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('Total USDT') }}</p>
        <p class="rx-bc-card__value">{{ number_format((float) $summary['usdt'], 2) }}</p>
        <p class="rx-bc-card__hint">{{ __('Principal notional') }}</p>
    </div>
    <div class="rx-bc-card">
        <p class="rx-bc-card__label">{{ __('Total RACE') }}</p>
        <p class="rx-bc-card__value">{{ number_format((float) $summary['race'], 4) }}</p>
        <p class="rx-bc-card__hint">{{ __('Staked race amount') }}</p>
    </div>
</div>
