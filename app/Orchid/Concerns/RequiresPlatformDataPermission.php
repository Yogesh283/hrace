<?php

declare(strict_types=1);

namespace App\Orchid\Concerns;

trait RequiresPlatformDataPermission
{
    public function permission(): ?iterable
    {
        return ['platform.data'];
    }
}
