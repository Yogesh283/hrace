<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    /**
     * Display the registration view.
     */
    public function create(Request $request): Response
    {
        $raw = $request->query('join_code');
        $joinCode = is_string($raw)
            ? strtoupper(preg_replace('/\s+/', '', $raw) ?? '')
            : '';

        if (strlen($joinCode) !== 8) {
            $joinCode = '';
        }

        return Inertia::render('Auth/Register', [
            'status' => session('status'),
            'join_code' => $joinCode !== '' ? $joinCode : null,
            'join_code_locked' => $joinCode !== '',
        ]);
    }
}
