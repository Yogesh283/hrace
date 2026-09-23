<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\PasswordController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\Auth\WalletAuthController;
use App\Http\Middleware\RequireReferralForRegister;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::post('wallet-auth/nonce', [WalletAuthController::class, 'nonce'])
        ->middleware('throttle:20,1')
        ->name('wallet-auth.nonce');

    Route::post('wallet-auth/login', [WalletAuthController::class, 'login'])
        ->middleware('throttle:12,1')
        ->name('wallet-auth.login');

    Route::middleware(RequireReferralForRegister::class)->group(function () {
        Route::get('register', [RegisteredUserController::class, 'create'])
            ->name('register');

        Route::post('wallet-auth/register', [WalletAuthController::class, 'register'])
            ->middleware('throttle:12,1')
            ->name('wallet-auth.register');
    });

    Route::get('login', [AuthenticatedSessionController::class, 'create'])
        ->name('login');
});

Route::middleware('auth')->group(function () {
    Route::put('password', [PasswordController::class, 'update'])->name('password.update');

    Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])
        ->name('logout');
});
