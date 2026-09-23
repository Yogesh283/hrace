<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use App\Models\Investment;
use App\Models\Withdrawal;
use App\Support\MemberCode;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Display the user's profile form.
     */
    public function edit(Request $request): Response
    {
        $user = $request->user();

        $totalStaking = (float) (Investment::query()
            ->where('user_id', $user->id)
            ->sum('amount_usd') ?? 0);

        $totalWithdrawals = (float) (Withdrawal::query()
            ->where('user_id', $user->id)
            ->where('status', Withdrawal::STATUS_COMPLETED)
            ->sum('amount_usd') ?? 0);

        return Inertia::render('Profile/Edit', [
            'profile' => [
                'member_id' => MemberCode::format($user->member_number),
                'name' => $user->name,
                'email' => $user->email,
                'show_email' => ! str_ends_with(strtolower((string) $user->email), '@wallet.rynex'),
                'referral_code' => $user->referral_code,
                'wallet_address' => $user->wallet_address,
                'withdrawal_address' => $user->wallet_address,
                'total_staking_usd' => number_format($totalStaking, 2, '.', ''),
                'total_withdrawals_usd' => number_format($totalWithdrawals, 2, '.', ''),
            ],
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated());

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        return Redirect::route('profile.edit')->with('status', __('Profile updated successfully.'));
    }

    /**
     * Delete the user's account.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Redirect::to(route('login', [], false));
    }
}
