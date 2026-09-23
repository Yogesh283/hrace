<?php

use App\Http\Controllers\LendingController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ParticipationOnChainController;
use App\Http\Controllers\ProfileController;
use App\Models\LedgerEntry;
use App\Models\SiteSetting;
use App\Http\Controllers\DepositController;
use App\Http\Controllers\InvestmentController;
use App\Http\Controllers\IsuController;
use App\Http\Controllers\LedgerController;
use App\Http\Controllers\LeadershipController;
use App\Http\Controllers\RaceTokenController;
use App\Http\Controllers\RewardsController;
use App\Http\Controllers\SupportController;
use App\Http\Controllers\DirectTeamController;
use App\Http\Controllers\TeamController;
use App\Http\Controllers\WalletController;
use App\Http\Controllers\SwapController;
use App\Http\Controllers\WithdrawalController;
use App\Http\Controllers\VirtualIncomeCompoundController;
use App\Http\Controllers\VirtualIncomeWalletController;
use App\Http\Controllers\GovernanceController;
use App\Support\AdminAsset;
use App\Support\IncomeCatalog;
use App\Support\RewardPlan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
| Admin VIP stylesheet — served via Laravel so shared hosting always finds it.
| Correct URL: /css/admin-vip.css (not /admin-vip.css)
*/
Route::get(AdminAsset::CSS_PATH, function () {
    $path = public_path('css/admin-vip.css');
    abort_unless(File::isFile($path), 404, 'Upload public/css/admin-vip.css to the server.');

    return response()->file($path, [
        'Content-Type' => 'text/css; charset=UTF-8',
        'Cache-Control' => 'public, max-age=86400',
    ]);
})->name('assets.admin-vip-css');

Route::redirect('/admin-vip.css', AdminAsset::CSS_PATH, 301);

/*
| Orchid admin CSS/JS — serve from disk when static files missing on live server.
*/
foreach (['assets/orchid', 'vendor/orchid'] as $orchidPrefix) {
    Route::get($orchidPrefix.'/{path}', function (string $path) use ($orchidPrefix) {
        $safe = str_replace(['..', '\\'], '', $path);
        $file = public_path($orchidPrefix.'/'.$safe);

        abort_unless(File::isFile($file), 404);

        $mime = match (pathinfo($file, PATHINFO_EXTENSION)) {
            'css' => 'text/css; charset=UTF-8',
            'js' => 'application/javascript; charset=UTF-8',
            'svg' => 'image/svg+xml',
            'map' => 'application/json',
            default => 'application/octet-stream',
        };

        return response()->file($file, [
            'Content-Type' => $mime,
            'Cache-Control' => 'public, max-age=86400',
        ]);
    })->where('path', '.*');
}

Route::get('/', function (Request $request) {
    if ($request->user()) {
        return redirect()->route('dashboard');
    }

    $rawJoin = $request->string('join_code')->toString();
    if ($rawJoin !== '') {
        $code = strtoupper(preg_replace('/\s+/', '', $rawJoin));
        if (strlen($code) === 8) {
            return redirect()->route('register', ['join_code' => $code]);
        }
    }

    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
    ]);
})->name('home');

Route::get('/mobile-design', function () {
    return Inertia::render('MobileFintechShowcase');
})->name('mobile.design');

Route::get('/race', function () {
    return Inertia::render('Race', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
    ]);
})->name('race');

Route::get('/admin/mlm-dashboard', function () {
    return redirect()->route('platform.index');
})->name('admin.mlm.dashboard');



Route::middleware(['auth'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('/team', [TeamController::class, 'index'])->name('team');

    Route::get('/direct-team', [DirectTeamController::class, 'index'])->name('direct-team');

    Route::get('/leadership', [LeadershipController::class, 'index'])->name('leadership');
    Route::get('/leadership/live-data', [LeadershipController::class, 'liveData'])->name('leadership.live-data');

    Route::redirect('/bonza', '/dashboard', 301)->name('bonza');
    Route::redirect('/bonza-buster', '/dashboard', 301)->name('bonza-buster');
    Route::redirect('/network-roi', '/dashboard', 301)->name('network-roi');

    Route::get('/rewards', [RewardsController::class, 'index'])->name('rewards');

    Route::redirect('/rank', '/leadership', 301)->name('rank');

    Route::get('/investment', [InvestmentController::class, 'index'])->name('investment');

    Route::get('/wallet', function (Request $request) {
        return Inertia::render('Deposit', [
            'depositAddress' => SiteSetting::depositAddressPayload(),
            'deposit_entries' => IncomeCatalog::formatLedgerRows(
                LedgerEntry::query()
                    ->production()
                    ->where('user_id', $request->user()->id)
                    ->where('entry_type', LedgerEntry::TYPE_WALLET_DEPOSIT)
                    ->latest('id')
                    ->limit(50)
                    ->get([
                        'id',
                        'entry_type',
                        'amount_usd',
                        'balance_after_usd',
                        'reference_type',
                        'reference_id',
                        'meta',
                        'created_at',
                    ]),
            ),
        ]);
    })->name('wallet');

    Route::post('/investments', [InvestmentController::class, 'store'])->name('investments.store');
    Route::post('/investments/{investment}/unlock', [InvestmentController::class, 'unlock'])
        ->middleware('throttle:10,1')
        ->name('investments.unlock');
    Route::post('/investments/{investment}/compound', [InvestmentController::class, 'compound'])
        ->middleware('throttle:20,1')
        ->name('investments.compound');
    Route::post('/income/claim', [InvestmentController::class, 'claimIncome'])
        ->middleware('throttle:30,1')
        ->name('income.claim');

    Route::get('/virtual-income', [VirtualIncomeWalletController::class, 'index'])->name('virtual_income');
    Route::post('/virtual-income/compound/reserve', [VirtualIncomeCompoundController::class, 'reserve'])
        ->middleware('throttle:20,1')
        ->name('virtual_income.compound.reserve');
    Route::post('/virtual-income/compound/confirm', [VirtualIncomeCompoundController::class, 'confirm'])
        ->middleware('throttle:20,1')
        ->name('virtual_income.compound.confirm');

    Route::post('/participation/verify-onchain', [ParticipationOnChainController::class, 'verifyOnChain'])
        ->middleware('throttle:10,1')
        ->name('participation.verify_onchain');

    Route::get('/deposit', function (Request $request) {
        return Inertia::render('Deposit', [
            'depositAddress' => SiteSetting::depositAddressPayload(),
            'deposit_entries' => IncomeCatalog::formatLedgerRows(
                LedgerEntry::query()
                    ->production()
                    ->where('user_id', $request->user()->id)
                    ->where('entry_type', LedgerEntry::TYPE_WALLET_DEPOSIT)
                    ->latest('id')
                    ->limit(50)
                    ->get([
                        'id',
                        'entry_type',
                        'amount_usd',
                        'balance_after_usd',
                        'reference_type',
                        'reference_id',
                        'meta',
                        'created_at',
                    ]),
            ),
        ]);
    })->name('deposit');

    Route::post('/deposits/verify-onchain', [DepositController::class, 'verifyOnChain'])
        ->middleware('throttle:10,1')
        ->name('deposits.verify_onchain');

    Route::get('/swap', [SwapController::class, 'index'])->name('swap');
    Route::get('/race-token', [RaceTokenController::class, 'index'])->name('race-token');
    Route::get('/ico', [IsuController::class, 'index'])->name('ico');
    // Legacy virtual ICO stake/claim endpoints removed from UI — mint-to-user is on-chain only.
    Route::redirect('/isu', '/ico', 301)->name('isu');
    Route::redirect('/race-ico', '/ico', 301)->name('race-ico');

    Route::post('/swap/verify-onchain', [SwapController::class, 'verifyOnChain'])
        ->middleware('throttle:10,1')
        ->name('swap.verify_onchain');
    Route::post('/swap/activate-id', [SwapController::class, 'activateId'])
        ->middleware('throttle:10,1')
        ->name('swap.activate_id');

    Route::get('/governance', [GovernanceController::class, 'index'])->name('governance');

    Route::get('/lending', [LendingController::class, 'index'])->name('lending');
    Route::post('/lending/smart', [LendingController::class, 'storeSmartLending'])
        ->middleware('throttle:20,1')
        ->name('lending.smart.store');
    Route::post('/lending/smart-pro', [LendingController::class, 'storeSmartPro'])
        ->middleware('throttle:20,1')
        ->name('lending.smart_pro.store');
    Route::post('/lending/repayment-plan', [LendingController::class, 'storeRepaymentPlan'])
        ->middleware('throttle:20,1')
        ->name('lending.repayment_plan.store');

    Route::get('/withdrawal', [WithdrawalController::class, 'index'])->name('withdrawal');
    Route::post('/withdrawals', [WithdrawalController::class, 'store'])
        ->middleware('throttle:10,1')
        ->name('withdrawals.store');

    Route::get('/transactions', [LedgerController::class, 'index'])->name('transactions');

    Route::get('/about', [SupportController::class, 'index'])->name('about');
    Route::post('/support', [SupportController::class, 'store'])
        ->middleware('throttle:10,1')
        ->name('support.store');

    Route::post('/wallet/connect/nonce', [WalletController::class, 'nonce'])
        ->middleware('throttle:20,1')
        ->name('wallet.connect.nonce');
    Route::post('/wallet/connect', [WalletController::class, 'store'])
        ->middleware('throttle:20,1')
        ->name('wallet.connect');
    Route::post('/wallet/disconnect', [WalletController::class, 'disconnect'])->name('wallet.disconnect');

});

require __DIR__.'/auth.php';
