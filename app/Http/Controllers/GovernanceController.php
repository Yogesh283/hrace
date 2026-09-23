<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Community Governance UI — on-chain source of truth.
 * Laravel does not execute proposals; members vote via wallet.
 */
class GovernanceController extends Controller
{
    public function index(Request $request): Response
    {
        $address = (string) config('blockchain.contracts.governance', '');

        return Inertia::render('Governance', [
            'governance' => [
                'address' => $address,
                'configured' => $address !== '' && str_starts_with(strtolower($address), '0x'),
                'chain_id' => (int) config('blockchain.chain_id', 56),
                'rpc_url' => (string) config('blockchain.rpc_url', ''),
                'note' => 'Community Governance (10–12 wallets) is separate from RaceMultiSig (3-of-5 treasury). Voting is on-chain only.',
            ],
        ]);
    }
}
