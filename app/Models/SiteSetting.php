<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class SiteSetting extends Model
{
    public const KEY_ADDRESS = 'address';

    public const KEY_NETWORK_LABEL = 'network_label';

    public const KEY_BONZA_BUSTER_DIRECT_PERCENT = 'bonza_buster_direct_percent';

    public const KEY_BONZA_BUSTER_ENABLED = 'bonza_buster_enabled';

    public const KEY_MEMBER_POPUP_ENABLED = 'member_popup_enabled';

    public const KEY_MEMBER_POPUP_TITLE = 'member_popup_title';

    public const KEY_MEMBER_POPUP_MESSAGE = 'member_popup_message';

    public const KEY_ICO_CONTRACT = 'ico_contract';

    public const KEY_RACE_ICO_CONTRACT = 'race_ico_contract';

    public const KEY_ICO_ADMIN_WALLET = 'ico_admin_wallet';

    public const KEY_INCOME_HOLD = 'income_hold';

    protected $table = 'site_settings';

    protected $fillable = [
        'key',
        'value',
    ];

    /** @var array<string, string|null> */
    private static array $getMemo = [];

    public static function get(string $key, ?string $default = null): ?string
    {
        if (array_key_exists($key, self::$getMemo)) {
            $cached = self::$getMemo[$key];

            return $cached !== null && $cached !== '' ? $cached : $default;
        }

        if (! static::usesKeyValueSchema()) {
            $value = static::legacyGet($key, $default);
            self::$getMemo[$key] = is_string($value) ? trim($value) : $value;

            return $value;
        }

        $value = static::query()->where('key', $key)->value('value');

        if (is_string($value) && trim($value) !== '') {
            self::$getMemo[$key] = trim($value);

            return self::$getMemo[$key];
        }

        self::$getMemo[$key] = null;

        return $default;
    }

    public static function set(string $key, ?string $value): void
    {
        unset(self::$getMemo[$key]);

        if (! static::usesKeyValueSchema()) {
            static::legacySet($key, $value);

            return;
        }

        $trimmed = is_string($value) ? trim($value) : '';
        $stored = $trimmed !== '' ? $trimmed : null;

        static::query()->updateOrCreate(
            ['key' => $key],
            ['value' => $stored],
        );
    }

    public static function treasuryAddress(): string
    {
        $fromDb = static::get(static::KEY_ADDRESS);

        if ($fromDb !== null && $fromDb !== '') {
            return $fromDb;
        }

        return (string) config('wallet.admin_bep20_address');
    }

    public static function treasuryNetworkLabel(): string
    {
        $fromDb = static::get(static::KEY_NETWORK_LABEL);

        if ($fromDb !== null && $fromDb !== '') {
            return $fromDb;
        }

        return (string) config('wallet.admin_network_label');
    }

    public static function depositAddressPayload(): array
    {
        $address = static::treasuryAddress();
        $network = static::treasuryNetworkLabel();
        $fromDb = static::get(static::KEY_ADDRESS);

        return [
            'address' => $address,
            'network' => $network,
            'usdt_contract' => (string) config('blockchain.contracts.usdt', config('wallet.usdt_contract_bep20')),
            'chain_id' => (int) config('blockchain.chain_id', 56),
            'is_testnet' => (int) config('blockchain.chain_id', 56) === 97,
            'min_confirmations' => (int) config('wallet.deposit_min_confirmations', 12),
            'source' => is_string($fromDb) && trim($fromDb) !== '' ? 'database' : 'env',
        ];
    }

    public static function icoContractAddress(): string
    {
        return static::firstNonEmpty(
            static::get(static::KEY_ICO_CONTRACT),
            (string) config('blockchain.contracts.ico_reserve', ''),
        );
    }

    public static function raceIcoContractAddress(): string
    {
        return static::firstNonEmpty(
            static::get(static::KEY_RACE_ICO_CONTRACT),
            (string) config('blockchain.contracts.ico', ''),
        );
    }

    public static function icoAdminWallet(): string
    {
        return static::firstNonEmpty(
            static::get(static::KEY_ICO_ADMIN_WALLET),
            (string) config('blockchain.contracts.ico_admin_wallet', ''),
        );
    }

    public static function incomeHoldAddress(): string
    {
        return static::firstNonEmpty(
            static::get(static::KEY_INCOME_HOLD),
            (string) config('blockchain.contracts.income_hold', ''),
        );
    }

    private static function firstNonEmpty(?string ...$values): string
    {
        foreach ($values as $value) {
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        return '';
    }

    public static function bonzaBusterEnabled(): bool
    {
        $fromDb = static::get(static::KEY_BONZA_BUSTER_ENABLED);

        if ($fromDb !== null) {
            return in_array(strtolower($fromDb), ['1', 'true', 'yes', 'on'], true);
        }

        return (bool) config('reward_plan.bonza_buster.enabled', true);
    }

    public static function bonzaBusterDirectPercent(): float
    {
        $fromDb = static::get(static::KEY_BONZA_BUSTER_DIRECT_PERCENT);

        if ($fromDb !== null && is_numeric($fromDb)) {
            return max(0.0, (float) $fromDb);
        }

        return max(0.0, (float) (config('reward_plan.bonza_buster.direct_percent') ?? 3.0));
    }

    private static function usesKeyValueSchema(): bool
    {
        static $cached = null;

        if ($cached !== null) {
            return $cached;
        }

        $cached = Schema::hasColumn((new static)->getTable(), 'key');

        return $cached;
    }

    private static function legacyGet(string $key, ?string $default): ?string
    {
        $row = static::query()->first();

        if (! $row) {
            return $default;
        }

        $column = match ($key) {
            static::KEY_ADDRESS => 'admin_wallet_bep20',
            static::KEY_NETWORK_LABEL => 'admin_network_label',
            default => null,
        };

        if ($column === null) {
            return $default;
        }

        $value = $row->{$column};

        if (is_string($value) && trim($value) !== '') {
            return trim($value);
        }

        return $default;
    }

    private static function legacySet(string $key, ?string $value): void
    {
        $column = match ($key) {
            static::KEY_ADDRESS => 'admin_wallet_bep20',
            static::KEY_NETWORK_LABEL => 'admin_network_label',
            default => null,
        };

        if ($column === null) {
            return;
        }

        $row = static::query()->first();

        if (! $row) {
            $row = static::query()->create([
                'admin_wallet_bep20' => null,
                'admin_network_label' => null,
            ]);
        }

        $trimmed = is_string($value) ? trim($value) : '';
        $row->{$column} = $trimmed !== '' ? $trimmed : null;
        $row->save();
    }
}
