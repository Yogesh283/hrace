<?php

namespace Tests\Feature;

use App\Models\LendingAdminAction;
use App\Models\OnChainLendingPosition;
use App\Models\User;
use App\Services\Lending\LendingUserAccessService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class LendingUserBlockTest extends TestCase
{
    use RefreshDatabase;

    private function adminWithPermissions(array $perms = ['lending.user.block' => true, 'lending.user.unblock' => true]): User
    {
        return User::factory()->create([
            'permissions' => $perms,
        ]);
    }

    public function test_admin_can_block_user(): void
    {
        $admin = $this->adminWithPermissions();
        $member = User::factory()->create(['wallet_address' => '0xabcabcabcabcabcabcabcabcabcabcabcabcab']);

        app(LendingUserAccessService::class)->block($member, $admin, 'Policy violation');

        $member->refresh();
        $this->assertSame(User::LENDING_STATUS_BLOCKED, $member->lending_user_status);
        $this->assertSame($admin->id, $member->lending_blocked_by);
        $this->assertSame('Policy violation', $member->lending_block_reason);
    }

    public function test_non_admin_cannot_block_user(): void
    {
        $member = User::factory()->create();
        $other = User::factory()->create();

        $this->expectException(AuthorizationException::class);
        app(LendingUserAccessService::class)->block($member, $other, 'Attempt');
    }

    public function test_block_reason_required(): void
    {
        $admin = $this->adminWithPermissions();
        $member = User::factory()->create();

        $this->expectException(InvalidArgumentException::class);
        app(LendingUserAccessService::class)->block($member, $admin, '   ');
    }

    public function test_blocked_user_cannot_create_lending_and_receives_403(): void
    {
        $member = User::factory()->create([
            'lending_user_status' => User::LENDING_STATUS_BLOCKED,
            'lending_block_reason' => 'Frozen',
        ]);

        $this->actingAs($member)
            ->postJson(route('lending.smart.store'), ['selected_amount' => 100])
            ->assertForbidden()
            ->assertJson([
                'success' => false,
                'code' => 'LENDING_ID_BLOCKED',
            ]);

        $this->actingAs($member)
            ->postJson(route('lending.smart_pro.store'), [
                'selected_amount' => 500,
                'repayment_option' => '30',
            ])
            ->assertForbidden();

        $this->actingAs($member)
            ->postJson(route('lending.repayment_plan.store'), [
                'position_id' => 1,
                'repayment_option' => '90',
            ])
            ->assertForbidden();
    }

    public function test_blocked_user_can_still_view_lending_history_page(): void
    {
        $wallet = '0xdefdefdefdefdefdefdefdefdefdefdefdefde';
        $member = User::factory()->create([
            'wallet_address' => $wallet,
            'lending_user_status' => User::LENDING_STATUS_BLOCKED,
            'lending_block_reason' => 'Review',
        ]);

        OnChainLendingPosition::query()->create([
            'chain_id' => 97,
            'contract_address' => '0x1111111111111111111111111111111111111111',
            'position_id' => 7,
            'wallet_address' => strtolower($wallet),
            'product_type' => 'SmartLending',
            'selected_amount' => 100,
            'security_amount' => 20,
            'disbursement_amount' => 80,
            'repayment_amount' => 80,
            'status' => 'Active',
        ]);

        $this->actingAs($member)
            ->get(route('lending'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Lending')
                ->where('lending_access.status', User::LENDING_STATUS_BLOCKED)
                ->where('lending_access.reason', 'Review')
                ->has('positions', 1));
    }

    public function test_admin_can_unblock_and_user_can_create_lending_again(): void
    {
        $admin = $this->adminWithPermissions();
        $member = User::factory()->create([
            'lending_user_status' => User::LENDING_STATUS_BLOCKED,
            'lending_block_reason' => 'Temp',
        ]);

        app(LendingUserAccessService::class)->unblock($member, $admin, 'Cleared');
        $member->refresh();

        $this->assertSame(User::LENDING_STATUS_ACTIVE, $member->lending_user_status);
        $this->assertNull($member->lending_block_reason);

        $this->actingAs($member)
            ->postJson(route('lending.smart.store'), ['selected_amount' => 100])
            ->assertOk()
            ->assertJson(['success' => true]);
    }

    public function test_block_and_unblock_create_audit_logs(): void
    {
        $admin = $this->adminWithPermissions();
        $member = User::factory()->create();
        $service = app(LendingUserAccessService::class);

        $service->block($member, $admin, 'Audit block');
        $service->unblock($member, $admin, 'Audit unblock');

        $this->assertDatabaseCount('lending_admin_actions', 2);
        $this->assertSame(1, LendingAdminAction::query()->where('action', LendingAdminAction::ACTION_BLOCK)->count());
        $this->assertSame(1, LendingAdminAction::query()->where('action', LendingAdminAction::ACTION_UNBLOCK)->count());
    }

    public function test_existing_lending_position_not_deleted_or_modified_on_block(): void
    {
        $wallet = '0xaaa1111111111111111111111111111111111111';
        $admin = $this->adminWithPermissions();
        $member = User::factory()->create(['wallet_address' => $wallet]);

        $position = OnChainLendingPosition::query()->create([
            'chain_id' => 97,
            'contract_address' => '0x2222222222222222222222222222222222222222',
            'position_id' => 3,
            'wallet_address' => strtolower($wallet),
            'product_type' => 'SmartPro',
            'selected_amount' => 500,
            'security_amount' => 150,
            'disbursement_amount' => 350,
            'repayment_amount' => 350,
            'race_position_notional' => 500,
            'status' => 'Active',
        ]);

        app(LendingUserAccessService::class)->block($member, $admin, 'Hold new only');

        $position->refresh();
        $this->assertSame('500.00000000', $position->selected_amount);
        $this->assertSame('150.00000000', $position->security_amount);
        $this->assertSame('500.00000000', $position->race_position_notional);
        $this->assertDatabaseCount('on_chain_lending_positions', 1);
    }

    public function test_active_user_frontend_status(): void
    {
        $member = User::factory()->create([
            'lending_user_status' => User::LENDING_STATUS_ACTIVE,
        ]);

        $this->actingAs($member)
            ->get(route('lending'))
            ->assertInertia(fn ($page) => $page
                ->where('lending_access.status', User::LENDING_STATUS_ACTIVE)
                ->where('lending_access.blocked', false));
    }

    public function test_blocked_user_frontend_status(): void
    {
        $member = User::factory()->create([
            'lending_user_status' => User::LENDING_STATUS_BLOCKED,
            'lending_block_reason' => 'Compliance',
        ]);

        $this->actingAs($member)
            ->get(route('lending'))
            ->assertInertia(fn ($page) => $page
                ->where('lending_access.blocked', true)
                ->where('lending_access.reason', 'Compliance'));
    }
}
