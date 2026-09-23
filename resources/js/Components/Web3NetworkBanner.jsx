import PrimaryButton from '@/Components/PrimaryButton';

export default function Web3NetworkBanner({
    chainOk,
    connectedLabel = 'Connected to BSC Testnet',
    switchButtonLabel = 'Switch to BSC Testnet',
    switching = false,
    networkError = '',
    onSwitch,
    showWhenConnected = true,
    className = '',
}) {
    if (chainOk) {
        if (!showWhenConnected) {
            return null;
        }

        return (
            <div
                className={`rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100 ${className}`}
            >
                {connectedLabel}
            </div>
        );
    }

    return (
        <div
            className={`rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100 ${className}`}
        >
            <p className="font-semibold">Wrong Network</p>
            <p className="mt-1 text-xs text-amber-100/90">
                MetaMask must be on the configured BSC network before any transaction.
            </p>
            <PrimaryButton
                type="button"
                className="mt-3"
                onClick={onSwitch}
                disabled={switching}
            >
                {switching ? 'Switching…' : switchButtonLabel}
            </PrimaryButton>
            {networkError ? (
                <p className="mt-2 text-xs text-rose-200">{networkError}</p>
            ) : null}
        </div>
    );
}
