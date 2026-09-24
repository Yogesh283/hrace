<?php

namespace App\Services\Blockchain;

use App\Models\BlockchainEvent;
use App\Models\User;
use App\Support\BlockchainMode;
use App\Support\MemberCode;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Level income paid on-chain in RACE (CommunityReferralPaid) — formatted for the Transactions page.
 * RACE is minted straight to the sponsor wallet in the stake tx; USDT value is the notional at payout time.
 */
class OnChainLevelIncomeRows
{
    /**
     * @return list<array<string, mixed>>
     */
    public function forUser(User $user, ?Carbon $onDate = null, int $limit = 200): array
    {
        $events = $this->query($user, $onDate)->latest('id')->limit($limit)->get();
        if ($events->isEmpty()) {
            return [];
        }

        $fromUsers = $this->usersByWallet($events);
        $explorer = BlockchainMode::effectiveChainId() === 97 ? 'https://testnet.bscscan.com' : 'https://bscscan.com';

        return $events
            ->map(function (BlockchainEvent $event) use ($fromUsers, $explorer) {
                $decoded = $this->decode($event);
                if ($decoded === null) {
                    return null;
                }
                $from = $fromUsers[$decoded['from_wallet']] ?? null;
                $fromCode = $from ? MemberCode::format($from->member_number) : null;
                $fromLabel = $fromCode !== null
                    ? trim($fromCode.($from->name ? ' ('.$from->name.')' : ''))
                    : substr($decoded['from_wallet'], 0, 6).'…'.substr($decoded['from_wallet'], -4);
                $levelLabel = 'Level '.$decoded['level'];

                return [
                    'id' => 'oc-'.$event->id,
                    'entry_type' => 'community_referral',
                    'income_name' => 'Level Income (Community Referral)',
                    'income_key' => 'community_referrals',
                    'asset' => 'RACE',
                    'amount_race' => $decoded['race'],
                    'amount_usd' => $decoded['usdt'],
                    'balance_after_usd' => null,
                    'reference_type' => null,
                    'reference_id' => null,
                    'level' => $decoded['level'],
                    'level_label' => $levelLabel,
                    'from_member' => $fromLabel,
                    'from_wallet' => $decoded['from_wallet'],
                    'detail' => "{$levelLabel} · from {$fromLabel}",
                    'tx_hash' => $event->tx_hash,
                    'tx_url' => $explorer.'/tx/'.$event->tx_hash,
                    'created_at' => $event->block_time ?? $event->created_at,
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @return array{race: string, usdt: string}
     */
    public function totalsForUser(User $user, ?Carbon $onDate = null): array
    {
        $race = '0';
        $usdt = '0';
        $this->query($user, $onDate)->orderBy('id')->each(function (BlockchainEvent $event) use (&$race, &$usdt) {
            $decoded = $this->decode($event);
            if ($decoded !== null) {
                $race = bcadd($race, $decoded['race'], 8);
                $usdt = bcadd($usdt, $decoded['usdt'], 8);
            }
        });

        return [
            'race' => number_format((float) $race, 4, '.', ''),
            'usdt' => number_format((float) $usdt, 2, '.', ''),
        ];
    }

    private function query(User $user, ?Carbon $onDate)
    {
        $wallet = strtolower(trim((string) ($user->wallet_address ?? '')));
        $query = BlockchainEvent::query()->where('event_name', 'CommunityReferralPaid');

        if (! Schema::hasTable('blockchain_events') || ! preg_match('/^0x[a-f0-9]{40}$/', $wallet)) {
            return $query->whereRaw('1 = 0');
        }

        $query->where('wallet_address', $wallet);
        if ($onDate !== null) {
            $query->whereDate('created_at', $onDate);
        }

        return $query;
    }

    /**
     * @param  Collection<int, BlockchainEvent>  $events
     * @return array<string, User>
     */
    private function usersByWallet(Collection $events): array
    {
        $wallets = $events
            ->map(fn (BlockchainEvent $e) => $this->decode($e)['from_wallet'] ?? null)
            ->filter()
            ->unique()
            ->values()
            ->all();
        if ($wallets === []) {
            return [];
        }

        return User::query()
            ->whereIn(DB::raw('LOWER(wallet_address)'), $wallets)
            ->get(['id', 'name', 'member_number', 'wallet_address'])
            ->keyBy(static fn (User $u) => strtolower((string) $u->wallet_address))
            ->all();
    }

    /**
     * CommunityReferralPaid(address indexed sponsor, address indexed from, uint256 level, uint256 usdtValue, uint256 racePaid)
     *
     * @return array{from_wallet: string, level: int, usdt: string, race: string}|null
     */
    private function decode(BlockchainEvent $event): ?array
    {
        $payload = is_array($event->payload) ? $event->payload : [];
        $topics = $payload['topics'] ?? [];
        $data = (string) ($payload['data'] ?? '');
        if (! isset($topics[2])) {
            return null;
        }

        $hex = Str::lower(Str::startsWith($data, '0x') ? substr($data, 2) : $data);
        if (strlen($hex) < 192) {
            return null;
        }

        return [
            'from_wallet' => '0x'.strtolower(substr((string) $topics[2], -40)),
            'level' => (int) hexdec(substr($hex, 0, 64)),
            'usdt' => $this->weiToDecimal(substr($hex, 64, 64), 2),
            'race' => $this->weiToDecimal(substr($hex, 128, 64), 4),
        ];
    }

    private function weiToDecimal(string $hex64, int $scale): string
    {
        $hex = ltrim($hex64, '0');
        if ($hex === '') {
            return number_format(0, $scale, '.', '');
        }
        $wei = function_exists('gmp_init') ? gmp_strval(gmp_init($hex, 16), 10) : (string) hexdec($hex);

        return bcdiv($wei, '1000000000000000000', $scale);
    }
}
