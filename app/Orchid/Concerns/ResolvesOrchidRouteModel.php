<?php

declare(strict_types=1);

namespace App\Orchid\Concerns;

use Illuminate\Database\Eloquent\Model;

trait ResolvesOrchidRouteModel
{
    /**
     * @template T of Model
     *
     * @param  class-string<T>  $modelClass
     * @return T
     */
    protected function routeOrNew(string $routeParameterName, string $modelClass): Model
    {
        $model = request()->route($routeParameterName);

        if ($model instanceof $modelClass) {
            return $model;
        }

        if (is_numeric($model) || (is_string($model) && ctype_digit($model))) {
            return $modelClass::query()->findOrNew((int) $model);
        }

        return new $modelClass;
    }
}
