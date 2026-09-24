/**
 * Show success/error in GlobalFlashModal via `app:notify`.
 * Use for wallet / on-chain flows that do not go through Inertia flash.
 */
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
