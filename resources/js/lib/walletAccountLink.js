import { router } from '@inertiajs/react';
import { hideWalletPending, showWalletPending } from '@/lib/appNotify';

function readCsrfToken() {
    if (typeof document === 'undefined') {
        return '';
    }
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Link MetaMask address to the logged-in Laravel user (signed challenge).
 */
export async function linkWalletToAccount(walletAddress) {
    const address = (walletAddress ?? '').trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new Error('Invalid wallet address.');
    }
    if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('No Web3 wallet detected.');
    }

    const nonceRes = await fetch(route('wallet.connect.nonce'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': readCsrfToken(),
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
        signature = await window.ethereum.request({
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
