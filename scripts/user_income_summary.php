<?php

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$uid = (int) ($_SERVER['argv'][1] ?? 7);

$rows = App\Models\LedgerEntry::query()
    ->production()
    ->where('user_id', $uid)
    ->selectRaw('entry_type, SUM(amount_usd) as total, COUNT(*) as cnt')
    ->groupBy('entry_type')
    ->orderByDesc('total')
    ->get();

foreach ($rows as $r) {
    echo $r->entry_type."\t".number_format((float) $r->total, 2, '.', '')."\t".$r->cnt.PHP_EOL;
}

