function getCsrfToken() {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

export function hasWeb3Wallet() {
    return typeof window !== 'undefined' && Boolean(window.ethereum);
}

export async function requestWalletAccount() {
    if (!hasWeb3Wallet()) {
        throw new Error('No Web3 wallet detected. Install MetaMask or another EVM wallet.');
    }

    const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
    });

    const address = accounts?.[0];
    if (!address) {
        throw new Error('No account returned from the wallet.');
    }

    return address;
}

async function fetchAuthNonce({ address, action, joinCode = null }) {
    const response = await fetch(route('wallet-auth.nonce'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': getCsrfToken(),
        },
        body: JSON.stringify({
            address,
            action,
            join_code: joinCode,
        }),
    });

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
    const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, address],
    });

    if (!signature || typeof signature !== 'string') {
        throw new Error('Wallet did not return a signature.');
    }

    return signature;
}

export async function walletAuthPayload({ action, joinCode = null }) {
    const address = await requestWalletAccount();
    const message = await fetchAuthNonce({ address, action, joinCode });
    const signature = await signWalletMessage(address, message);

    return { address, signature };
}
