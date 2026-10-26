<?php

namespace App\Services\Blockchain;

use App\Models\IcoPurchase;
use App\Models\SiteSetting;

/**
 * Catch recent RaceICO buys that sync-tx missed. Read-model only.
 */
final class IcoPurchaseCatchUpService
{
    public const ICO_PURCHASED_TOPIC = '0x7f822dd71f32cfb5c893fd7093790736694f76f1a71a757d16e8d23f7eaef963';

    /**
     * @param  list<string>  $extraTxHashes
     * @return array{scanned: int, ingested: int, rows: int}
     */
    public function catchUp(int $lookbackBlocks = 4000, array $extraTxHashes = []): array
    {
        $ingest = app(BlockchainEventIngestService::class);
        $rpc = BscJsonRpcClient::fromConfig();
        $ico = '';
        try {
            $ico = strtolower(trim(SiteSetting::raceIcoContractAddress()));
        } catch (\Throwable) {
            $ico = strtolower(trim((string) config('blockchain.contracts.ico', '')));
        }
        $hashes = [];
        foreach ($extraTxHashes as $tx) {
            $tx = strtolower(trim((string) $tx));
            if (preg_match('/^0x[a-f0-9]{64}$/', $tx)) {
                $hashes[$tx] = true;
            }
        }

        if ($ico !== '' && preg_match('/^0x[a-f0-9]{40}$/', $ico)) {
            $latestHex = $rpc->call('eth_blockNumber', []);
            $latest = is_string($latestHex) ? hexdec($latestHex) : 0;
            $from = max(0, $latest - max(200, $lookbackBlocks));
            $logs = $rpc->getLogs($ico, $from, $latest, 200, [self::ICO_PURCHASED_TOPIC]);
            if (is_array($logs)) {
                foreach ($logs as $log) {
                    $tx = strtolower((string) ($log['transactionHash'] ?? ''));
                    if ($tx !== '') {
                        $hashes[$tx] = true;
                    }
                }
            }
        }

        $ingested = 0;
        foreach (array_keys($hashes) as $tx) {
            $result = $ingest->ingestFromTxHash($tx);
            if ($result['ok'] ?? false) {
                $ingested++;
            }
        }

        return [
            'scanned' => count($hashes),
            'ingested' => $ingested,
            'rows' => (int) IcoPurchase::query()->count(),
        ];
    }
}
