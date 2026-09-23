<?php

namespace App\Support;

use Illuminate\Foundation\MixManifestNotFoundException;
use Illuminate\Support\Facades\File;

final class OrchidAsset
{
    /**
     * Public directory for Orchid mix manifest (avoid /vendor URL blocked on some hosts).
     */
    public static function manifestDir(): string
    {
        $preferred = trim((string) config('platform.orchid_asset_dir', 'assets/orchid'), '/');

        if (File::isFile(public_path($preferred.'/mix-manifest.json'))) {
            return $preferred;
        }

        if (File::isFile(public_path('vendor/orchid/mix-manifest.json'))) {
            return 'vendor/orchid';
        }

        return $preferred;
    }

    public static function mix(string $path): string
    {
        $dir = self::manifestDir();

        try {
            return mix($path, $dir);
        } catch (MixManifestNotFoundException) {
            return url('/'.$dir.$path);
        }
    }
}
