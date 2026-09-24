<?php

namespace App\Http\Middleware;

use App\Support\BlockchainMode;
use App\Services\Blockchain\BlockchainContractPayload;
use App\Services\Member\MemberActivationService;
use App\Services\Income\RaceCoinService;
use App\Services\Income\WalletBalanceService;
use App\Support\IncomeCatalog;
use App\Models\SiteSetting;
use Closure;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Inertia\Support\Header;
use Symfony\Component\HttpFoundation\Response;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Prevent browsers/CDNs from caching Inertia JSON as the document for a URL.
     * Also force full HTML on real page loads (tab restore / refresh after idle).
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($this->isDocumentNavigation($request) && $request->headers->has(Header::INERTIA)) {
            $request->headers->remove(Header::INERTIA);
            $request->headers->remove(Header::VERSION);
            $request->headers->remove(Header::PARTIAL_COMPONENT);
            $request->headers->remove(Header::PARTIAL_ONLY);
            $request->headers->remove(Header::PARTIAL_EXCEPT);
        }

        $response = parent::handle($request, $next);

        if ($request->header(Header::INERTIA)) {
            $response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            $response->headers->set('Pragma', 'no-cache');
            $response->headers->set('Expires', '0');
        }

        return $response;
    }

    private function isDocumentNavigation(Request $request): bool
    {
        $dest = $request->header('Sec-Fetch-Dest');
        $mode = $request->header('Sec-Fetch-Mode');

        return $dest === 'document' || $mode === 'navigate';
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => fn () => $this->authPayload($request),
            'incomeHub' => fn () => $request->user()
                ? IncomeCatalog::hubForUser($request->user()->id)
                : null,
            'flash' => [
                'status' => $request->session()->get('status'),
                'error' => $request->session()->get('error'),
            ],
            'memberActivation' => fn () => $request->user()
                ? app(MemberActivationService::class)->statusFor($request->user())
                : null,
            'blockchain' => fn () => [
                'rewards_engine' => config('blockchain.rewards_engine'),
                'blockchain_only' => BlockchainMode::blockchainOnly(),
                'network' => (string) config('blockchain.network', 'bsc'),
                'chain_id' => BlockchainMode::effectiveChainId(),
                'is_testnet' => BlockchainMode::effectiveChainId() === 97,
                'rpc_url' => (string) config('blockchain.rpc_url', ''),
                'contracts' => config('blockchain.contracts', []),
                'web3' => BlockchainContractPayload::enginePayload(),
                'token' => BlockchainContractPayload::tokenPagePayload(),
                'ico' => BlockchainContractPayload::icoPagePayload(),
            ],
            'memberPopup' => fn () => $request->user() ? [
                'enabled' => in_array(strtolower((string) SiteSetting::get(SiteSetting::KEY_MEMBER_POPUP_ENABLED, '0')), ['1', 'true', 'yes', 'on'], true),
                'title' => SiteSetting::get(SiteSetting::KEY_MEMBER_POPUP_TITLE, 'Notice') ?: 'Notice',
                'message' => SiteSetting::get(SiteSetting::KEY_MEMBER_POPUP_MESSAGE, ''),
            ] : null,
        ];
    }

    /**
     * @return array{user: \App\Models\User|null}
     */
    private function authPayload(Request $request): array
    {
        $user = $request->user();

        if (! $user) {
            return ['user' => null];
        }

        $user->loadMissing(['userWallet', 'referrer']);
        $balance = app(WalletBalanceService::class)->currentBalance($user);
        $user->setAttribute('balance_usd', $balance);

        $raceCoinBalance = app(RaceCoinService::class)->currentBalance($user);

        if ($user->userWallet) {
            $user->userWallet->setAttribute('balance_usd', $balance);
            $user->userWallet->setAttribute('race_coin_balance', $raceCoinBalance);
        }

        $user->setAttribute('race_coin_balance', $raceCoinBalance);
        $user->setAttribute(
            'sponsor_wallet_address',
            $user->referrer?->wallet_address ? strtolower((string) $user->referrer->wallet_address) : null,
        );

        return ['user' => $user];
    }
}
