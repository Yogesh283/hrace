import PrimaryButton from '@/Components/PrimaryButton';
import Web3NetworkBanner from '@/Components/Web3NetworkBanner';
import PanelCard from '@/Components/PanelCard';
import MemberPageHero from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useWalletNetwork } from '@/hooks/useWalletNetwork';
import {
    assertOfficialUsdtContract,
    sendUsdtTransfer,
    verifyOnChainDeposit,
    waitForConfirmations,
} from '@/lib/web3Deposit';
import { linkWalletToAccount } from '@/lib/walletAccountLink';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';

function formatUsd(n, withSign = false) {
    const v = Number(n);
    if (Number.isNaN(v)) {
        return '—';
    }
    const abs = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Math.abs(v));
    if (!withSign) return abs;
    if (v > 0) return `+ ${abs}`;
    if (v < 0) return `− ${abs}`;
    return abs;
}

function formatCoins(n) {
    const v = Number(n);
    if (Number.isNaN(v)) {
        return '—';
    }
    return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
    }).format(v);
}

function formatRowDate(createdAt) {
    if (!createdAt) return '—';
    return new Date(createdAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function Swap({
    depositAddress = { address: '', network: '', usdt_contract: '', chain_id: 56, min_confirmations: 12 },
    raceCoin = {
        price_usd: '0.10',
        min_swap_usd: '1.00',
        balance: '0.0000',
        id_activation_coins: '500.0000',
        id_activation_usd: '50.00',
        id_active: false,
    },
    swap_entries = [],
}) {
    const { auth, blockchain } = usePage().props;
    const wallet = auth.user?.wallet_address;

    const {
        chainOk,
        switching: networkSwitching,
        networkError: networkSwitchError,
        switchNetwork,
        connectWallet: connectWalletOnNetwork,
        connectedLabel,
        switchButtonLabel,
    } = useWalletNetwork({ expectedChainId: depositAddress?.chain_id ?? blockchain?.chain_id });

    const [connecting, setConnecting] = useState(false);
    const [walletError, setWalletError] = useState(null);
    const [amountUsd, setAmountUsd] = useState('');
    const [swapStep, setSwapStep] = useState(null);
    const [swapError, setSwapError] = useState(null);
    const [swapSuccess, setSwapSuccess] = useState(null);

    const activateForm = useForm({});

    const treasuryAddress = (depositAddress?.address ?? '').trim();
    const treasuryNetwork = (depositAddress?.network ?? '').trim();
    const usdtContract = (depositAddress?.usdt_contract ?? '').trim();
    const minConfirmations = Number(depositAddress?.min_confirmations ?? 12);
    const priceUsd = Number(raceCoin.price_usd ?? 0.1);
    const minSwapUsd = Number(raceCoin.min_swap_usd ?? 1);

    let officialUsdtConfigured = false;
    try {
        assertOfficialUsdtContract(usdtContract);
        officialUsdtConfigured = true;
    } catch {
        officialUsdtConfigured = false;
    }

    const coinsPreview = useMemo(() => {
        const amt = Number(amountUsd);
        if (Number.isNaN(amt) || amt <= 0 || priceUsd <= 0) {
            return null;
        }
        return amt / priceUsd;
    }, [amountUsd, priceUsd]);

    const canSwap =
        Boolean(wallet) &&
        Boolean(treasuryAddress) &&
        officialUsdtConfigured &&
        Number(amountUsd) >= minSwapUsd &&
        !swapStep;

    const canActivateId =
        !raceCoin.id_active &&
        Number(raceCoin.balance) >= Number(raceCoin.id_activation_coins) &&
        !activateForm.processing;

    const connectWallet = async () => {
        setWalletError(null);
        if (typeof window === 'undefined' || !window.ethereum) {
            setWalletError('No Web3 wallet detected. Install MetaMask or another EVM wallet.');
            return;
        }
        setConnecting(true);
        try {
            const address = await connectWalletOnNetwork();
            await linkWalletToAccount(address);
        } catch (e) {
            setWalletError(e?.message || 'Wallet connection was cancelled or failed.');
        } finally {
            setConnecting(false);
        }
    };

    const submitSwap = async (e) => {
        e.preventDefault();
        setSwapError(null);
        setSwapSuccess(null);

        if (!wallet) {
            setSwapError('Connect your crypto wallet first.');
            return;
        }
        if (!treasuryAddress || !officialUsdtConfigured) {
            setSwapError('Only official BEP20 USDT swaps are enabled.');
            return;
        }
        if (Number(amountUsd) < minSwapUsd) {
            setSwapError(`Minimum swap is $${minSwapUsd} USDT.`);
            return;
        }

        try {
            setSwapStep('network');
            if (!chainOk) {
                await switchNetwork();
            }

            setSwapStep('sending');
            const txHash = await sendUsdtTransfer({
                from: wallet,
                to: treasuryAddress,
                usdtContract,
                amountUsd,
            });

            setSwapStep('confirming');
            await waitForConfirmations(txHash, { minConfirmations });

            setSwapStep('crediting');
            const result = await verifyOnChainDeposit({
                txHash,
                amountUsd: Number(amountUsd),
                verifyUrl: route('swap.verify_onchain'),
            });

            setSwapSuccess(result.message || 'Race Coin credited to your account.');
            setAmountUsd('');
            router.reload({ preserveScroll: true });
        } catch (err) {
            setSwapError(err?.message || 'Swap could not be completed.');
        } finally {
            setSwapStep(null);
        }
    };

    const activateId = (e) => {
        e.preventDefault();
        activateForm.post(route('swap.activate_id'), { preserveScroll: true });
    };

    const swapStepLabel =
        swapStep === 'network'
            ? 'Switching to BNB Smart Chain…'
            : swapStep === 'sending'
              ? 'Confirm USDT transfer in your wallet…'
              : swapStep === 'confirming'
                ? `Waiting for ${minConfirmations} block confirmations…`
                : swapStep === 'crediting'
                  ? 'Crediting Race Coin…'
                  : null;

    return (
        <AuthenticatedLayout
            pageTitle="Swap"
            memberSurface="race"
            showMobileFintechNav
            mobileFintechPageTitle="Swap"
        >
            <Head title="Swap" />

            <MemberPageShell contentClassName="space-y-5 sm:space-y-6">
                <MemberPageHero
                    kicker="Race Coin"
                    title="Swap USDT → Race Coin"
                    variant="pdf"
                    icon="wallet"
                >
                    Send USDT from your connected crypto wallet and receive virtual Race Coin at $
                    {raceCoin.price_usd} per coin. Use Race Coin to activate your member ID.
                </MemberPageHero>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-white to-violet-50/80 px-4 py-4 shadow-sm">
                        <p className="text-xs font-bold uppercase tracking-wide text-fintech-muted">
                            Race Coin balance
                        </p>
                        <p className="mt-1 font-mono text-2xl font-bold text-violet-700">
                            {formatCoins(raceCoin.balance)} RC
                        </p>
                        <p className="mt-1 text-xs text-fintech-muted">
                            1 Race Coin = {formatUsd(raceCoin.price_usd)}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-white to-sky-50/80 px-4 py-4 shadow-sm">
                        <p className="text-xs font-bold uppercase tracking-wide text-fintech-muted">
                            Member ID status
                        </p>
                        <p className="mt-1 text-lg font-bold text-fintech-ink">
                            {raceCoin.id_active ? 'Active' : 'Pending activation'}
                        </p>
                        {!raceCoin.id_active && (
                            <p className="mt-1 text-xs text-fintech-muted">
                                Activate with {formatCoins(raceCoin.id_activation_coins)} RC (
                                {formatUsd(raceCoin.id_activation_usd)})
                            </p>
                        )}
                    </div>
                </div>

                <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                    <PanelCard title="1 · Connect crypto wallet" icon="wallet">
                        <p className="mb-4 text-sm text-fintech-muted">
                            Connect MetaMask or another EVM wallet on BNB Smart Chain. USDT will be sent
                            from this address.
                        </p>
                        {wallet ? (
                            <div className="space-y-3">
                                <Web3NetworkBanner
                                    chainOk={chainOk}
                                    connectedLabel={connectedLabel}
                                    switchButtonLabel={switchButtonLabel}
                                    switching={networkSwitching}
                                    networkError={networkSwitchError}
                                    onSwitch={switchNetwork}
                                />
                                <p className="break-all font-mono text-sm font-medium text-fintech-ink">
                                    {wallet}
                                </p>
                            </div>
                        ) : (
                            <PrimaryButton
                                type="button"
                                className="w-full justify-center py-3 normal-case"
                                disabled={connecting || networkSwitching}
                                onClick={connectWallet}
                            >
                                {connecting || networkSwitching ? 'Opening wallet…' : 'Connect wallet'}
                            </PrimaryButton>
                        )}
                        {walletError && <p className="mt-3 text-sm text-red-400">{walletError}</p>}
                    </PanelCard>

                    <PanelCard title="2 · Swap" icon="wallet">
                        {!treasuryAddress || !officialUsdtConfigured ? (
                            <p className="text-sm text-amber-600">
                                Swap is not available — treasury address or official USDT contract is not
                                configured.
                            </p>
                        ) : (
                            <form onSubmit={submitSwap} className="space-y-1.5">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition focus-within:border-violet-400/40 focus-within:bg-white/[0.07]">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                            You pay
                                        </span>
                                        <span className="text-[11px] text-slate-400">Min ${minSwapUsd}</span>
                                    </div>
                                    <div className="mt-2 flex items-center gap-3">
                                        <input
                                            type="number"
                                            min={minSwapUsd}
                                            step="0.01"
                                            inputMode="decimal"
                                            value={amountUsd}
                                            placeholder="0.00"
                                            disabled={Boolean(swapStep)}
                                            onChange={(e) => setAmountUsd(e.target.value)}
                                            className="w-full border-0 bg-transparent p-0 text-3xl font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-0"
                                        />
                                        <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5">
                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">
                                                $
                                            </span>
                                            <span className="text-sm font-bold text-white">USDT</span>
                                        </span>
                                    </div>
                                </div>

                                <div className="relative flex h-2 justify-center">
                                    <div className="absolute -top-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl border-4 border-[#0F172A] bg-violet-600 text-white shadow-md">
                                        <svg
                                            className="h-4 w-4"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth={2.5}
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M12 5v14m0 0l-5-5m5 5l5-5"
                                            />
                                        </svg>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-violet-400/30 bg-violet-500/10 p-4">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                        You receive (estimated)
                                    </span>
                                    <div className="mt-2 flex items-center gap-3">
                                        <span className="w-full truncate text-3xl font-bold text-violet-200">
                                            {coinsPreview != null ? formatCoins(coinsPreview) : '0.00'}
                                        </span>
                                        <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5">
                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                                                RC
                                            </span>
                                            <span className="text-sm font-bold text-white">Race Coin</span>
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-1 flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs">
                                    <span className="text-slate-400">Rate</span>
                                    <span className="font-medium text-slate-200">
                                        1 RC = {formatUsd(raceCoin.price_usd)}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs">
                                    <span className="shrink-0 text-slate-400">Sending to</span>
                                    <span className="truncate font-mono text-[11px] text-slate-200">
                                        {treasuryAddress}
                                    </span>
                                </div>

                                <PrimaryButton
                                    type="submit"
                                    className="mt-2 w-full justify-center rounded-2xl border-violet-500 bg-violet-600 py-3.5 text-base font-bold text-white hover:bg-violet-500 focus:ring-violet-400"
                                    disabled={!canSwap}
                                >
                                    {swapStep
                                        ? swapStepLabel
                                        : !wallet
                                          ? 'Connect wallet to swap'
                                          : 'Swap'}
                                </PrimaryButton>

                                <p className="pt-1 text-center text-[11px] text-slate-400">
                                    Official BEP20 only · {minConfirmations} confirmations
                                </p>
                            </form>
                        )}

                        {swapError && <p className="mt-3 text-sm text-red-500">{swapError}</p>}
                        {swapSuccess && <p className="mt-3 text-sm text-emerald-600">{swapSuccess}</p>}
                    </PanelCard>
                </div>

                {!raceCoin.id_active && (
                    <PanelCard title="3 · Activate member ID with Race Coin" icon="investment">
                        <p className="mb-4 text-sm text-fintech-muted">
                            Deduct {formatCoins(raceCoin.id_activation_coins)} Race Coin (
                            {formatUsd(raceCoin.id_activation_usd)}) from your balance to activate your
                            member ID — same value as the minimum package investment.
                        </p>
                        <form onSubmit={activateId}>
                            <PrimaryButton
                                type="submit"
                                className="w-full justify-center py-3 normal-case sm:w-auto"
                                disabled={!canActivateId}
                            >
                                {activateForm.processing
                                    ? 'Activating…'
                                    : `Activate ID (${formatCoins(raceCoin.id_activation_coins)} RC)`}
                            </PrimaryButton>
                        </form>
                        {!canActivateId && Number(raceCoin.balance) < Number(raceCoin.id_activation_coins) && (
                            <p className="mt-3 text-xs text-amber-700">
                                You need {formatCoins(raceCoin.id_activation_coins)} Race Coin. Current
                                balance: {formatCoins(raceCoin.balance)} RC.
                            </p>
                        )}
                    </PanelCard>
                )}

                <PanelCard title="Recent swaps" icon="transactions" className="mt-6">
                    {swap_entries.length === 0 ? (
                        <p className="rx-empty">No swap transactions yet.</p>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-fintech-line bg-white">
                            <ul className="divide-y divide-fintech-line">
                                {swap_entries.map((r) => (
                                    <li
                                        key={r.id}
                                        className="flex items-start justify-between gap-3 px-4 py-3"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-fintech-ink">
                                                {formatRowDate(r.created_at)}
                                            </p>
                                            <p className="mt-0.5 text-xs text-fintech-muted">
                                                {r.detail ?? 'Race Coin'}
                                                {r.usdt_amount ? ` · ${formatUsd(r.usdt_amount)} USDT` : ''}
                                            </p>
                                        </div>
                                        <p
                                            className={`shrink-0 font-mono text-sm font-bold ${
                                                Number(r.coins_amount) < 0
                                                    ? 'text-amber-700'
                                                    : 'text-violet-700'
                                            }`}
                                        >
                                            {Number(r.coins_amount) >= 0 ? '+' : ''}
                                            {formatCoins(r.coins_amount)} RC
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </PanelCard>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
