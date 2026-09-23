<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo 'chain_id='.config('blockchain.chain_id').PHP_EOL;
echo 'network='.config('blockchain.network').PHP_EOL;
echo 'ico='.config('blockchain.contracts.ico').PHP_EOL;
echo 'engine='.config('blockchain.contracts.community_engine').PHP_EOL;
echo 'usdt='.config('blockchain.contracts.usdt').PHP_EOL;

$purchases = App\Models\IcoPurchase::query()->orderByDesc('id')->limit(10)->get();
echo 'ico_purchases_count='.App\Models\IcoPurchase::query()->count().PHP_EOL;
echo 'blockchain_events_count='.App\Models\BlockchainEvent::query()->count().PHP_EOL;
echo 'duplicate_ico_rows='.App\Models\IcoPurchase::query()
    ->selectRaw('tx_hash, purchase_id, count(*) as c')
    ->groupBy('tx_hash', 'purchase_id')
    ->havingRaw('count(*) > 1')
    ->count().PHP_EOL;
echo 'index_state='.json_encode(DB::table('blockchain_index_state')->get()).PHP_EOL;
echo 'recent_purchases='.json_encode($purchases->toArray()).PHP_EOL;
