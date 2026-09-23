<?php

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$rows = App\Models\LedgerEntry::query()
    ->production()
    ->where('entry_type', App\Models\LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI)
    ->selectRaw("JSON_EXTRACT(meta, '$.network_level') as lvl, COUNT(*) as cnt, SUM(amount_usd) as total")
    ->groupBy('lvl')
    ->orderByRaw('CAST(lvl as UNSIGNED) ASC')
    ->get();

$max = 0;
foreach ($rows as $r) {
    $lvl = (int) trim((string) $r->lvl, "\"");
    if ($lvl > $max) $max = $lvl;
}

echo "Max network_level: {$max}\n";
echo "Level\tRows\tTotalUSD\n";
foreach ($rows as $r) {
    $lvl = (string) $r->lvl;
    $lvl = trim($lvl, "\"");
    $lvl = $lvl === '' ? 'null' : $lvl;
    echo $lvl."\t".$r->cnt."\t".number_format((float) $r->total, 2, '.', '')."\n";
}

