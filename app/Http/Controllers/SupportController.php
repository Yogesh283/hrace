<?php

namespace App\Http\Controllers;

use App\Models\SupportTicket;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SupportController extends Controller
{
    public function index(Request $request): Response
    {
        $tickets = SupportTicket::query()
            ->where('user_id', $request->user()->id)
            ->latest('id')
            ->limit(50)
            ->get(['id', 'token', 'subject', 'status', 'created_at']);

        return Inertia::render('Support', [
            'tickets' => $tickets,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'subject' => ['required', 'string', 'max:200'],
            'message' => ['required', 'string', 'max:5000'],
        ]);

        $ticket = SupportTicket::query()->create([
            'user_id' => $request->user()->id,
            'subject' => $validated['subject'],
            'message' => $validated['message'],
            'status' => SupportTicket::STATUS_OPEN,
        ]);

        $ticket->refresh();

        return back()->with('status', __('Support ticket created. Your token: :token', [
            'token' => $ticket->token,
        ]));
    }
}
