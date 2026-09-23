<?php

namespace App\Services\Blockchain;

/**
 * Read-only RaceLendingBorrowing views (no Laravel financial authority).
 */
class RaceLendingReadService
{
    public function isConfigured(): bool
    {
        return config('race_lending.enabled')
            && config('race_lending.contract_address') !== '';
    }

    /**
     * @return array<string, mixed>|null
     */
    public function uiPositionSummary(int $positionId): ?array
    {
        if (! $this->isConfigured()) {
            return null;
        }

        return [
            'position_id' => $positionId,
            'source' => 'chain',
            'contract' => config('race_lending.contract_address'),
            'note' => 'Populate via RPC eth_call getPosition/getRepaymentStatus after deploy.',
        ];
    }

    /**
     * @return list<string>
     */
    public function indexedEventNames(): array
    {
        return [
            'LendingCreated',
            'SecurityDeposited',
            'LoanDisbursed',
            'RepaymentMade',
            'RepaymentScheduled',
            'RepaymentSettled',
            'PositionMatured',
            'PositionClosed',
            'DefaultRecorded',
            'TreasuryPayment',
            'LendingPaused',
            'LendingUnpaused',
        ];
    }
}
