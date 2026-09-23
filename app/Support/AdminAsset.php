<?php

namespace App\Support;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;

final class AdminAsset
{
    public const CSS_PATH = '/css/admin-vip.css';

    /**
     * URL for admin VIP CSS (route-backed on server so static 404 cannot break admin UI).
     */
    public static function vipCss(): string
    {
        $override = config('platform.admin_vip_css_url');
        if (is_string($override) && $override !== '') {
            return self::withVersion($override);
        }

        $absolute = public_path('css/admin-vip.css');
        $version = File::exists($absolute) ? (string) File::lastModified($absolute) : (string) time();

        if (Route::has('assets.admin-vip-css')) {
            return route('assets.admin-vip-css', ['v' => $version]);
        }

        return self::withVersion(url(self::CSS_PATH), $version);
    }

    private static function withVersion(string $url, ?string $version = null): string
    {
        if ($version === null) {
            $absolute = public_path('css/admin-vip.css');
            $version = File::exists($absolute) ? (string) File::lastModified($absolute) : (string) time();
        }

        $separator = str_contains($url, '?') ? '&' : '?';

        return $url.$separator.'v='.$version;
    }
}
