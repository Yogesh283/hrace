/**
 * Show success/error in GlobalFlashModal via `app:notify`.
 * Use for wallet / on-chain flows that do not go through Inertia flash.
 */

let walletPendingDepth = 0;

export function notifyApp(message, { variant = 'error', title } = {}) {
    const msg = message != null ? String(message).trim() : '';
    if (!msg || typeof document === 'undefined') {
        return;
    }
    document.dispatchEvent(
        new CustomEvent('app:notify', {
            detail: {
                variant: variant === 'success' ? 'success' : 'error',
                title: title || (variant === 'success' ? 'Success' : 'Error'),
                message: msg,
            },
        }),
    );
}

export function notifySuccess(message, title = 'Success') {
    notifyApp(message, { variant: 'success', title });
}

export function notifyError(message, title = 'Error') {
    notifyApp(message, { variant: 'error', title });
}

/** Show full-screen loader while wallet popup / confirmations are pending. */
export function showWalletPending(message = 'Confirm in your wallet…') {
    if (typeof document === 'undefined') {
        return;
    }
    walletPendingDepth += 1;
    document.dispatchEvent(
        new CustomEvent('app:wallet-pending', {
            detail: { active: true, message: String(message || 'Confirm in your wallet…') },
        }),
    );
}

export function hideWalletPending() {
    if (typeof document === 'undefined') {
        return;
    }
    walletPendingDepth = Math.max(0, walletPendingDepth - 1);
    if (walletPendingDepth === 0) {
        document.dispatchEvent(
            new CustomEvent('app:wallet-pending', {
                detail: { active: false },
            }),
        );
    }
}

export async function withWalletPending(fn, message = 'Confirm in your wallet…') {
    showWalletPending(message);
    try {
        return await fn();
    } finally {
        hideWalletPending();
    }
}
