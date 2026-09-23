<?php

namespace App\Services;

use InvalidArgumentException;
use kornrunner\Keccak;
use Web3p\EthereumUtil\Util;

class WalletAuthService
{
    private const NONCE_TTL_MINUTES = 5;

    public function normalizeAddress(string $address): string
    {
        $address = strtolower(trim($address));

        if (! preg_match('/^0x[a-f0-9]{40}$/', $address)) {
            throw new InvalidArgumentException(__('Invalid wallet address.'));
        }

        return $address;
    }

    public function issueNonce(string $address, string $action, ?string $joinCode = null): array
    {
        $address = $this->normalizeAddress($address);
        $action = $action === 'register' ? 'register' : 'login';
        $nonce = bin2hex(random_bytes(16));

        cache()->put($this->cacheKey($address), [
            'nonce' => $nonce,
            'action' => $action,
            'join_code' => $joinCode ? strtoupper($joinCode) : null,
        ], now()->addMinutes(self::NONCE_TTL_MINUTES));

        return [
            'nonce' => $nonce,
            'message' => $this->buildMessage($address, $nonce, $action, $joinCode),
        ];
    }

    public function buildMessage(string $address, string $nonce, string $action, ?string $joinCode = null): string
    {
        $address = $this->normalizeAddress($address);
        $lines = [
            'Sign in to '.config('app.name'),
            '',
            'Action: '.$action,
            'Wallet: '.$address,
            'Nonce: '.$nonce,
        ];

        if ($action === 'register' && $joinCode) {
            $lines[] = 'Join code: '.strtoupper($joinCode);
        }

        return implode("\n", $lines);
    }

    /**
     * @return array{valid: bool, join_code: ?string}
     */
    public function verifySignature(string $address, string $signature, string $expectedAction): array
    {
        $address = $this->normalizeAddress($address);
        $payload = cache()->pull($this->cacheKey($address));

        if (! is_array($payload) || empty($payload['nonce'])) {
            return ['valid' => false, 'join_code' => null];
        }

        if (($payload['action'] ?? '') !== $expectedAction) {
            return ['valid' => false, 'join_code' => null];
        }

        $message = $this->buildMessage(
            $address,
            $payload['nonce'],
            $expectedAction,
            $payload['join_code'] ?? null,
        );

        try {
            $recovered = $this->recoverAddressFromPersonalSign($message, $signature);
        } catch (InvalidArgumentException) {
            return ['valid' => false, 'join_code' => null];
        }

        if ($recovered !== $address) {
            return ['valid' => false, 'join_code' => null];
        }

        return [
            'valid' => true,
            'join_code' => $payload['join_code'] ?? null,
        ];
    }

    public function recoverAddressFromPersonalSign(string $message, string $signature): string
    {
        $util = new Util;
        $hash = $util->hashPersonalMessage($message);

        $sig = str_replace('0x', '', strtolower(trim($signature)));
        if (strlen($sig) !== 130) {
            throw new InvalidArgumentException(__('Invalid signature length.'));
        }

        $r = substr($sig, 0, 64);
        $s = substr($sig, 64, 64);
        $v = hexdec(substr($sig, 128, 2));
        $recoveryParam = $v >= 27 ? $v - 27 : $v;

        $publicKey = $util->recoverPublicKey($hash, $r, $s, $recoveryParam);
        $publicKeyHex = str_starts_with($publicKey, '0x') ? substr($publicKey, 2) : $publicKey;

        if (str_starts_with($publicKeyHex, '04')) {
            $publicKeyHex = substr($publicKeyHex, 2);
        }

        $addressHash = Keccak::hash(hex2bin($publicKeyHex), 256);

        return '0x'.substr($addressHash, -40);
    }

    public function walletDisplayName(string $address): string
    {
        $address = $this->normalizeAddress($address);

        return substr($address, 0, 6).'…'.substr($address, -4);
    }

    public function syntheticEmail(string $address): string
    {
        return $this->normalizeAddress($address).'@wallet.rynex';
    }

    private function cacheKey(string $address): string
    {
        return 'wallet_auth:'.strtolower($address);
    }

    /**
     * Bind an authenticated Laravel user to a wallet (withdrawal / on-chain identity).
     *
     * @return array{nonce: string, message: string}
     */
    public function issueWalletLinkNonce(int $userId, string $address): array
    {
        $address = $this->normalizeAddress($address);
        $nonce = bin2hex(random_bytes(16));

        cache()->put($this->walletLinkCacheKey($userId, $address), [
            'nonce' => $nonce,
            'user_id' => $userId,
            'address' => $address,
        ], now()->addMinutes(self::NONCE_TTL_MINUTES));

        return [
            'nonce' => $nonce,
            'message' => $this->buildWalletLinkMessage($userId, $address, $nonce),
        ];
    }

    public function verifyWalletLinkSignature(int $userId, string $address, string $signature): bool
    {
        $address = $this->normalizeAddress($address);
        $payload = cache()->pull($this->walletLinkCacheKey($userId, $address));

        if (! is_array($payload) || empty($payload['nonce'])) {
            return false;
        }

        if ((int) ($payload['user_id'] ?? 0) !== $userId) {
            return false;
        }

        if (($payload['address'] ?? '') !== $address) {
            return false;
        }

        $message = $this->buildWalletLinkMessage(
            $userId,
            $address,
            (string) $payload['nonce'],
        );

        try {
            $recovered = $this->recoverAddressFromPersonalSign($message, $signature);
        } catch (\Throwable) {
            return false;
        }

        return $recovered === $address;
    }

    public function buildWalletLinkMessage(int $userId, string $address, string $nonce): string
    {
        $address = $this->normalizeAddress($address);

        return implode("\n", [
            'Link wallet to '.config('app.name'),
            '',
            'Action: connect',
            'User ID: '.$userId,
            'Wallet: '.$address,
            'Nonce: '.$nonce,
        ]);
    }

    private function walletLinkCacheKey(int $userId, string $address): string
    {
        return 'wallet_link:'.$userId.':'.strtolower($address);
    }
}
