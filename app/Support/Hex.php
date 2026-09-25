<?php

namespace App\Support;

/**
 * Safe hex helpers — never use ltrim($hex, '0x') (strips ALL leading zeros).
 */
final class Hex
{
    public static function stripPrefix(string $hex): string
    {
        $hex = strtolower(trim($hex));
        if (str_starts_with($hex, '0x')) {
            return substr($hex, 2);
        }

        return $hex;
    }

    public static function wordToDecimal(string $hex64): string
    {
        $hex = ltrim(self::stripPrefix($hex64), '0');
        if ($hex === '') {
            return '0';
        }

        return function_exists('gmp_init')
            ? gmp_strval(gmp_init($hex, 16), 10)
            : (string) hexdec($hex);
    }
}
