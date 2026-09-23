<?php

namespace Tests\Feature;

use App\Models\IncomeWalletTransaction;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\LedgerWriter;
use App\Services\Income\VirtualIncomeWalletService;
use App\Services\Income\WithdrawalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class WithdrawalRateLimitTest extends TestCase
{
    use RefreshDatabase;

    private function seedBalance(User $user, string $amount = '500.00'): void
    {
        app(VirtualIncomeWalletService::class)->credit(
            $user,
            IncomeWalletTransaction::TYPE_ADJUSTMENT,
            $amount,
            'test:seed',
            'test_virtual_seed:'.$user->id,
            ['note' => 'seed'],
        );
    }

    public function test_allows_two_withdrawals_within_24_hours(): void
    {
        $user = User::factory()->create(['participation_activated_at' => now()]);
        $this->seedBalance($user);
        $svc = app(WithdrawalService::class);
        $addr = '0x1234567890123456789012345678901234567890';

        $svc->request($user, '10', $addr);
        $svc->request($user, '10', $addr);

        $status = $svc->rateLimitStatus($user);
        $this->assertSame(2, $status['used_in_window']);
        $this->assertFalse($status['can_request']);
        $this->assertNotNull($status['next_available_at']);
    }

    public function test_third_withdrawal_blocked_until_oldest_slot_frees(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-07 17:00:00'));

        $user = User::factory()->create(['participation_activated_at' => now()]);
        $this->seedBalance($user);
        $svc = app(WithdrawalService::class);
        $addr = '0x1234567890123456789012345678901234567890';

        $svc->request($user, '10', $addr);
        Carbon::setTestNow(Carbon::parse('2026-08-07 18:00:00'));
        $svc->request($user, '10', $addr);

        try {
            $svc->request($user, '10', $addr);
            $this->fail('Expected ValidationException for third withdrawal');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('amount_usd', $e->errors());
        }

        Carbon::setTestNow();
    }

    public function test_next_available_after_24h_from_oldest(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-07 17:00:00'));

        $user = User::factory()->create(['participation_activated_at' => now()]);
        $this->seedBalance($user);
        $svc = app(WithdrawalService::class);
        $addr = '0x1234567890123456789012345678901234567890';

        $svc->request($user, '10', $addr);
        Carbon::setTestNow(Carbon::parse('2026-08-07 18:00:00'));
        $svc->request($user, '10', $addr);

        $status = $svc->rateLimitStatus($user);
        $this->assertFalse($status['can_request']);
        $this->assertTrue(
            Carbon::parse($status['next_available_at'])->equalTo(Carbon::parse('2026-08-08 17:00:00')),
        );

        // After tomorrow 5 PM, first slot frees → can request again
        Carbon::setTestNow(Carbon::parse('2026-08-08 17:00:01'));
        $status2 = $svc->rateLimitStatus($user);
        $this->assertTrue($status2['can_request']);
        $this->assertSame(1, $status2['used_in_window']);

        $svc->request($user, '10', $addr);

        // Still blocked until 6 PM (second original slot)
        $status3 = $svc->rateLimitStatus($user);
        $this->assertFalse($status3['can_request']);

        Carbon::setTestNow(Carbon::parse('2026-08-08 18:00:01'));
        $this->assertTrue($svc->rateLimitStatus($user)['can_request']);

        Carbon::setTestNow();
    }
}
