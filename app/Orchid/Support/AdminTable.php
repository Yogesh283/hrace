<?php

declare(strict_types=1);

namespace App\Orchid\Support;

use App\Support\MemberCode;
use Illuminate\Support\Carbon;

final class AdminTable
{
    public static function badge(string $label, string $tone = 'default'): string
    {
        return '<span class="rx-admin-badge rx-admin-badge--'.e($tone).'">'.e($label).'</span>';
    }

    public static function level(int $level): string
    {
        $tone = match (true) {
            $level >= 7 => 'gold',
            $level >= 4 => 'vip',
            default => 'default',
        };

        return self::badge('L'.$level, $tone);
    }

    public static function blocked(bool $blocked): string
    {
        return $blocked
            ? self::badge(__('Blocked'), 'danger')
            : self::badge(__('Active'), 'success');
    }

    public static function lendingStatus(string $status): string
    {
        return strtoupper($status) === 'BLOCKED'
            ? self::badge(__('BLOCKED'), 'danger')
            : self::badge(__('ACTIVE'), 'success');
    }

    public static function mono(?string $value): string
    {
        if ($value === null || $value === '') {
            return self::text(null);
        }

        return '<span class="rx-tbl-mono">'.e($value).'</span>';
    }

    public static function withdrawals(bool $allowed): string
    {
        return $allowed
            ? self::badge(__('Allowed'), 'success')
            : self::badge(__('Off'), 'danger');
    }

    public static function otpStatus(?string $consumedAt, $expiresAt): string
    {
        if ($consumedAt !== null) {
            return self::badge(__('Used'), 'muted');
        }

        if ($expiresAt && $expiresAt < now()) {
            return self::badge(__('Expired'), 'danger');
        }

        return self::badge(__('Live'), 'success');
    }

    public static function id(int|string|null $id): string
    {
        return '<span class="rx-tbl-id">#'.e((string) $id).'</span>';
    }

    public static function money(float|string|null $amount, string $prefix = '$'): string
    {
        $n = number_format((float) ($amount ?? 0), 2, '.', ',');

        return '<span class="rx-tbl-money">'.$prefix.e($n).'</span>';
    }

    public static function member(?string $name, ?string $email, ?int $memberNumber = null): string
    {
        $code = $memberNumber !== null
            ? '<span class="rx-admin-code">'.e(MemberCode::format($memberNumber)).'</span> '
            : '';

        $nameLine = $name !== null && $name !== ''
            ? '<span class="rx-tbl-member__name">'.e($name).'</span>'
            : '';
        $emailLine = $email !== null && $email !== ''
            ? '<span class="rx-tbl-member__email">'.e($email).'</span>'
            : '';

        if ($nameLine === '' && $emailLine === '') {
            return '—';
        }

        return '<div class="rx-tbl-member">'.$code.$nameLine.$emailLine.'</div>';
    }

    public static function dateTime(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '<span class="rx-tbl-muted">—</span>';
        }

        $dt = $value instanceof Carbon ? $value : Carbon::parse($value);

        return '<div class="rx-tbl-date"><span class="rx-tbl-date__main">'.$dt->format('M j, Y').'</span>'
            .'<span class="rx-tbl-date__sub">'.$dt->format('H:i').'</span></div>';
    }

    public static function text(?string $value): string
    {
        return ($value !== null && $value !== '')
            ? '<span class="rx-tbl-text">'.e($value).'</span>'
            : '<span class="rx-tbl-muted">—</span>';
    }
}
