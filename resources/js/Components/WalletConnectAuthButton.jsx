import { walletAuthPayload } from '@/lib/web3Auth';
import { connectWalletWithNetwork } from '@/lib/web3Deposit';
import { router } from '@inertiajs/react';
import { motion } from 'framer-motion';
import { useState } from 'react';

function Spinner({ className = 'h-5 w-5' }) {
    return (
        <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
                className="opacity-90"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
        </svg>
    );
}

function IconWallet() {
    return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
            />
        </svg>
    );
}

export default function WalletConnectAuthButton({
    action = 'login',
    joinCode = '',
    label,
    disabled = false,
    onError,
}) {
    const [loading, setLoading] = useState(false);
    const [phase, setPhase] = useState('idle');
    const [localError, setLocalError] = useState(null);

    const buttonLabel =
        label ||
        (action === 'register' ? 'Connect wallet & register' : 'Connect wallet & sign in');

    const stopLoading = () => {
        setLoading(false);
        setPhase('idle');
    };

    const handleClick = async () => {
        setLocalError(null);
        onError?.(null);

        if (action === 'register' && String(joinCode ?? '').replace(/\s/g, '').length !== 8) {
            const message = 'Enter a valid 8-character join code before connecting your wallet.';
            setLocalError(message);
            onError?.(message);
            return;
        }

        setLoading(true);
        setPhase('wallet');
        try {
            await connectWalletWithNetwork();
            const normalizedJoinCode = String(joinCode ?? '')
                .replace(/\s/g, '')
                .slice(0, 8)
                .toUpperCase();
            const { address, signature } = await walletAuthPayload({
                action,
                joinCode: action === 'register' ? normalizedJoinCode : null,
            });

            const routeName =
                action === 'register' ? 'wallet-auth.register' : 'wallet-auth.login';
            const payload =
                action === 'register'
                    ? { address, signature, join_code: normalizedJoinCode }
                    : { address, signature };

            setPhase(action === 'register' ? 'register' : 'login');
            router.post(route(routeName), payload, {
                preserveScroll: true,
                onError: (errors) => {
                    const message =
                        errors?.address ||
                        errors?.join_code ||
                        'Wallet authentication failed. Please try again.';
                    setLocalError(message);
                    onError?.(message);
                    stopLoading();
                },
                onFinish: () => stopLoading(),
            });
        } catch (error) {
            const message = error?.message || 'Wallet connection was cancelled or failed.';
            setLocalError(message);
            onError?.(message);
            stopLoading();
        }
    };

    return (
        <div className="space-y-2">
            <motion.button
                type="button"
                disabled={disabled || loading}
                onClick={handleClick}
                whileHover={disabled || loading ? undefined : { y: -2 }}
                whileTap={disabled || loading ? undefined : { scale: 0.99 }}
                className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-emerald-300/50 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 py-2.5 text-xs font-extrabold text-white shadow-[0_12px_40px_-8px_rgba(16,185,129,0.45)] transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-70 sm:rounded-2xl sm:py-4 sm:text-base"
            >
                {loading ? (
                    <>
                        <Spinner className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span>
                            {phase === 'register'
                                ? 'Creating account…'
                                : phase === 'login'
                                  ? 'Signing in…'
                                  : 'Confirm in wallet…'}
                        </span>
                    </>
                ) : (
                    <>
                        <IconWallet />
                        <span>{buttonLabel}</span>
                    </>
                )}
            </motion.button>
            {localError ? (
                <p className="rounded-xl border border-red-200/80 bg-red-50/90 px-3 py-2 text-center text-xs text-red-700 sm:text-sm">
                    {localError}
                </p>
            ) : null}
        </div>
    );
}
