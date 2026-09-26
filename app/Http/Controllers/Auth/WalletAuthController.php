<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Blockchain\BlockchainWalletIndexerSyncService;
use App\Services\WalletAuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class WalletAuthController extends Controller
{
    public function __construct(
        protected WalletAuthService $walletAuth,
    ) {}

    public function nonce(Request $request): JsonResponse
    {
        if ($request->filled('join_code')) {
            $request->merge([
                'join_code' => strtoupper(preg_replace('/\s+/', '', $request->string('join_code')->toString()) ?? ''),
            ]);
        }

        $validated = $request->validate([
            'address' => ['required', 'string', 'max:66', 'regex:/^0x[a-fA-F0-9]{40}$/'],
            'action' => ['required', 'string', Rule::in(['login', 'register'])],
            'join_code' => [
                Rule::requiredIf(fn () => $request->string('action')->toString() === 'register'),
                'nullable',
                'string',
                'size:8',
                Rule::exists('users', 'referral_code'),
            ],
        ]);

        if ($validated['action'] === 'register') {
            $sponsorBlocked = User::query()
                ->where('referral_code', strtoupper($validated['join_code'] ?? ''))
                ->where('is_blocked', true)
                ->exists();

            if ($sponsorBlocked) {
                throw ValidationException::withMessages([
                    'join_code' => __('The selected join code is invalid.'),
                ]);
            }
        }

        $address = $this->walletAuth->normalizeAddress($validated['address']);
        $this->hitRateLimiter('wallet-auth-nonce:'.$address, 10, 1);

        if ($validated['action'] === 'login') {
            $exists = User::idByWallet($address) !== null;

            if (! $exists) {
                throw ValidationException::withMessages([
                    'address' => __('No account is linked to this wallet. Register first with your sponsor join code.'),
                ]);
            }
        }

        if ($validated['action'] === 'register') {
            if (User::idByWallet($address) !== null) {
                throw ValidationException::withMessages([
                    'address' => __('This wallet is already registered. Please log in.'),
                ]);
            }
        }

        $payload = $this->walletAuth->issueNonce(
            $address,
            $validated['action'],
            $validated['join_code'] ?? null,
        );

        return response()->json($payload);
    }

    public function login(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'address' => ['required', 'string', 'max:66', 'regex:/^0x[a-fA-F0-9]{40}$/'],
            'signature' => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{130}$/'],
        ]);

        $address = $this->walletAuth->normalizeAddress($validated['address']);
        $this->hitRateLimiter('wallet-auth-login:'.$address, 10, 1);

        $verification = $this->walletAuth->verifySignature($address, $validated['signature'], 'login');

        if (! $verification['valid']) {
            throw ValidationException::withMessages([
                'address' => __('Wallet signature could not be verified. Request a new sign-in and try again.'),
            ]);
        }

        $user = User::query()
            ->where('wallet_address', $address)
            ->first();

        if (! $user) {
            throw ValidationException::withMessages([
                'address' => __('No account is linked to this wallet.'),
            ]);
        }

        if ($user->is_blocked) {
            throw ValidationException::withMessages([
                'address' => __('This account is suspended. Please contact support.'),
            ]);
        }

        if (! $user->email_verified_at) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        Auth::login($user, true);
        $request->session()->regenerate();
        $this->queueWalletIndexSync($user->id);

        return redirect()->intended(route('dashboard', [], false));
    }

    public function register(Request $request): RedirectResponse
    {
        if ($request->filled('join_code')) {
            $request->merge([
                'join_code' => strtoupper(preg_replace('/\s+/', '', $request->string('join_code')->toString())),
            ]);
        }

        $validated = $request->validate([
            'address' => ['required', 'string', 'max:66', 'regex:/^0x[a-fA-F0-9]{40}$/'],
            'signature' => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{130}$/'],
            'join_code' => [
                'required',
                'string',
                'size:8',
                Rule::exists('users', 'referral_code')->where('is_blocked', false),
            ],
        ]);

        $address = $this->walletAuth->normalizeAddress($validated['address']);
        $this->hitRateLimiter('wallet-auth-register:'.$address, 10, 1);

        $verification = $this->walletAuth->verifySignature($address, $validated['signature'], 'register');

        if (
            ! $verification['valid']
            || strtoupper((string) $verification['join_code']) !== strtoupper($validated['join_code'])
        ) {
            throw ValidationException::withMessages([
                'address' => __('Wallet signature could not be verified. Request a new sign-up and try again.'),
            ]);
        }

        if (User::idByWallet($address) !== null) {
            throw ValidationException::withMessages([
                'address' => __('This wallet is already registered. Please log in.'),
            ]);
        }

        $email = $this->walletAuth->syntheticEmail($address);

        if (User::query()->whereRaw('LOWER(email) = ?', [strtolower($email)])->exists()) {
            throw ValidationException::withMessages([
                'address' => __('This wallet is already registered. Please log in.'),
            ]);
        }

        $referrer = User::query()
            ->where('referral_code', strtoupper($validated['join_code']))
            ->where('is_blocked', false)
            ->first(['id']);

        if (! $referrer) {
            throw ValidationException::withMessages([
                'join_code' => __('The selected join code is invalid.'),
            ]);
        }

        $user = User::create([
            'name' => 'Wallet '.$this->walletAuth->walletDisplayName($address),
            'email' => $email,
            'password' => Hash::make(Str::random(16), ['rounds' => 4]),
            'wallet_address' => $address,
            'email_verified_at' => now(),
            'level' => 1,
            'joined_with_code' => strtoupper($validated['join_code']),
            'referred_by' => $referrer->id,
            'is_blocked' => false,
        ]);

        Auth::login($user, true);
        $request->session()->regenerate();
        $this->queueWalletIndexSync($user->id);

        return redirect()->intended(route('dashboard', absolute: false));
    }

    private function queueWalletIndexSync(int $userId): void
    {
        dispatch(function () use ($userId): void {
            $user = User::query()->find($userId);
            if ($user) {
                app(BlockchainWalletIndexerSyncService::class)->syncForUser($user);
            }
        })->afterResponse();
    }

    private function hitRateLimiter(string $key, int $max, int $decayMinutes): void
    {
        if (RateLimiter::tooManyAttempts($key, $max)) {
            $seconds = RateLimiter::availableIn($key);
            throw ValidationException::withMessages([
                'address' => __('Too many attempts. Please try again in :seconds seconds.', ['seconds' => $seconds]),
            ]);
        }

        RateLimiter::hit($key, $decayMinutes * 60);
    }
}
