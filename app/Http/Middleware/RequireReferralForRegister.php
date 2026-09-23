<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireReferralForRegister
{
    /**
     * Normalize invitation links; sponsor code is validated on registration submit.
     *
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $code = $this->normalizeCode($request->query('join_code'));

        if ($code === null) {
            return $next($request);
        }

        if (! $this->isValidReferralCode($code)) {
            return redirect()
                ->route('register')
                ->with(
                    'status',
                    __('That invitation code is not valid. Enter your sponsor\'s 8-character join code below.'),
                );
        }

        if ($request->query('join_code') !== $code) {
            return redirect()->route('register', ['join_code' => $code]);
        }

        return $next($request);
    }

    private function normalizeCode(mixed $value): ?string
    {
        if (! is_string($value) && ! is_numeric($value)) {
            return null;
        }

        $code = strtoupper(preg_replace('/\s+/', '', (string) $value) ?? '');

        return strlen($code) === 8 ? $code : null;
    }

    private function isValidReferralCode(string $code): bool
    {
        return User::query()
            ->where('referral_code', $code)
            ->where('is_blocked', false)
            ->exists();
    }
}
