<div class="bg-white rounded shadow-sm p-4 mb-3">
    <p class="mb-2"><strong>{{ __('Controller') }}:</strong>
        <code>{{ $multisig !== '' ? $multisig : '—' }}</code>
        · {{ $threshold ?? '3-of-5' }}
    </p>
    <p class="text-muted small mb-0">{{ $note }}</p>
</div>

@foreach ($funds ?? [] as $fund)
    <div class="bg-white rounded shadow-sm p-4 mb-3">
        <h5 class="mb-1">{{ $fund['label'] }}</h5>
        <p class="text-muted small mb-2">{{ $fund['purpose'] }}</p>
        <p class="mb-1"><strong>{{ __('Contract') }}:</strong>
            <code class="user-select-all">{{ $fund['address'] !== '' ? $fund['address'] : __('Not configured in .env') }}</code>
        </p>
        <p class="mb-0 small"><strong>{{ __('Tokens') }}:</strong> {{ $fund['tokens'] }}</p>
        <p class="mb-0 mt-2 small text-warning">
            {{ __('Balances / proposals: read on-chain via explorer or Multisig tooling. Admin cannot execute withdrawals.') }}
        </p>
    </div>
@endforeach
