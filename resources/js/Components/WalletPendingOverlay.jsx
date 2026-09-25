import { useEffect, useState } from 'react';

/**
 * Full-screen loader while the connected wallet is waiting for user signature
 * or while the tx is confirming on-chain. Driven by `app:wallet-pending`.
 */
export default function WalletPendingOverlay() {
    const [active, setActive] = useState(false);
    const [message, setMessage] = useState('Confirm in your wallet…');

    useEffect(() => {
        const onPending = (e) => {
            const d = e.detail ?? {};
            if (d.active) {
                setMessage(String(d.message || 'Confirm in your wallet…'));
                setActive(true);
            } else {
                setActive(false);
            }
        };
        document.addEventListener('app:wallet-pending', onPending);
        return () => document.removeEventListener('app:wallet-pending', onPending);
    }, []);

    if (!active) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0F172A]/70 backdrop-blur-sm"
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <div className="mx-4 w-full max-w-sm rounded-2xl border border-sky-400/30 bg-slate-950/95 px-6 py-8 text-center shadow-2xl">
                <div
                    className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-sky-400/30 border-t-sky-400"
                    aria-hidden="true"
                />
                <p className="mt-5 text-base font-semibold text-white">{message}</p>
                <p className="mt-2 text-xs text-slate-400">
                    Open your wallet and confirm. Keep this tab open.
                </p>
            </div>
        </div>
    );
}
