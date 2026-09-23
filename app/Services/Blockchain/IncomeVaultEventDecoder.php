<?php

namespace App\Services\Blockchain;

/**
 * Decodes RaceIncomeVault log topics/data into indexer-friendly arrays.
 */
class IncomeVaultEventDecoder
{
    /** @var array<string, string> topic0 => name */
    public const TOPIC_MAP = [
        '0x2ade221666cfced2303f1db2f57404b18b7f3670cb01305aa6efc75e15e6d8b0' => 'IncomeCredited',
        '0x7dec368b5a24e05d492daf04ced109e8d4760156057f4a1fe8dad8c24e58407d' => 'IncomeMigrated',
        '0xa38c3598835516373449b1398563e07007abd92bb2c783136bf01130b70ae0c2' => 'IncomeWithdrawal',
        '0x9daad753798ff21d4056225c033af7427aebcc28b2b9f902490edc120fa1c8c6' => 'FeeDistributed',
    ];

    public function resolveName(?string $topic0): ?string
    {
        if ($topic0 === null) {
            return null;
        }

        return self::TOPIC_MAP[strtolower($topic0)] ?? null;
    }

    /**
     * @param  list<string>  $topics
     * @return array<string, mixed>|null
     */
    public function decode(string $eventName, array $topics, string $data): ?array
    {
        return match ($eventName) {
            'IncomeCredited' => $this->decodeIncomeCredited($topics, $data),
            'IncomeMigrated' => $this->decodeIncomeMigrated($topics, $data),
            'IncomeWithdrawal' => $this->decodeIncomeWithdrawal($topics, $data),
            'FeeDistributed' => $this->decodeFeeDistributed($topics, $data),
            default => null,
        };
    }

    /**
     * @param  list<string>  $topics
     * @return array<string, mixed>
     */
    private function decodeIncomeCredited(array $topics, string $data): array
    {
        $user = $this->topicAddress($topics[1] ?? null);
        $incomeType = $topics[2] ?? null;
        $referenceId = $topics[3] ?? null;
        $fields = $this->decodeDataWords($data, 3);

        return [
            'user' => $user,
            'wallet' => $user,
            'incomeType' => $incomeType,
            'referenceId' => $referenceId,
            'amount' => $this->weiWordToDecimal($fields[0] ?? '0'),
            'source' => $this->wordToAddress($fields[1] ?? ''),
            'timestamp' => isset($fields[2]) ? hexdec($fields[2]) : null,
        ];
    }

    /**
     * @param  list<string>  $topics
     * @return array<string, mixed>
     */
    private function decodeIncomeMigrated(array $topics, string $data): array
    {
        $user = $this->topicAddress($topics[1] ?? null);
        $migrationId = $topics[2] ?? null;
        $fields = $this->decodeDataWords($data, 3);

        return [
            'user' => $user,
            'wallet' => $user,
            'migrationId' => $migrationId,
            'referenceId' => $migrationId,
            'amount' => $this->weiWordToDecimal($fields[0] ?? '0'),
            'source' => $this->wordToAddress($fields[1] ?? ''),
            'timestamp' => isset($fields[2]) ? hexdec($fields[2]) : null,
        ];
    }

    /**
     * @param  list<string>  $topics
     * @return array<string, mixed>
     */
    private function decodeIncomeWithdrawal(array $topics, string $data): array
    {
        $user = $this->topicAddress($topics[1] ?? null);
        $withdrawalId = $topics[2] ?? null;
        $fields = $this->decodeDataWords($data, 5);

        return [
            'user' => $user,
            'wallet' => $user,
            'withdrawalId' => $withdrawalId,
            'grossAmount' => $this->weiWordToDecimal($fields[0] ?? '0'),
            'teamReward' => $this->weiWordToDecimal($fields[1] ?? '0'),
            'adminFee' => $this->weiWordToDecimal($fields[2] ?? '0'),
            'netAmount' => $this->weiWordToDecimal($fields[3] ?? '0'),
            'timestamp' => isset($fields[4]) ? hexdec($fields[4]) : null,
        ];
    }

    /**
     * @param  list<string>  $topics
     * @return array<string, mixed>
     */
    private function decodeFeeDistributed(array $topics, string $data): array
    {
        $recipient = $this->topicAddress($topics[1] ?? null);
        $withdrawalId = $topics[2] ?? null;
        $feeKind = $topics[3] ?? null;
        $fields = $this->decodeDataWords($data, 2);

        return [
            'user' => $recipient,
            'wallet' => $recipient,
            'withdrawalId' => $withdrawalId,
            'feeKind' => $feeKind,
            'amount' => $this->weiWordToDecimal($fields[0] ?? '0'),
            'timestamp' => isset($fields[1]) ? hexdec($fields[1]) : null,
        ];
    }

    private function topicAddress(?string $topic): ?string
    {
        if ($topic === null || strlen($topic) < 66) {
            return null;
        }

        return '0x'.substr(strtolower($topic), 26);
    }

    /**
     * @return list<string>
     */
    private function decodeDataWords(string $data, int $wordCount): array
    {
        $hex = str_starts_with($data, '0x') ? substr($data, 2) : $data;
        $out = [];
        for ($i = 0; $i < $wordCount; $i++) {
            $out[] = substr($hex, $i * 64, 64) ?: str_repeat('0', 64);
        }

        return $out;
    }

    private function wordToAddress(string $word64): ?string
    {
        $word64 = ltrim($word64, '0');
        if ($word64 === '') {
            return null;
        }

        return '0x'.str_pad(substr($word64, -40), 40, '0', STR_PAD_LEFT);
    }

    private function weiWordToDecimal(string $word64): string
    {
        $hex = ltrim($word64, '0');
        if ($hex === '') {
            return '0.00000000';
        }
        $wei = function_exists('gmp_init')
            ? gmp_strval(gmp_init($hex, 16), 10)
            : (string) hexdec($hex);

        return bcdiv($wei, bcpow('10', '18', 0), 8);
    }
}
