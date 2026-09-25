import MemberAlert from '@/Components/Member/MemberAlert';
import PrimaryButton from '@/Components/PrimaryButton';
import { useWalletNetwork } from '@/hooks/useWalletNetwork';
import { configureWeb3Network } from '@/lib/web3Deposit';
import {
    formatIncomeAmount,
    readIncomeHoldMeta,
    readIncomeHoldQuote,
    withdrawIncomeHold,
} from '@/lib/web3IncomeHold';
import { usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

function decimalsFromOneUsdt(oneUsdt) {
    if (!oneUsdt || oneUsdt === 0n) {
        return 18;
    }
    let decimals = 0;
    let value = BigInt(oneUsdt);
    while (value > 1n && decimals < 36) {
        value /= 10n;
        decimals += 1;
    }
    return decimals;
}

export default function IncomeHoldWithdrawCard({ raceLevelIncome = null, compact = false }) {
    const { auth, blockchain } = usePage().props;
    const incomeHold = (
        blockchain?.web3?.income_hold ||
        blockchain?.contracts?.income_hold ||
        blockchain?.token?.contracts?.income_hold ||
        ''
    ).trim();
    const usdtFromConfig = (
        blockchain?.web3?.usdt_contract ||
        blockchain?.contracts?.usdt ||
        ''
    ).trim();
    const rpcUrl = blockchain?.rpc_url || '';
    const expectedChainId = Number(blockchain?.chain_id || (blockchain?.is_testnet ? 97 : 56));
    const boundWallet = auth?.user?.wallet_address || '';

    const {
        chainOk,
        switching: networkSwitching,
        networkError,
        switchNetwork,
        connectWallet: connectWalletOnNetwork,
        connectedLabel,
        switchButtonLabel,
    } = useWalletNetwork({ expectedChainId });

    const [walletAddress, setWalletAddress] = useState(boundWallet);
    const [quote, setQuote] = useState({ raceAmount: 0n, valueUsdt: 0n, feeUsdt: 0n, teamRace: 0n, netRace: 0n });
    const [meta, setMeta] = useState({ adminWallet: '', usdt: '', oneUsdt: 0n });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');

    useEffect(() => {
        configureWeb3Network({
            chainId: expectedChainId,
            usdtContract: usdtFromConfig,
            rpcUrl,
        });
    }, [expectedChainId, usdtFromConfig, rpcUrl]);

    const loadQuote = async (wallet) => {
        if (!incomeHold || !wallet) {
            setQuote({ raceAmount: 0n, valueUsdt: 0n, feeUsdt: 0n, teamRace: 0n, netRace: 0n });
            return;
        }
        const [nextQuote, nextMeta] = await Promise.all([
            readIncomeHoldQuote({ incomeHold, walletAddress: wallet, rpcUrl }),
            readIncomeHoldMeta({ incomeHold, rpcUrl }),
        ]);
        setQuote(nextQuote);
        setMeta(nextMeta);
    };

    useEffect(() => {
        loadQuote(walletAddress).catch(() => {});
    }, [incomeHold, walletAddress, rpcUrl]);

    const usdtDecimals = useMemo(() => decimalsFromOneUsdt(meta.oneUsdt), [meta.oneUsdt]);
    const one = meta.oneUsdt || 10n ** 18n;
    const canWithdraw = quote.raceAmount > 0n && quote.valueUsdt >= one && quote.feeUsdt > 0n;
    const feeRule =
        quote.valueUsdt >= one * 100n
            ? 'Value is $100+ — 1% admin fee'
            : quote.valueUsdt >= one
              ? 'Value is $1–$99 — $1 admin fee'
              : 'Need at least $1 value to withdraw';

    const connectWallet = async () => {
        setError('');
        try {
            const address = await connectWalletOnNetwork();
            if (address) {
                setWalletAddress(address);
            }
        } catch (err) {
            setError(err?.message || 'Could not connect wallet.');
        }
    };

    const submitWithdraw = async () => {
        setError('');
        setStatus('');
        if (!walletAddress) {
            setError('Connect your wallet first.');
            return;
        }
        if (!canWithdraw) {
            setError(quote.raceAmount === 0n ? 'No income on hold yet.' : 'Value must be at least $1.');
            return;
        }
        setBusy(true);
        try {
            const txHash = await withdrawIncomeHold({
                walletAddress,
                incomeHold,
                usdtContract: meta.usdt || usdtFromConfig,
                feeUsdt: quote.feeUsdt,
            });
            setStatus(`RACE is in your wallet. Tx ${String(txHash).slice(0, 10)}…`);
            await loadQuote(walletAddress);
        } catch (err) {
            setError(err?.message || 'Withdraw failed. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    const raceIndexed = Number(raceLevelIncome?.race ?? 0);
    const usdtIndexed = Number(raceLevelIncome?.usdt ?? 0);

    if (!incomeHold) {
        return (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Income wallet is not set up yet. After deploy you can bring income to your wallet with one tap.
            </div>
        );
    }

    let actionLabel = 'Bring to my wallet';
    if (!walletAddress) {
        actionLabel = 'Connect wallet';
    } else if (!chainOk) {
        actionLabel = networkSwitching ? 'Switching network…' : switchButtonLabel || 'Switch network';
    } else if (busy) {
        actionLabel = 'Sending…';
    }

    const onAction = !walletAddress ? connectWallet : !chainOk ? switchNetwork : submitWithdraw;
    const actionDisabled = busy || networkSwitching || (walletAddress && chainOk && !canWithdraw);

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border border-sky-200 bg-white px-4 py-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-fintech-primary">Your held income</p>
                <p className="mt-1 text-3xl font-bold text-fintech-ink">
                    {formatIncomeAmount(quote.raceAmount, 18, 4)} RACE
                </p>
                <p className="mt-1 text-sm text-fintech-muted">
                    Value ≈ {formatIncomeAmount(quote.valueUsdt, usdtDecimals, 2)} USDT
                </p>
                <p className="mt-2 text-sm font-semibold text-fintech-ink">
                    You receive: {formatIncomeAmount(quote.netRace || quote.raceAmount, 18, 4)} RACE
                </p>
                <p className="mt-1 text-sm text-fintech-muted">
                    Team Reward 10%: {formatIncomeAmount(quote.teamRace || 0n, 18, 4)} RACE (L1–L10)
                </p>
                <p className="mt-1 text-sm font-semibold text-fintech-ink">
                    Admin fee: {formatIncomeAmount(quote.feeUsdt, usdtDecimals, 2)} USDT
                </p>
                <p className="mt-1 text-xs text-fintech-muted">{feeRule}</p>
            </div>

            {!compact ? (
                <p className="rounded-xl border border-sky-400/50 bg-[#0a1838]/80 px-3 py-2.5 text-sm leading-relaxed text-sky-100">
                    Claimed income stays here. Tap one button: 10% RACE goes to Team Reward (L1–L10), you receive
                    90%, and you pay the USDT admin fee. $1–$99 value = $1. $100+ = 1%.
                </p>
            ) : (
                <p className="text-sm text-fintech-muted">
                    Tap the button below to bring held income to your wallet.
                </p>
            )}

            {walletAddress ? (
                <p className="text-[11px] text-fintech-muted">
                    Wallet {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
                    {connectedLabel ? ` · ${connectedLabel}` : ''}
                </p>
            ) : null}

            {error ? <MemberAlert variant="error">{error}</MemberAlert> : null}
            {status ? <MemberAlert variant="success">{status}</MemberAlert> : null}
            {networkError ? <MemberAlert variant="warning">{networkError}</MemberAlert> : null}

            <PrimaryButton
                type="button"
                className="w-full justify-center py-3 text-base"
                disabled={actionDisabled}
                onClick={onAction}
            >
                {actionLabel}
            </PrimaryButton>

            {raceIndexed > 0 ? (
                <p className="text-[11px] text-fintech-muted">
                    Indexed level income: {raceIndexed.toLocaleString(undefined, { maximumFractionDigits: 4 })} RACE ≈{' '}
                    {usdtIndexed.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                </p>
            ) : null}
        </div>
    );
}
