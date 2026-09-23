<?php

namespace App\Services\Lending;

use App\Models\LendingAdminAction;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class LendingUserAccessService
{
    public function block(User $target, User $admin, string $reason): void
    {
        $this->assertCanBlock($admin);
        $reason = trim($reason);
        if ($reason === '') {
            throw new InvalidArgumentException('Block reason is required.');
        }

        DB::transaction(function () use ($target, $admin, $reason): void {
            $before = $this->snapshot($target);

            $target->forceFill([
                'lending_user_status' => User::LENDING_STATUS_BLOCKED,
                'lending_blocked_at' => now(),
                'lending_blocked_by' => $admin->id,
                'lending_block_reason' => $reason,
            ])->save();

            LendingAdminAction::query()->create([
                'user_id' => $target->id,
                'admin_id' => $admin->id,
                'action' => LendingAdminAction::ACTION_BLOCK,
                'reason' => $reason,
                'metadata' => [
                    'before' => $before,
                    'after' => $this->snapshot($target),
                ],
            ]);
        });
    }

    public function unblock(User $target, User $admin, ?string $reason = null): void
    {
        $this->assertCanUnblock($admin);

        DB::transaction(function () use ($target, $admin, $reason): void {
            $before = $this->snapshot($target);
            $historicalReason = $target->lending_block_reason;

            $target->forceFill([
                'lending_user_status' => User::LENDING_STATUS_ACTIVE,
                'lending_blocked_at' => null,
                'lending_blocked_by' => null,
                'lending_block_reason' => null,
            ])->save();

            LendingAdminAction::query()->create([
                'user_id' => $target->id,
                'admin_id' => $admin->id,
                'action' => LendingAdminAction::ACTION_UNBLOCK,
                'reason' => $reason !== null && trim($reason) !== '' ? trim($reason) : null,
                'metadata' => [
                    'before' => $before,
                    'after' => $this->snapshot($target),
                    'previous_block_reason' => $historicalReason,
                ],
            ]);
        });
    }

    public function assertCanBlock(User $admin): void
    {
        if (! $admin->hasAccess('lending.user.block')) {
            throw new AuthorizationException('Missing lending.user.block permission.');
        }
    }

    public function assertCanUnblock(User $admin): void
    {
        if (! $admin->hasAccess('lending.user.unblock')) {
            throw new AuthorizationException('Missing lending.user.unblock permission.');
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function snapshot(User $user): array
    {
        return [
            'lending_user_status' => $user->lending_user_status,
            'lending_blocked_at' => $user->lending_blocked_at?->toIso8601String(),
            'lending_blocked_by' => $user->lending_blocked_by,
            'lending_block_reason' => $user->lending_block_reason,
        ];
    }
}
