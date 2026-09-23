<?php

namespace App\Http\Middleware;

use App\Support\BlockchainMode;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks Laravel POST routes that credit rewards or mutate balances when blockchain is the only engine.
 */
class RejectCentralizedRewardWrites
{
    /** @var list<string> */
    private const ROUTES = [
        'investments.store',
        'withdrawals.store',
        'deposits.verify_onchain',
        'participation.verify_onchain',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        if (
            BlockchainMode::blockchainOnly()
            && $request->isMethod('POST')
            && in_array($request->route()?->getName(), self::ROUTES, true)
        ) {
            abort(403, __('Rewards are on-chain only. Use your wallet to interact with the smart contract.'));
        }

        return $next($request);
    }
}
