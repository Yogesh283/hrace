<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class PublishOrchidAssetsCommand extends Command
{
    protected $signature = 'rynex:publish-orchid-assets';

    protected $description = 'Publish Orchid CSS/JS to public (required for live admin panel)';

    public function handle(): int
    {
        $this->call('orchid:publish');

        $source = public_path('vendor/orchid');
        $target = public_path('assets/orchid');

        if (! File::isDirectory($source)) {
            $this->error('Missing '.public_path('vendor/orchid').' — run: php artisan orchid:publish');

            return self::FAILURE;
        }

        if (File::isDirectory($target)) {
            File::deleteDirectory($target);
        }

        File::copyDirectory($source, $target);

        $this->info('Orchid assets ready:');
        $this->line('  - public/vendor/orchid/');
        $this->line('  - public/assets/orchid/ (used on live if /vendor is blocked)');
        $this->newLine();
        $this->line('Upload BOTH folders to the server, then: php artisan config:clear');

        return self::SUCCESS;
    }
}
