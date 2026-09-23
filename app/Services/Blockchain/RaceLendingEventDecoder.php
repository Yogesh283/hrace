<?php

namespace App\Services\Blockchain;

/**
 * Maps RaceLendingBorrowing log topics → event names for blockchain:index-events hook.
 */
class RaceLendingEventDecoder
{
    /** @var array<string, string> topic0 => event name */
    private const TOPIC0 = [
        // Populated at deploy time from Hardhat artifacts / cast keccak; placeholders for wiring.
        'LendingCreated' => '',
        'SecurityDeposited' => '',
        'LoanDisbursed' => '',
        'RepaymentMade' => '',
        'RepaymentScheduled' => '',
        'RepaymentSettled' => '',
        'PositionMatured' => '',
        'PositionClosed' => '',
        'DefaultRecorded' => '',
        'TreasuryPayment' => '',
        'LendingPaused' => '',
        'LendingUnpaused' => '',
    ];

    public function decode(string $topic0, string $data, array $topics): ?array
    {
        $eventName = $this->eventNameForTopic($topic0);
        if ($eventName === null) {
            return null;
        }

        return [
            'event_name' => $eventName,
            'topic0' => $topic0,
            'topics' => $topics,
            'data' => $data,
        ];
    }

    public function eventNameForTopic(string $topic0): ?string
    {
        foreach (self::TOPIC0 as $name => $hash) {
            if ($hash !== '' && strcasecmp($hash, $topic0) === 0) {
                return $name;
            }
        }

        return null;
    }

    /**
     * @return list<string>
     */
    public function supportedEvents(): array
    {
        return array_keys(self::TOPIC0);
    }
}
