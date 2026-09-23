<?php

namespace App\Support;

class MemberCode
{
    public const PREFIX = 'RC';

    public static function format(?int $memberNumber, bool $withHash = false): string
    {
        if ($memberNumber === null) {
            return ($withHash ? '#' : '').self::PREFIX.'—';
        }

        $code = self::PREFIX.str_pad((string) $memberNumber, 4, '0', STR_PAD_LEFT);

        return $withHash ? '#'.$code : $code;
    }
}
