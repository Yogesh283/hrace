<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Member\MemberActivationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MemberActivationStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_registered_user_is_not_shown_as_active_or_full_program(): void
    {
        $user = User::factory()->create([
            'is_blocked' => false,
            'id_activated_at' => null,
            'participation_activated_at' => null,
        ]);

        $status = app(MemberActivationService::class)->statusFor($user);

        $this->assertSame('inactive', $status['member_status']);
        $this->assertSame('pending', $status['id_status']);
        $this->assertSame('inactive', $status['participation_status']);
        $this->assertSame('participation_pending', $status['income_eligibility']);
        $this->assertSame('participation', $status['next_step']);
        $this->assertStringNotContainsString('Full program', (string) $status['income_eligibility_label']);
    }

    public function test_fifty_dollar_participation_activates_member_id_and_staking_together(): void
    {
        $user = User::factory()->create([
            'is_blocked' => false,
            'id_activated_at' => null,
            'participation_activated_at' => now(),
        ]);

        $status = app(MemberActivationService::class)->statusFor($user);

        $this->assertSame('active', $status['member_status']);
        $this->assertSame('active', $status['id_status']);
        $this->assertSame('Activated', $status['id_status_label']);
        $this->assertSame('active', $status['participation_status']);
        $this->assertSame('full', $status['income_eligibility']);
        $this->assertSame('none', $status['next_step']);
    }

    public function test_blocked_user_is_disabled(): void
    {
        $user = User::factory()->create([
            'is_blocked' => true,
            'participation_activated_at' => now(),
        ]);

        $status = app(MemberActivationService::class)->statusFor($user);

        $this->assertSame('inactive', $status['member_status']);
        $this->assertSame('pending', $status['id_status']);
        $this->assertSame('disabled', $status['income_eligibility']);
    }
}
