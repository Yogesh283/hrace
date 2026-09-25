<?php

namespace Tests\Feature;

use App\Models\BlockchainEvent;
use App\Models\User;
use App\Services\Blockchain\OnChainLevelIncomeRows;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OnChainLevelIncomeRowsTest extends TestCase
{
    use RefreshDatabase;

    public function test_level_income_row_shows_from_member_race_amount_and_usdt_value(): void
    {
        $sponsor = User::factory()->create(['wallet_address' => '0x1111111111111111111111111111111111111111']);
        $buyer = User::factory()->create([
            'wallet_address' => '0x2222222222222222222222222222222222222222',
            'name' => 'Downline Buyer',
        ]);

        $data = '0x'
            .str_pad(dechex(1), 64, '0', STR_PAD_LEFT)
            .str_pad(gmp_strval(gmp_init('3000000000000000000', 10), 16), 64, '0', STR_PAD_LEFT)
            .str_pad(gmp_strval(gmp_init('2500000000000000000', 10), 16), 64, '0', STR_PAD_LEFT);

        BlockchainEvent::query()->create([
            'user_id' => $sponsor->id,
            'wallet_address' => '0x1111111111111111111111111111111111111111',
            'contract_address' => '0xa0791fae5ffa14d0ebba7e2c4f4710342dfddd5d',
            'event_name' => 'CommunityReferralPaid',
            'tx_hash' => '0x'.str_repeat('b', 64),
            'log_index' => 3,
            'block_number' => 100,
            'payload' => [
                'topics' => [
                    '0xae4ee54fa5e43b33c459251efe0d9f141e6991f03a684990d560e7222f990966',
                    '0x0000000000000000000000001111111111111111111111111111111111111111',
                    '0x0000000000000000000000002222222222222222222222222222222222222222',
                ],
                'data' => $data,
            ],
        ]);

        $rows = app(OnChainLevelIncomeRows::class)->forUser($sponsor);

        $this->assertCount(1, $rows);
        $this->assertSame('RACE', $rows[0]['asset']);
        $this->assertSame('2.5000', $rows[0]['amount_race']);
        $this->assertSame('3.00', $rows[0]['amount_usd']);
        $this->assertSame(1, $rows[0]['level']);
        $this->assertStringContainsString('Downline Buyer', $rows[0]['from_member']);

        $totals = app(OnChainLevelIncomeRows::class)->totalsForUser($sponsor);
        $this->assertSame('2.5000', $totals['race']);
        $this->assertSame('3.00', $totals['usdt']);

        $this->assertSame([], app(OnChainLevelIncomeRows::class)->forUser($buyer));
    }
}
