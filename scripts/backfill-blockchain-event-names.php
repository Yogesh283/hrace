<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$cmd = app(App\Console\Commands\IndexBlockchainEventsCommand::class);
$ref = new ReflectionClass($cmd);
$method = $ref->getMethod('resolveEventName');
$method->setAccessible(true);

$updated = 0;
App\Models\BlockchainEvent::query()->orderBy('id')->chunk(200, function ($rows) use ($method, $cmd, &$updated) {
    foreach ($rows as $row) {
        $payload = is_array($row->payload) ? $row->payload : [];
        $topic0 = $payload['topics'][0] ?? null;
        if (! $topic0) {
            continue;
        }
        $name = $method->invoke($cmd, $topic0);
        if ($name !== $row->event_name) {
            $row->forceFill(['event_name' => $name])->save();
            $updated++;
        }
    }
});

echo "event_name_backfill_updated={$updated}\n";
