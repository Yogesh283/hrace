<div class="bg-white rounded shadow-sm p-4 mb-3">
    <h5 class="mb-3">{{ __('Staking reward rates') }}</h5>
    <table class="table table-sm">
        <thead>
            <tr>
                <th>{{ __('Lock') }}</th>
                <th>{{ __('Daily %') }}</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($participation_tiers ?? [] as $tier)
                <tr>
                    <td>{{ $tier['label'] ?? $tier['days'] }}</td>
                    <td>{{ $tier['daily_roi_percent'] ?? $tier['daily_reward_percent'] ?? '—' }}%</td>
                </tr>
            @endforeach
        </tbody>
    </table>
    @php($unlock = $stake_unlock ?? [])
    <p class="text-muted small mb-0">
        {{ __('Stake unlock:') }}
        {{ $unlock['admin_fee_percent'] ?? 10 }}% {{ __('admin') }}
        · {{ $unlock['emi_count'] ?? 3 }}×{{ $unlock['emi_percent_each'] ?? 30 }}% {{ __('EMI') }}
        · {{ __('Flexible fee-free after') }} {{ $unlock['flexible_fee_free_after_days'] ?? 10 }} {{ __('days') }}
    </p>
</div>

<div class="bg-white rounded shadow-sm p-4 mb-3">
    <h5 class="mb-3">{{ __('Community referrals (10 levels)') }}</h5>
    <table class="table table-sm">
        <thead>
            <tr>
                <th>{{ __('Level') }}</th>
                <th>{{ __('%') }}</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($community_referral_levels ?? [] as $level => $pct)
                <tr>
                    <td>L{{ $level }}</td>
                    <td>{{ $pct }}%</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</div>

<div class="bg-white rounded shadow-sm p-4 mb-3">
    <h5 class="mb-3">{{ __('ROI Sharing') }}</h5>
    <p class="mb-0">{{ __('Direct (L1) only:') }} <strong>{{ $roi_sharing_percent ?? 10 }}%</strong> {{ __('of direct daily ROI') }}</p>
</div>

<div class="bg-white rounded shadow-sm p-4 mb-3">
    <h5 class="mb-3">{{ __('Community Team Rewards (income withdrawal)') }}</h5>
    <p class="text-muted small">
        {{ __('Team Reward') }}: {{ $team_rewards_fee_percent ?? 10 }}% → L1–L10 (unpaid → admin).
        {{ __('Admin Fee') }}: $1 under $100 / 1% at $100+ (separate).
    </p>
    <table class="table table-sm">
        <thead>
            <tr>
                <th>{{ __('Level') }}</th>
                <th>{{ __('Share of fee pool') }}</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($team_reward_levels ?? [] as $level => $pct)
                <tr>
                    <td>L{{ $level }}</td>
                    <td>{{ $pct }}%</td>
                </tr>
            @endforeach
        </tbody>
    </table>
    @php($rl = $withdrawal_rate_limit ?? [])
    <p class="text-muted small mb-0">
        {{ __('Rate limit:') }}
        {{ $rl['max_per_window'] ?? 2 }} {{ __('withdrawals per') }}
        {{ $rl['window_hours'] ?? 24 }}h
        · {{ __('Not applied to fixed maturity / EMI.') }}
    </p>
</div>

<div class="bg-white rounded shadow-sm p-4 mb-3">
    <h5 class="mb-3">{{ __('Holding rollover') }}</h5>
    @php($hr = $holding_rollover ?? [])
    <p class="mb-0">
        {{ __('Enabled:') }} {{ !empty($hr['enabled']) ? __('Yes') : __('No') }}
        · {{ __('Hours after complete:') }} {{ $hr['rollover_hours'] ?? 24 }}
    </p>
</div>

<div class="bg-white rounded shadow-sm p-4">
    <h5 class="mb-3">{{ __('Community leadership (11 ranks)') }}</h5>
    <p class="text-muted small">{{ __('Edit config/reward_plan.php to change program rules, then clear config cache.') }}</p>
    <table class="table table-sm">
        <thead>
            <tr>
                <th>{{ __('Level') }}</th>
                <th>{{ __('Self hold') }}</th>
                <th>{{ __('Team volume') }}</th>
                <th>{{ __('Directs') }}</th>
                <th>{{ __('Reward %') }}</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($leadership_ranks ?? [] as $row)
                <tr>
                    <td>{{ $row['level'] ?? '' }}</td>
                    <td>${{ number_format((float) ($row['self_hold_usd'] ?? 0)) }}</td>
                    <td>${{ number_format((float) ($row['team_volume_usd'] ?? 0)) }}</td>
                    <td>{{ $row['direct_required'] ?? '' }}</td>
                    <td>{{ $row['reward_percent'] ?? '' }}%</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</div>
