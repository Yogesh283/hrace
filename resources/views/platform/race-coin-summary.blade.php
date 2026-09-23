<div class="row g-3 mb-4">
    <div class="col-sm-6 col-xl-3">
        <div class="card border-0 shadow-sm h-100">
            <div class="card-body">
                <p class="text-muted small mb-1">{{ __('Total Race Coin in circulation') }}</p>
                <p class="h4 mb-0 fw-bold text-primary">{{ $total_race_coins }} RC</p>
            </div>
        </div>
    </div>
    <div class="col-sm-6 col-xl-3">
        <div class="card border-0 shadow-sm h-100">
            <div class="card-body">
                <p class="text-muted small mb-1">{{ __('Total USDT swapped') }}</p>
                <p class="h4 mb-0 fw-bold text-success">${{ $total_usdt_swapped }}</p>
            </div>
        </div>
    </div>
    <div class="col-sm-6 col-xl-3">
        <div class="card border-0 shadow-sm h-100">
            <div class="card-body">
                <p class="text-muted small mb-1">{{ __('Race Coin price') }}</p>
                <p class="h4 mb-0 fw-bold">${{ number_format((float) config('race_coin.price_usd', 0.10), 2) }}</p>
            </div>
        </div>
    </div>
    <div class="col-sm-6 col-xl-3">
        <div class="card border-0 shadow-sm h-100">
            <div class="card-body">
                <p class="text-muted small mb-1">{{ __('ID activation cost') }}</p>
                <p class="h4 mb-0 fw-bold">{{ number_format((float) config('race_coin.id_activation_usd', 50) / max((float) config('race_coin.price_usd', 0.10), 0.01), 0) }} RC</p>
                <p class="text-muted small mb-0">${{ number_format((float) config('race_coin.id_activation_usd', 50), 2) }}</p>
            </div>
        </div>
    </div>
</div>
