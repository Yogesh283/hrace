<?php

namespace App\Http\Controllers;

use App\Services\Income\AffiliateNetworkRoiPageService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AffiliateNetworkRoiController extends Controller
{
    public function index(Request $request, AffiliateNetworkRoiPageService $networkRoi): Response
    {
        return Inertia::render('NetworkRoi', $networkRoi->pagePropsFor($request->user()));
    }
}
