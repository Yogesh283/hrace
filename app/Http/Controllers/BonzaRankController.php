<?php

namespace App\Http\Controllers;

use App\Services\Income\BonzaRankService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BonzaRankController extends Controller
{
    public function index(Request $request, BonzaRankService $bonza): Response
    {
        return Inertia::render('Bonza', [
            'bonza' => $bonza->progressForUser($request->user()),
        ]);
    }
}
