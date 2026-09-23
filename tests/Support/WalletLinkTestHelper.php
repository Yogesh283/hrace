<?php

namespace Tests\Support;

use Symfony\Component\Process\Process;

final class WalletLinkTestHelper
{
    /** Hardhat account #1 — test only. */
    public const PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

    public const ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

    public static function signPersonalMessage(string $message): string
    {
        $script = base_path('tests/Support/sign-personal-message.cjs');
        $process = new Process([
            'node',
            $script,
            $message,
            self::PRIVATE_KEY,
        ], base_path(), null, null, 30);

        $process->mustRun();

        return trim($process->getOutput());
    }
}
