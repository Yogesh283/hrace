import { router } from '@inertiajs/react';
import { hideWalletPending, showWalletPending } from '@/lib/appNotify';
import { csrfHeaders } from '@/lib/csrf';
import { NO_WALLET_MESSAGE, walletRequest } from '@/lib/web3Wallet';

/**
 * Link a connected wallet address to the logged-in member (signed challenge).
 */
export async function linkWalletToAccount(walletAddress) {
    const address = (walletAddress ?? '').trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new Error('Invalid wallet address.');
    }
    if (typeof window === 'undefined') {
        throw new Error(NO_WALLET_MESSAGE);
    }

    const nonceRes = await fetch(route('wallet.connect.nonce'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...csrfHeaders(),
        },
        body: JSON.stringify({ address }),
    });

    const noncePayload = await nonceRes.json();
    if (!nonceRes.ok) {
        throw new Error(noncePayload.error || noncePayload.message || 'Could not start wallet verification.');
    }

    const message = noncePayload.message;
    if (!message) {
        throw new Error('Wallet verification message missing.');
    }

    showWalletPending('Sign the message in your wallet…');
    let signature;
    try {
        signature = await walletRequest({
            method: 'personal_sign',
            params: [message, address],
        });
    } finally {
        hideWalletPending();
    }

    return new Promise((resolve, reject) => {
        router.post(
            route('wallet.connect'),
            { address, signature },
            {
                preserveScroll: true,
                onSuccess: () => resolve(true),
                onError: (errors) => {
                    const msg =
                        errors?.signature ||
                        errors?.address ||
                        (typeof errors === 'string' ? errors : 'Wallet link failed.');
                    reject(new Error(msg));
                },
            },
        );
    });
}
