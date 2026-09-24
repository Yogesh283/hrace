<?php

namespace Tests\Feature;

use App\Models\IncomeWalletTransaction;
use App\Models\User;
use App\Services\Blockchain\CommunityReferralIndexer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommunityReferralMirrorIndexerTest extends TestCase
{
    use RefreshDatabase;

    public function test_community_referral_paid_mirrors_level_income_without_inflating_usdt_balance(): void
    {
        $sponsor = User::factory()->create([
            'wallet_address' => '0x1111111111111111111111111111111111111111',
        ]);

        $indexer = app(CommunityReferralIndexer::class);
        $sponsorTopic = '0x0000000000000000000000001111111111111111111111111111111111111111';
        $buyerTopic = '0x0000000000000000000000002222222222222222222222222222222222222222';
        $level = 1;
        $usdtWei = gmp_strval(gmp_init('3000000000000000000', 10)); // 3 USDT
        $raceWei = gmp_strval(gmp_init('3000000000000000000', 10));
        $data = '0x'
            .str_pad(dechex($level), 64, '0', STR_PAD_LEFT)
            .str_pad(gmp_strval(gmp_init($usdtWei, 10), 16), 64, '0', STR_PAD_LEFT)
            .str_pad(gmp_strval(gmp_init($raceWei, 10), 16), 64, '0', STR_PAD_LEFT);

        $indexer->ingestFromLog(
            ['0xae4ee54fa5e43b33c459251efe0d9f141e6991f03a684990d560e7222f990966', $sponsorTopic, $buyerTopic],
            $data,
            '0x'.str_repeat('a', 64),
            100,
            7,
        );

        $row = IncomeWalletTransaction::query()
            ->where('user_id', $sponsor->id)
            ->where('type', IncomeWalletTransaction::TYPE_LEVEL_INCOME)
            ->first();

        $this->assertNotNull($row);
        $this->assertSame('RACE', $row->asset);
        $this->assertTrue($row->metadata['on_chain_race_settlement'] ?? false);

        $wallet = app(\App\Services\Income\VirtualIncomeWalletService::class);
        $this->assertSame('0.0000', $wallet->sumBalance((int) $sponsor->id));
    }
}
