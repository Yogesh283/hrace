import { RACE_LOGO_SRC } from '@/lib/brandAssets';
import {
    NETWORK_GATE_STATUS,
    bootNetworkGate,
    getNetworkGateSnapshot,
    requestBscNetworkSwitch,
    subscribeNetworkGate,
} from '@/lib/walletNetworkSession';
import { useEffect, useState } from 'react';

function Spinner() {
    return (
        <div
            className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-amber-300/30 border-t-amber-300"
            aria-hidden
        />
    );
}

export default function WalletNetworkGate({ children }) {
    const [snap, setSnap] = useState(() => getNetworkGateSnapshot());
    const [holdSuccess, setHoldSuccess] = useState(false);

    useEffect(() => {
        const unsub = subscribeNetworkGate(setSnap);
        bootNetworkGate().catch(() => {});
        return unsub;
    }, []);

    useEffect(() => {
        if (snap.status !== NETWORK_GATE_STATUS.ready || snap.readyWithoutWallet || !snap.hasProvider) {
            return undefined;
        }
        setHoldSuccess(true);
        const timer = window.setTimeout(() => setHoldSuccess(false), 900);
        return () => window.clearTimeout(timer);
    }, [snap.status, snap.readyWithoutWallet, snap.hasProvider]);

    const blocking =
        holdSuccess
        || (snap.hasProvider
            && !snap.readyWithoutWallet
            && snap.status !== NETWORK_GATE_STATUS.ready);

    const showRetry =
        snap.status === NETWORK_GATE_STATUS.rejected
        || snap.status === NETWORK_GATE_STATUS.unsupported
        || snap.status === NETWORK_GATE_STATUS.prompt;

    const waiting =
        snap.status === NETWORK_GATE_STATUS.checking
        || snap.status === NETWORK_GATE_STATUS.waiting;

    if (!blocking) {
        return children;
    }

    return (
        <>
            <div
                className="fixed inset-0 z-[190] flex items-center justify-center bg-[#020B2D]/80 px-4 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-live="polite"
            >
                <div className="w-full max-w-sm rounded-2xl border border-amber-300/30 bg-slate-950/95 px-6 py-8 text-center shadow-2xl">
                    <img src={RACE_LOGO_SRC} alt="" className="mx-auto h-12 w-12 object-contain" />
                    {waiting ? <div className="mt-5"><Spinner /></div> : null}
                    <p className="mt-5 text-base font-semibold text-white">{snap.message}</p>
                    <p className="mt-2 text-xs text-slate-400">
                        RACE runs on BNB Smart Chain (Chain ID 56). The site does not sign in until the wallet itself reports chain 56.
                    </p>
                    <p className="mt-3 rounded-lg border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-[11px] leading-5 text-slate-300">
                        Provider: {snap.providerName || 'None'}
                        <br />
                        eth_chainId: {snap.chainHex || '—'} ({snap.chainId || 'unknown'})
                        <br />
                        window.ethereum: {snap.hasEthereum ? 'yes' : 'no'} · window.trustwallet: {snap.hasTrustWallet ? 'yes' : 'no'}
                    </p>
                    {snap.manualHint ? (
                        <p className="mt-3 text-xs text-amber-200">{snap.manualHint}</p>
                    ) : null}
                    {showRetry ? (
                        <button
                            type="button"
                            className="mt-6 w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-bold text-slate-950"
                            onClick={() => requestBscNetworkSwitch()}
                            disabled={snap.status === NETWORK_GATE_STATUS.waiting}
                        >
                            Retry
                        </button>
                    ) : null}
                </div>
            </div>
            <div className="pointer-events-none select-none opacity-30" aria-hidden>
                {children}
            </div>
        </>
    );
}
