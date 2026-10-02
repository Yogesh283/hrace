import { csrfHeaders, getCsrfToken } from '@/lib/csrf';
import { walletRequest } from '@/lib/web3Wallet';

export { hasWeb3Wallet } from '@/lib/web3Wallet';

export async function requestWalletAccount() {
    const accounts = await walletRequest({
        method: 'eth_requestAccounts',
    });

    const address = accounts?.[0];
    if (!address) {
        throw new Error('No account returned from the wallet.');
    }

    return address;
}

async function fetchAuthNonce({ address, action, joinCode = null }) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);

    let response;
    try {
        response = await fetch(route('wallet-auth.nonce'), {
            method: 'POST',
            credentials: 'same-origin',
            signal: controller.signal,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...csrfHeaders(),
            },
            body: JSON.stringify({
                address,
                action,
                join_code: joinCode,
                _token: getCsrfToken(),
            }),
        });
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error('Wallet sign-in is taking too long. Check your connection and try again.');
        }
        throw error;
    } finally {
        window.clearTimeout(timer);
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        const message =
            payload?.errors?.address?.[0] ||
            payload?.errors?.join_code?.[0] ||
            payload?.message ||
            'Could not start wallet authentication.';
        throw new Error(message);
    }

    if (!payload?.message) {
        throw new Error('Wallet authentication message was not returned.');
    }

    return payload.message;
}

export async function signWalletMessage(address, message) {
    const signature = await walletRequest({
        method: 'personal_sign',
        params: [message, address],
    });

    if (!signature || typeof signature !== 'string') {
        throw new Error('Wallet did not return a signature.');
    }

    return signature;
}

export async function walletAuthPayload({ action, joinCode = null, address = null }) {
    // Reuse the account from connectWalletForAuth — a second eth_requestAccounts
    // hangs for a long time inside TokenPocket / Trust WebViews.
    const resolved = address || (await requestWalletAccount());
    const message = await fetchAuthNonce({ address: resolved, action, joinCode });
    const signature = await signWalletMessage(resolved, message);

    return { address: resolved, signature };
}
