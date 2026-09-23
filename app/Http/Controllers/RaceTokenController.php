<?php

namespace App\Http\Controllers;

use App\Services\Blockchain\BlockchainContractPayload;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RaceTokenController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('Token/RaceToken', [
            'raceTokenConfig' => BlockchainContractPayload::tokenPagePayload(),
        ]);
    }
}
