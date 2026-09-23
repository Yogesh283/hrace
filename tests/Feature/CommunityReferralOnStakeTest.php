<?php

namespace Tests\Feature;

use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\InvestmentRecorder;
use App\Services\Income\LedgerWriter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommunityReferralOnStakeTest extends TestCase
{
    use RefreshDatabase;

    public function test_staking_pays_one_time_l1_referral_at_3_percent(): void
    {
        $sponsor = User::factory()->create([
            'participation_activated_at' => now(),
        ]);
        $member = User::factory()->create([
            'referred_by' => $sponsor->id,
            'participation_activated_at' => now(),
        ]);

        app(LedgerWriter::class)->record(
            $member,
            LedgerEntry::TYPE_WALLET_DEPOSIT,
            '200.00',
            'test',
            null,
            ['note' => 'seed'],
        );

        $inv = app(InvestmentRecorder::class)->record($member, '100.00', 180);

        $entry = LedgerEntry::query()
            ->where('user_id', $sponsor->id)
            ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_REFERRAL)
            ->where('reference_type', 'investment')
            ->where('reference_id', $inv->id)
            ->first();

        $this->assertNotNull($entry);
        $this->assertEqualsWithDelta(3.0, (float) $entry->amount_usd, 0.001);
        $this->assertSame(1, (int) ($entry->meta['level'] ?? 0));
        $this->assertEqualsWithDelta(3.0, (float) ($entry->meta['percent'] ?? 0), 0.001);
    }

    public function test_sub_fifty_stake_pays_no_community_referral(): void
    {
        $sponsor = User::factory()->create([
            'participation_activated_at' => now(),
        ]);
        $member = User::factory()->create([
            'referred_by' => $sponsor->id,
            'participation_activated_at' => now(),
        ]);

        app(LedgerWriter::class)->record(
            $member,
            LedgerEntry::TYPE_WALLET_DEPOSIT,
            '100.00',
            'test',
            null,
            ['note' => 'seed'],
        );

        $inv = app(InvestmentRecorder::class)->record($member, '40.00', 0);

        $this->assertSame(
            0,
            LedgerEntry::query()
                ->where('user_id', $sponsor->id)
                ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_REFERRAL)
                ->where('reference_id', $inv->id)
                ->count(),
        );
    }

    public function test_l2_sponsor_earns_1_percent_one_time(): void
    {
        // Self-active only — no N-directs gate.
        $l2 = User::factory()->create([
            'participation_activated_at' => now(),
        ]);
        $l1 = User::factory()->create([
            'referred_by' => $l2->id,
            'participation_activated_at' => now(),
        ]);
        $member = User::factory()->create([
            'referred_by' => $l1->id,
            'participation_activated_at' => now(),
        ]);

        app(LedgerWriter::class)->record(
            $member,
            LedgerEntry::TYPE_WALLET_DEPOSIT,
            '200.00',
            'test',
            null,
            ['note' => 'seed'],
        );

        $inv = app(InvestmentRecorder::class)->record($member, '100.00', 180);

        $l1Pay = LedgerEntry::query()
            ->where('user_id', $l1->id)
            ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_REFERRAL)
            ->where('reference_id', $inv->id)
            ->first();
        $this->assertNotNull($l1Pay);
        $this->assertEqualsWithDelta(3.0, (float) $l1Pay->amount_usd, 0.001);

        $l2Pay = LedgerEntry::query()
            ->where('user_id', $l2->id)
            ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_REFERRAL)
            ->where('reference_id', $inv->id)
            ->where('meta->level', 2)
            ->first();

        $this->assertNotNull($l2Pay);
        $this->assertEqualsWithDelta(1.0, (float) $l2Pay->amount_usd, 0.001);
    }

    public function test_l2_still_pays_with_only_one_direct_when_self_active(): void
    {
        $l2 = User::factory()->create(['participation_activated_at' => now()]);
        $l1 = User::factory()->create([
            'referred_by' => $l2->id,
            'participation_activated_at' => now(),
        ]);
        $member = User::factory()->create([
            'referred_by' => $l1->id,
            'participation_activated_at' => now(),
        ]);

        app(LedgerWriter::class)->record($member, LedgerEntry::TYPE_WALLET_DEPOSIT, '200.00', 'test', null, []);
        $inv = app(InvestmentRecorder::class)->record($member, '100.00', 180);

        $this->assertNotNull(
            LedgerEntry::query()
                ->where('user_id', $l1->id)
                ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_REFERRAL)
                ->where('reference_id', $inv->id)
                ->first(),
        );

        $l2Pay = LedgerEntry::query()
            ->where('user_id', $l2->id)
            ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_REFERRAL)
            ->where('reference_id', $inv->id)
            ->where('meta->level', 2)
            ->first();

        $this->assertNotNull($l2Pay);
        $this->assertEqualsWithDelta(1.0, (float) $l2Pay->amount_usd, 0.001);
    }

    public function test_l2_skipped_when_upline_not_self_active(): void
    {
        $l2 = User::factory()->create(['participation_activated_at' => null]);
        $l1 = User::factory()->create([
            'referred_by' => $l2->id,
            'participation_activated_at' => now(),
        ]);
        $member = User::factory()->create([
            'referred_by' => $l1->id,
            'participation_activated_at' => now(),
        ]);

        app(LedgerWriter::class)->record($member, LedgerEntry::TYPE_WALLET_DEPOSIT, '200.00', 'test', null, []);
        $inv = app(InvestmentRecorder::class)->record($member, '100.00', 180);

        $this->assertNotNull(
            LedgerEntry::query()
                ->where('user_id', $l1->id)
                ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_REFERRAL)
                ->where('reference_id', $inv->id)
                ->first(),
        );

        $this->assertSame(
            0,
            LedgerEntry::query()
                ->where('user_id', $l2->id)
                ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_REFERRAL)
                ->where('reference_id', $inv->id)
                ->count(),
        );
    }

    public function test_l3_to_l5_pay_when_each_upline_is_self_active(): void
    {
        $users = [];
        $parentId = null;
        for ($i = 5; $i >= 1; $i--) {
            $users[$i] = User::factory()->create([
                'referred_by' => $parentId,
                'participation_activated_at' => now(),
            ]);
            $parentId = $users[$i]->id;
        }

        $staker = User::factory()->create([
            'referred_by' => $users[1]->id,
            'participation_activated_at' => now(),
        ]);

        app(LedgerWriter::class)->record($staker, LedgerEntry::TYPE_WALLET_DEPOSIT, '500.00', 'test', null, []);
        $inv = app(InvestmentRecorder::class)->record($staker, '100.00', 180);

        $expected = [
            1 => 3.0,
            2 => 1.0,
            3 => 1.0,
            4 => 0.50,
            5 => 0.25,
        ];

        foreach ($expected as $level => $amount) {
            $entry = LedgerEntry::query()
                ->where('user_id', $users[$level]->id)
                ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_REFERRAL)
                ->where('reference_id', $inv->id)
                ->where('meta->level', $level)
                ->first();

            $this->assertNotNull($entry, "Expected L{$level} community referral");
            $this->assertEqualsWithDelta($amount, (float) $entry->amount_usd, 0.001);
        }
    }
}
