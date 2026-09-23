<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\JsonResponse;

final class LendingAccessGuard
{
    public const CODE_BLOCKED = 'LENDING_ID_BLOCKED';

    public static function isActive(User $user): bool
    {
        return $user->isLendingAccessActive();
    }

    public static function blockedJsonResponse(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'code' => self::CODE_BLOCKED,
            'message' => 'Your Lending ID is currently blocked.',
        ], 403);
    }

    public static function abortIfBlocked(User $user): ?JsonResponse
    {
        if (! self::isActive($user)) {
            return self::blockedJsonResponse();
        }

        return null;
    }
}
