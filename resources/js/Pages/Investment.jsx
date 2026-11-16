import MemberPageHero, { MemberHeroLink } from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import MemberTableScroll from '@/Components/Member/MemberTableScroll';
import PanelCard from '@/Components/PanelCard';
import PrimaryButton from '@/Components/PrimaryButton';
import Web3NetworkBanner from '@/Components/Web3NetworkBanner';
import RacePdfPanel from '@/Components/Member/RacePdfPanel';
import RacePdfSectionHeader from '@/Components/Member/RacePdfSectionHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useWalletNetwork } from '@/hooks/useWalletNetwork';
import {
    claimOnChainReward,
    purchaseOnChainParticipation,
    stakeRaceFromWallet,
    withdrawOnChainStake,
} from '@/lib/web3Engine';
import { notifyError, notifySuccess } from '@/lib/appNotify';
import { syncBlockchainTx } from '@/lib/web3Deposit';
import { syncParticipationTx } from '@/lib/web3Participation';
import { readErc20Balance, formatTokenWei, readRaceUsdtPrice } from '@/lib/web3PancakeSwap';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

const fieldClass =
    'w-full rounded-xl border border-sky-500/30 bg-slate-900/60 px-4 py-3 text-sm font-medium text-slate-100 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25';

function formatUsd(n) {
    const v = Number(n);
    if (Number.isNaN(v)) return '—';
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(v);
}

function formatRacePriceUsd(n) {
    const v = Number(n);
    if (Number.isNaN(v)) return '—';
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
    }).format(v);
}

function formatRaceCoins(n) {
    const v = Number(n);
    if (Number.isNaN(v)) return '—';
    return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
    }).format(v);
}

function durationTierForDays(durationDays, tiers) {
    const days = Number(durationDays);
    if (!Number.isFinite(days) || days < 0) return null;
    return (tiers ?? []).find((row) => Number(row.days) === days) ?? null;
}

function formatDueDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

export default function Investment({
    builtForGrowth = {
        min_amount_usd: '1.00',
        qualifying_amount_usd: '50.00',
        max_amount_usd: '999999999.99',
        duration_tiers: [],
        duration_options: [],
        stake_unlock: {
            admin_fee_percent: '10.00',
            emi_count: 3,
            emi_percent_each: '30.00',
            interval_days: 30,
            flexible_fee_free_after_days: 10,
        },
    },
    compounding = { enabled: true },
    investments = [],
    stake_unlocks = [],
    wallet_balance_usd = null,
    income_policy = {
        accrued_reward_usd: '0.0000',
        virtual_income_usd: '0.00',
        can_claim: false,
        next_claim_at: null,
        claim_interval_hours: 24,
    },
    race_coin_balance = '0.0000',
    race_coin_price_usd = '0.10',
    onChainParticipation = { enabled: false },
    web3Engine = {},
    blockchainParticipations = [],
    communityEngineStakes = [],
    memberActivation = {},
    on_chain_sponsor_wallet = null,
}) {
    const { auth, blockchain } = usePage().props;
    const walletAddress = auth?.user?.wallet_address ?? '';
    const engineConfig = { ...onChainParticipation, ...web3Engine };
    const onChain = Boolean(engineConfig?.enabled);
    const {
        chainOk,
        switching: networkSwitching,
        networkError: networkSwitchError,
        switchNetwork,
        connectedLabel,
        switchButtonLabel,
    } = useWalletNetwork({ expectedChainId: engineConfig?.chain_id ?? blockchain?.chain_id });
    const engineContract =
        engineConfig?.engine_contract || engineConfig?.contract || '';
    const raceToken = engineConfig?.race_token || blockchain?.contracts?.race_token || '';
    const pancakeRouter =
        blockchain?.contracts?.pancake_router || engineConfig?.pancake_router || '';
    const usdtContract =
        engineConfig?.usdt_contract || blockchain?.contracts?.usdt || '';
    const [onChainBusy, setOnChainBusy] = useState(false);
    /** usdt = Engine.participate (USDT→Pancake); wallet_race = Engine.stakeRace (wallet BEP-20 RACE) */
    const [stakeSource, setStakeSource] = useState('usdt');
    const [walletRaceBalance, setWalletRaceBalance] = useState(0n);
    const [amountRace, setAmountRace] = useState('50');
    const [livePancakePriceUsd, setLivePancakePriceUsd] = useState(() =>
        Number(race_coin_price_usd) > 0 ? Number(race_coin_price_usd) : 0,
    );
    const [unlockBusyId, setUnlockBusyId] = useState(null);
    const [compoundBusyId, setCompoundBusyId] = useState(null);
    const [claimBusy, setClaimBusy] = useState(false);
    const idActive = Boolean(auth?.user?.id_activated_at);
    const stakeUnlock = builtForGrowth?.stake_unlock ?? {
        admin_fee_percent: '10.00',
        emi_count: 3,
        emi_percent_each: '30.00',
        interval_days: 30,
        flexible_fee_free_after_days: 10,
    };

    const requestUnlock = (investmentId) => {
        if (unlockBusyId || compoundBusyId) return;
        setUnlockBusyId(investmentId);
        router.post(
            route('investments.unlock', investmentId),
            {},
            {
                preserveScroll: true,
                onFinish: () => setUnlockBusyId(null),
            },
        );
    };

    const requestCompound = (investmentId) => {
        if (unlockBusyId || compoundBusyId) return;
        setCompoundBusyId(investmentId);
        router.post(
            route('investments.compound', investmentId),
            {},
            {
                preserveScroll: true,
                onFinish: () => setCompoundBusyId(null),
            },
        );
    };

    const requestIncomeClaim = () => {
        if (claimBusy || onChain || !income_policy?.can_claim) {
            return;
        }
        setClaimBusy(true);
        router.post(
            route('income.claim'),
            {},
            {
                preserveScroll: true,
                onFinish: () => setClaimBusy(false),
            },
        );
    };
    const durationTiers = useMemo(() => {
        if (onChain && engineConfig?.lock_tiers?.length) {
            return engineConfig.lock_tiers;
        }
        if (builtForGrowth.duration_tiers?.length > 0) {
            return builtForGrowth.duration_tiers;
        }
        return builtForGrowth.duration_options ?? [];
    }, [onChain, engineConfig, builtForGrowth]);
    const defaultDuration = durationTiers?.[0]?.days ?? 180;
    const { data, setData, post, processing, reset } = useForm({
        amount_usd: builtForGrowth?.min_amount_usd ?? '50.00',
        duration_days: String(defaultDuration),
        payment_method: 'usdt_wallet',
    });

    const selectedDuration = durationTierForDays(data.duration_days, durationTiers);
    const durationDays = Number(data.duration_days);
    const amountNum = Number(data.amount_usd);
    const priceUsd = Number(race_coin_price_usd ?? 0.1);
    const coinsRequired =
        Number.isFinite(amountNum) && amountNum > 0 && priceUsd > 0 ? amountNum / priceUsd : 0;
    const walletBal = Number(wallet_balance_usd ?? 0);
    const raceBal = Number(race_coin_balance ?? 0);
    const payWithRaceCoin = data.payment_method === 'race_coin';
    const stakeWithWalletRace = onChain && stakeSource === 'wallet_race';
    const raceAmountNum = Number(amountRace);
    const pancakePrice =
        livePancakePriceUsd > 0
            ? livePancakePriceUsd
            : Number(race_coin_price_usd) > 0
              ? Number(race_coin_price_usd)
              : 0;
    /** Engine receives ~96% after 4% RACE transfer tax (unless fee-exempt). */
    const raceReceivedEst = Number.isFinite(raceAmountNum) && raceAmountNum > 0 ? raceAmountNum * 0.96 : 0;
    const racePrincipalUsdEst = pancakePrice > 0 ? raceReceivedEst * pancakePrice : 0;
    const minRaceForOneUsd =
        pancakePrice > 0 ? Math.ceil(((1 / pancakePrice) / 0.96) * 10000) / 10000 : null;
    const amountValid = stakeWithWalletRace
        ? Number.isFinite(raceAmountNum) && raceAmountNum > 0
        : Number.isFinite(amountNum) && amountNum >= Number(builtForGrowth.min_amount_usd ?? 50);
    const hasFunds = payWithRaceCoin
        ? raceBal >= coinsRequired
        : wallet_balance_usd == null || walletBal >= amountNum;
    const canSubmit =
        onChain
            ? amountValid && durationDays >= 0 && selectedDuration && !onChainBusy
            : amountValid && durationDays >= 0 && selectedDuration && hasFunds && !processing;

    useEffect(() => {
        let cancelled = false;
        async function loadWalletRaceAndPrice() {
            const rpcUrl = engineConfig.rpc_url || blockchain?.rpc_url || '';
            if (!onChain || !walletAddress || !raceToken) {
                setWalletRaceBalance(0n);
            } else {
                try {
                    const bal = await readErc20Balance({
                        token: raceToken,
                        wallet: walletAddress,
                        rpcUrl,
                    });
                    if (!cancelled) {
                        setWalletRaceBalance(bal ?? 0n);
                    }
                } catch {
                    if (!cancelled) {
                        setWalletRaceBalance(0n);
                    }
                }
            }

            if (!onChain || !pancakeRouter || !raceToken || !usdtContract) {
                return;
            }
            try {
                const usdtWei = await readRaceUsdtPrice({
                    router: pancakeRouter,
                    raceToken,
                    usdtContract,
                    rpcUrl,
                });
                if (!cancelled && usdtWei > 0n) {
                    setLivePancakePriceUsd(Number(usdtWei) / 1e18);
                }
            } catch {
                // keep server race_coin_price_usd fallback already in state
            }
        }
        loadWalletRaceAndPrice();
        return () => {
            cancelled = true;
        };
    }, [
        onChain,
        walletAddress,
        raceToken,
        pancakeRouter,
        usdtContract,
        engineConfig.rpc_url,
        blockchain?.rpc_url,
    ]);

    const submitOnChain = async (e) => {
        e.preventDefault();

        if (!walletAddress) {
            notifyError('Connect your crypto wallet first.', 'Stake');
            return;
        }
        if (!chainOk) {
            try {
                await switchNetwork();
            } catch (err) {
                notifyError(
                    err?.message || 'Please switch your wallet to BNB Smart Chain (Chain ID 56).',
                    'Network',
                );
                return;
            }
        }

        const tier = durationTiersForDays(data.duration_days, durationTiers);
        if (!tier) {
            notifyError('Select a valid lock tier.', 'Stake');
            return;
        }

        if (stakeSource === 'wallet_race') {
            const needWei = (() => {
                try {
                    return BigInt(Math.floor(Number(amountRace) * 1e18));
                } catch {
                    return 0n;
                }
            })();
            if (needWei > walletRaceBalance) {
                notifyError(
                    `Insufficient RACE. Wallet has ${formatTokenWei(walletRaceBalance, 18, 4)} RACE — enter that or less (not more).`,
                    'Stake',
                );
                return;
            }
        }

        setOnChainBusy(true);
        try {
            const txHash =
                stakeSource === 'wallet_race'
                    ? await stakeRaceFromWallet({
                          walletAddress,
                          engineContract,
                          raceToken,
                          raceAmount: amountRace,
                          lockSeconds: tier.seconds ?? 0,
                          sponsorWallet: on_chain_sponsor_wallet,
                          rpcUrl: engineConfig.rpc_url || blockchain?.rpc_url || '',
                      })
                    : await purchaseOnChainParticipation({
                          walletAddress,
                          engineContract,
                          usdtContract: engineConfig.usdt_contract,
                          amountUsd: data.amount_usd,
                          lockSeconds: tier.seconds ?? 0,
                          sponsorWallet: on_chain_sponsor_wallet,
                          rpcUrl: engineConfig.rpc_url || blockchain?.rpc_url || '',
                      });
            try {
                await syncBlockchainTx({ txHash });
                await syncParticipationTx({
                    txHash,
                    verifyUrl: '/participation/verify-onchain',
                });
            } catch (syncErr) {
                console.warn('participate sync:', syncErr?.message || syncErr);
            }
            notifySuccess(
                stakeSource === 'wallet_race'
                    ? 'Wallet RACE staked. Claimed income stays in your income wallet — bring it to your wallet anytime.'
                    : 'Stake opened. Claimed income stays in your income wallet — bring it to your wallet anytime.',
                'Stake',
            );
            router.reload({ only: ['investments', 'blockchainParticipations', 'communityEngineStakes', 'memberActivation', 'web3Engine'] });
        } catch (err) {
            const msg = err?.message || 'On-chain participation failed.';
            if (/stakeRace|function selector|execution reverted/i.test(msg)) {
                notifyError(
                    `${msg} — If this Engine is an older deployment, stakeRace must be redeployed/upgraded first.`,
                    'Stake',
                );
            } else {
                notifyError(msg, 'Stake');
            }
        } finally {
            setOnChainBusy(false);
        }
    };

    const submit = (e) => {
        if (onChain) {
            submitOnChain(e);
            return;
        }
        e.preventDefault();
        post(route('investments.store'), {
            preserveScroll: true,
            onSuccess: () => {
                reset({
                    amount_usd: builtForGrowth?.min_amount_usd ?? '50.00',
                    duration_days: String(defaultDuration),
                    payment_method: 'usdt_wallet',
                });
            },
        });
    };

    const estTotalRoi =
        durationDays > 0 && selectedDuration
            ? (amountNum * Number(selectedDuration.daily_roi_percent) * durationDays) / 100
            : null;

    return (
        <AuthenticatedLayout
            pageTitle="Staking"
            memberSurface="race"
            showMobileFintechNav
            mobileFintechPageTitle="Staking"
        >
            <Head title="Staking Reward Rates" />

            <MemberPageShell contentClassName="space-y-5 sm:space-y-6">
                <MemberPageHero
                    kicker="RACE Community Rewards"
                    title="Staking"
                    variant="pdf"
                    icon="investment"
                    actions={
                        onChain ? null : (
                            <>
                                <MemberHeroLink href={route('transactions', { income: 'community_referrals' })}>
                                    Community Referrals →
                                </MemberHeroLink>
                                <MemberHeroLink href={route('leadership')}>Leadership →</MemberHeroLink>
                                <MemberHeroLink href={route('transactions', { income: 'participation_rewards' })}>
                                    ROI ledger →
                                </MemberHeroLink>
                            </>
                        )
                    }
                >
                    <>
                        Stake from <strong className="text-white">$1</strong> — jitna marzi (temporary).
                        {onChain ? ' Live PancakeSwap price.' : ''}
                    </>
                </MemberPageHero>

                {onChain ? (
                    <PanelCard title="Live Pancake price" icon="swap" className="border-fintech-line !p-4">
                        <p className="mt-1 text-2xl font-bold text-fintech-ink">
                            {pancakePrice > 0 ? formatRacePriceUsd(pancakePrice) : '—'}{' '}
                            <span className="text-sm font-semibold text-fintech-muted">USDT / RACE</span>
                        </p>
                        <p className="mt-1 text-[11px] text-fintech-muted">
                            PancakeSwap RACE→USDT · Min stake ≈{' '}
                            {minRaceForOneUsd != null ? `${minRaceForOneUsd} RACE` : '—'} (after 4% fee ≥ $1)
                        </p>
                    </PanelCard>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <PanelCard title="Accrued reward" icon="investment" className="border-fintech-line !p-4">
                            <p className="mt-1 text-2xl font-bold text-fintech-ink">
                                {formatUsd(income_policy?.accrued_reward_usd ?? 0)}
                            </p>
                            <p className="mt-1 text-[11px] text-fintech-muted">
                                Earned on schedule — claim to virtual balance (no Admin Fee)
                            </p>
                        </PanelCard>
                        <PanelCard title="Virtual Income Wallet" icon="wallet" className="border-fintech-line !p-4">
                            <p className="mt-1 text-2xl font-bold text-fintech-ink">
                                {formatUsd(income_policy?.virtual_income_usd ?? wallet_balance_usd ?? 0)}
                            </p>
                            <p className="mt-1 text-[11px] text-fintech-muted">
                                Combined earned income — not on-chain RACE until compound/mint
                            </p>
                        </PanelCard>
                        <PanelCard title="Claim income" icon="payout" className="border-fintech-line !p-4 sm:col-span-2 lg:col-span-1">
                            <p className="mt-1 text-xs text-fintech-muted">
                                Separate from withdrawal. Claim does not send USDT outside the platform.
                            </p>
                            {income_policy?.next_claim_at ? (
                                <p className="mt-2 text-[11px] text-amber-800">
                                    Next claim after{' '}
                                    {new Date(income_policy.next_claim_at).toLocaleString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </p>
                            ) : null}
                            <PrimaryButton
                                type="button"
                                className="mt-3 w-full justify-center"
                                disabled={!income_policy?.can_claim || claimBusy}
                                onClick={requestIncomeClaim}
                            >
                                {claimBusy ? 'Claiming…' : 'Claim to virtual income'}
                            </PrimaryButton>
                        </PanelCard>
                        <PanelCard title="Race Coin" icon="swap" className="border-fintech-line !p-4 sm:col-span-2 lg:col-span-3">
                            <p className="mt-1 text-2xl font-bold text-fintech-ink">
                                {formatRaceCoins(race_coin_balance)} RC
                            </p>
                            <p className="mt-1 text-[11px] text-fintech-muted">
                                @ {formatRacePriceUsd(race_coin_price_usd)} per coin
                            </p>
                        </PanelCard>
                    </div>
                )}

                {!onChain ? (
                    <RacePdfPanel>
                        <RacePdfSectionHeader title="Daily reward by lock duration" />
                        <MemberTableScroll>
                            <table className="w-full min-w-[20rem] text-left text-xs sm:min-w-0 sm:text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-100/90 text-fintech-muted">
                                        <th className="px-3 py-2.5 font-semibold sm:px-4">Lock duration</th>
                                        <th className="px-3 py-2.5 font-semibold sm:px-4">Daily reward</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {durationTiers.map((row, i) => (
                                        <tr
                                            key={row.days}
                                            className={`border-b border-slate-100/80 ${
                                                i % 2 === 0 ? 'bg-sky-50/40' : 'bg-white'
                                            }`}
                                        >
                                            <td className="px-3 py-3 font-semibold text-fintech-ink sm:px-4">
                                                {row.label ?? `${row.days} days`}
                                            </td>
                                            <td className="px-3 py-3 font-semibold text-[#2563EB] sm:px-4">
                                                {Number(row.daily_roi_percent).toFixed(2)}% daily
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </MemberTableScroll>
                    </RacePdfPanel>
                ) : null}

                <PanelCard title={onChain ? 'Stake' : 'Open participation'} icon="investment" className="border-fintech-line">
                    {!onChain ? (
                    <p className="mb-5 text-sm text-fintech-muted">
                            Enter {formatUsd(builtForGrowth.min_amount_usd)} or more — amount open (temporary).
                    </p>
                    ) : null}

                    {onChain ? (
                        <div className="mb-4 space-y-3">
                            <Web3NetworkBanner
                                chainOk={chainOk}
                                connectedLabel={connectedLabel}
                                switchButtonLabel={switchButtonLabel}
                                switching={networkSwitching}
                                networkError={networkSwitchError}
                                onSwitch={switchNetwork}
                                showWhenConnected={Boolean(walletAddress)}
                            />
                            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-950">
                                Min {formatUsd(onChainParticipation.min_usdt ?? '1')} USDT · Live Pancake{' '}
                                {pancakePrice > 0 ? formatRacePriceUsd(pancakePrice) : '—'} / RACE · Wallet USDT stake
                            </div>
                        </div>
                    ) : null}

                    <form onSubmit={submit} className="space-y-5">
                        {!onChain ? (
                        <div>
                            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-fintech-muted">
                                Pay with
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label
                                    className={`cursor-pointer rounded-xl border px-4 py-3 transition ${
                                        !payWithRaceCoin
                                            ? 'border-[#2563EB] bg-sky-50 ring-2 ring-[#2563EB]/20'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="payment_method"
                                        value="usdt_wallet"
                                        className="sr-only"
                                        checked={!payWithRaceCoin}
                                        onChange={() => setData('payment_method', 'usdt_wallet')}
                                    />
                                    <p className="text-sm font-bold text-fintech-ink">Wallet USDT</p>
                                    <p className="mt-1 text-xs text-fintech-muted">
                                        Deduct from in-app balance
                                        {wallet_balance_usd != null ? ` (${formatUsd(wallet_balance_usd)})` : ''}
                                    </p>
                                </label>
                                <label
                                    className={`cursor-pointer rounded-xl border px-4 py-3 transition ${
                                        payWithRaceCoin
                                            ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-300/40'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="payment_method"
                                        value="race_coin"
                                        className="sr-only"
                                        checked={payWithRaceCoin}
                                        onChange={() => setData('payment_method', 'race_coin')}
                                    />
                                    <p className="text-sm font-bold text-fintech-ink">Race Coin</p>
                                    <p className="mt-1 text-xs text-fintech-muted">
                                        {formatRaceCoins(race_coin_balance)} RC available
                                    </p>
                                </label>
                            </div>
                        </div>
                        ) : null}

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                {stakeWithWalletRace ? (
                                    <>
                                        <label
                                            htmlFor="amount_race"
                                            className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-fintech-muted"
                                        >
                                            Amount (RACE)
                                        </label>
                                        <input
                                            id="amount_race"
                                            type="number"
                                            min="0"
                                            step="0.0001"
                                            value={amountRace}
                                            onChange={(e) => setAmountRace(e.target.value)}
                                            className={fieldClass}
                                        />
                                        <p className="mt-1 text-xs text-fintech-muted">
                                            Wallet: {formatTokenWei(walletRaceBalance, 18, 4)} RACE · Est. principal ≈{' '}
                                            {formatUsd(racePrincipalUsdEst)} after 4% fee (min{' '}
                                            {formatUsd(onChainParticipation.min_usdt ?? '1')}).
                                        </p>
                                        {walletRaceBalance > 0n ? (
                                            <button
                                                type="button"
                                                className="mt-2 text-xs font-semibold text-sky-700 underline"
                                                onClick={() =>
                                                    setAmountRace(formatTokenWei(walletRaceBalance, 18, 4))
                                                }
                                            >
                                                Use max ({formatTokenWei(walletRaceBalance, 18, 4)} RACE)
                                            </button>
                                        ) : null}
                                    </>
                                ) : (
                                    <>
                                        <label
                                            htmlFor="amount_usd"
                                            className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-fintech-muted"
                                        >
                                            Amount (USD)
                                        </label>
                                        <input
                                            id="amount_usd"
                                            type="number"
                                            min={builtForGrowth.min_amount_usd}
                                            max={builtForGrowth.max_amount_usd}
                                            step="0.01"
                                            value={data.amount_usd}
                                            onChange={(e) => setData('amount_usd', e.target.value)}
                                            className={fieldClass}
                                        />
                                    </>
                                )}
                            </div>
                            <div>
                                <label
                                    htmlFor="duration_days"
                                    className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-fintech-muted"
                                >
                                    Lock duration
                                </label>
                                <select
                                    id="duration_days"
                                    value={data.duration_days}
                                    onChange={(e) => setData('duration_days', e.target.value)}
                                    className={fieldClass}
                                >
                                    {durationTiers.map((opt) => (
                                        <option key={opt.days} value={String(opt.days)}>
                                            {opt.label} — {Number(opt.daily_roi_percent).toFixed(2)}% daily
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {amountValid && selectedDuration ? (
                            <div className="space-y-2">
                                <p className="rounded-xl border-2 border-emerald-400 bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-950 shadow-sm">
                                    <strong>
                                        {stakeWithWalletRace
                                            ? `${amountRace} RACE`
                                            : formatUsd(data.amount_usd)}
                                    </strong>{' '}
                                    · <strong>{Number(selectedDuration.daily_roi_percent).toFixed(2)}%</strong> daily
                                    {durationDays === 0 ? (
                                        <>
                                            {' '}
                                            · <strong>Flexible</strong> (ongoing)
                                        </>
                                    ) : (
                                        <>
                                            {' '}
                                            · <strong>{durationDays}</strong> days lock
                                            {!stakeWithWalletRace && estTotalRoi != null ? (
                                                <> (~{formatUsd(estTotalRoi)} est. total ROI)</>
                                            ) : null}
                                        </>
                                    )}
                                </p>
                                {stakeWithWalletRace ? (
                                    <p className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
                                        Payment: <strong>{amountRace} RACE</strong> · Pancake{' '}
                                        <strong>{pancakePrice > 0 ? formatRacePriceUsd(pancakePrice) : '—'}</strong> ·
                                        Est. after fee ≈ <strong>{formatUsd(racePrincipalUsdEst)}</strong>
                                        {racePrincipalUsdEst > 0 && racePrincipalUsdEst < 1 ? (
                                            <span className="mt-1 block text-amber-800">
                                                Below $1 minimum — add more RACE or check live price.
                                            </span>
                                        ) : null}
                                    </p>
                                ) : payWithRaceCoin ? (
                                    <p className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
                                        Payment: <strong>{formatRaceCoins(coinsRequired)} Race Coin</strong>
                                    </p>
                                ) : (
                                    <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                                        Payment: <strong>{formatUsd(data.amount_usd)}</strong> from wallet
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-amber-800">
                                {stakeWithWalletRace
                                    ? 'Enter a RACE amount greater than zero and choose a valid lock tier.'
                                    : `Minimum ${formatUsd(builtForGrowth.min_amount_usd)}. Choose a valid lock tier.`}
                            </p>
                        )}

                        {!onChain && !hasFunds && amountValid ? (
                            <p className="text-sm font-medium text-red-600">
                                {payWithRaceCoin
                                    ? `Insufficient Race Coin. Need ${formatRaceCoins(coinsRequired)} RC.`
                                    : `Insufficient wallet balance. Need ${formatUsd(data.amount_usd)}.`}
                            </p>
                        ) : null}

                        <button
                            type="submit"
                            disabled={onChain ? onChainBusy || !amountValid || !selectedDuration : !canSubmit}
                            className="w-full rounded-xl bg-[#2563EB] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {onChain
                                ? onChainBusy
                                    ? 'Confirm in wallet…'
                                    : stakeWithWalletRace
                                      ? `Stake ${amountRace} RACE on-chain`
                                      : `Stake ${formatUsd(data.amount_usd)} USDT on-chain`
                                : processing
                                  ? 'Saving…'
                                  : payWithRaceCoin
                                    ? `Pay ${formatRaceCoins(coinsRequired)} RC & confirm`
                                    : 'Confirm participation'}
                        </button>

                    </form>
                </PanelCard>

                <RacePdfPanel>
                    <RacePdfSectionHeader
                        title="Your participations"
                        subtitle={
                            onChain
                                ? 'Indexed on-chain stakes (rewards paid by contract)'
                                : 'Compound daily ROI · Flexible 10+ days = no unlock fee · fixed lock: unlock within 24h of completion or auto-rollover'
                        }
                    />
                    {onChain && communityEngineStakes?.length > 0 ? (
                        <MemberTableScroll>
                            <table className="w-full min-w-[40rem] text-left text-xs sm:min-w-0 sm:text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-100/90 text-fintech-muted">
                                        <th className="px-3 py-2.5 font-semibold sm:px-4">RACE</th>
                                        <th className="px-3 py-2.5 font-semibold sm:px-4">USDT</th>
                                        <th className="px-3 py-2.5 font-semibold sm:px-4">Plan</th>
                                        <th className="px-3 py-2.5 font-semibold sm:px-4">Stake #</th>
                                        <th className="px-3 py-2.5 font-semibold sm:px-4">Status</th>
                                        <th className="px-3 py-2.5 font-semibold sm:px-4">Tx</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {communityEngineStakes.map((row, i) => (
                                        <tr
                                            key={`${row.tx_hash}-${row.stake_index}`}
                                            className={`border-b border-slate-100/80 ${
                                                i % 2 === 0 ? 'bg-sky-50/30' : 'bg-white'
                                            }`}
                                        >
                                            <td className="px-3 py-3 font-semibold sm:px-4">
                                                {formatRaceCoins(row.staked_race)} RACE
                                            </td>
                                            <td className="px-3 py-3 sm:px-4">
                                                {formatUsd(row.principal_usdt)}
                                            </td>
                                            <td className="px-3 py-3 sm:px-4">
                                                {row.plan_label || (row.lock_days ? `${row.lock_days}D` : '—')}
                                            </td>
                                            <td className="px-3 py-3 sm:px-4">#{row.stake_index}</td>
                                            <td className="px-3 py-3 sm:px-4">
                                                {row.withdrawn ? 'Withdrawn' : 'Active'}
                                            </td>
                                            <td className="px-3 py-3 font-mono text-[10px] sm:px-4">
                                                {String(row.tx_hash || '').slice(0, 10)}…
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </MemberTableScroll>
                    ) : null}
                    {onChain && blockchainParticipations?.length > 0 ? (
                        <MemberTableScroll>
                            <table className="w-full min-w-[32rem] text-left text-xs sm:min-w-0 sm:text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-100/90 text-fintech-muted">
                                        <th className="px-3 py-2.5 font-semibold sm:px-4">USDT</th>
                                        <th className="px-3 py-2.5 font-semibold sm:px-4">Stake #</th>
                                        <th className="px-3 py-2.5 font-semibold sm:px-4">Tx</th>
                                        <th className="px-3 py-2.5 font-semibold sm:px-4">Synced</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {blockchainParticipations.map((row, i) => (
                                        <tr
                                            key={row.tx_hash}
                                            className={`border-b border-slate-100/80 ${
                                                i % 2 === 0 ? 'bg-sky-50/30' : 'bg-white'
                                            }`}
                                        >
                                            <td className="px-3 py-3 font-semibold sm:px-4">
                                                {formatUsd(row.principal_usdt)}
                                            </td>
                                            <td className="px-3 py-3 sm:px-4">#{row.stake_index}</td>
                                            <td className="px-3 py-3 font-mono text-[10px] sm:px-4">
                                                {String(row.tx_hash).slice(0, 10)}…
                                            </td>
                                            <td className="px-3 py-3 sm:px-4">
                                                {row.synced_at
                                                    ? new Date(row.synced_at).toLocaleString()
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </MemberTableScroll>
                    ) : null}
                    {!onChain && investments.length === 0 ? (
                        <p className="rx-empty mx-3 my-3">
                            No participations yet. Open a position above.
                        </p>
                    ) : null}
                    {onChain &&
                    communityEngineStakes?.length === 0 &&
                    blockchainParticipations?.length === 0 &&
                    investments.length === 0 ? (
                        <p className="rx-empty mx-3 my-3">
                            No participations yet. Open a position above or complete an ICO purchase.
                        </p>
                    ) : null}
                    {!onChain && investments.length > 0 ? (
                        <div className="space-y-4">
                            <MemberTableScroll>
                                <table className="w-full min-w-[36rem] text-left text-xs sm:min-w-0 sm:text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-100/90 text-fintech-muted">
                                            <th className="px-3 py-2.5 font-semibold sm:px-4">Amount</th>
                                            <th className="px-3 py-2.5 font-semibold sm:px-4">Tier</th>
                                            <th className="px-3 py-2.5 font-semibold sm:px-4">Days paid</th>
                                            <th className="px-3 py-2.5 font-semibold sm:px-4">Paid</th>
                                            <th className="px-3 py-2.5 font-semibold sm:px-4">Status</th>
                                            <th className="px-3 py-2.5 font-semibold sm:px-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {investments.map((inv, i) => (
                                            <tr
                                                key={inv.id}
                                                className={`border-b border-slate-100/80 ${
                                                    i % 2 === 0 ? 'bg-sky-50/30' : 'bg-white'
                                                }`}
                                            >
                                                <td className="px-3 py-3 font-semibold text-fintech-ink sm:px-4">
                                                    {formatUsd(inv.amount_usd)}
                                                </td>
                                                <td className="px-3 py-3 sm:px-4">
                                                    {inv.duration_days === 0 ? (
                                                        <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">
                                                            Flexible · {Number(inv.roi_percent_daily).toFixed(2)}%/day
                                                        </span>
                                                    ) : inv.duration_days ? (
                                                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                                                            {inv.duration_days}d ·{' '}
                                                            {Number(inv.roi_percent_daily).toFixed(2)}%/day
                                                        </span>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 sm:px-4">
                                                    {inv.duration_days === 0
                                                        ? inv.roi_payouts_done ?? 0
                                                        : inv.duration_days
                                                          ? `${inv.roi_payouts_done ?? 0} / ${inv.duration_days}`
                                                          : '—'}
                                                </td>
                                                <td className="px-3 py-3 sm:px-4">
                                                    {formatUsd(inv.total_roi_paid_usd)}
                                                </td>
                                                <td className="px-3 py-3 capitalize sm:px-4">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span>{inv.status}</span>
                                                        {inv.status === 'completed' &&
                                                        inv.duration_days > 0 &&
                                                        !inv.unlock ? (
                                                            <span className="text-[10px] font-medium normal-case text-amber-700">
                                                                Unlock within{' '}
                                                                {builtForGrowth?.holding_rollover?.hours ?? 24}h or
                                                                auto-rollover
                                                                {inv.rollover_count > 0
                                                                    ? ` · rolled ${inv.rollover_count}×`
                                                                    : ''}
                                                            </span>
                                                        ) : inv.rollover_count > 0 ? (
                                                            <span className="text-[10px] font-medium normal-case text-fintech-muted">
                                                                Rolled {inv.rollover_count}×
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 sm:px-4">
                                                    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
                                                        {!onChain && compounding?.enabled && inv.can_compound ? (
                                                            <button
                                                                type="button"
                                                                disabled={compoundBusyId === inv.id}
                                                                onClick={() => requestCompound(inv.id)}
                                                                className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                                                                title={`Reinvest ${formatUsd(inv.compoundable_usd)} into stake`}
                                                            >
                                                                {compoundBusyId === inv.id
                                                                    ? 'Compounding…'
                                                                    : `Compound ${formatUsd(inv.compoundable_usd)}`}
                                                            </button>
                                                        ) : null}
                                                        {!onChain && inv.can_unlock ? (
                                                            <button
                                                                type="button"
                                                                disabled={unlockBusyId === inv.id}
                                                                onClick={() => requestUnlock(inv.id)}
                                                                className="rounded-lg bg-[#2563EB] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
                                                            >
                                                                {unlockBusyId === inv.id
                                                                    ? 'Starting…'
                                                                    : 'Withdraw stake'}
                                                            </button>
                                                        ) : inv.unlock ? (
                                                            <span className="text-[11px] font-semibold text-emerald-700">
                                                                Schedule active
                                                            </span>
                                                        ) : !inv.can_compound ? (
                                                            <span className="text-[11px] text-fintech-muted">—</span>
                                                        ) : null}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </MemberTableScroll>

                            {investments.some((inv) => inv.unlock?.emis?.length) ? (
                                <div className="space-y-3 border-t border-slate-100 px-3 pb-4 pt-3 sm:px-4">
                                    <p className="text-xs font-bold uppercase tracking-wider text-fintech-muted">
                                        EMI payout schedule
                                    </p>
                                    {investments
                                        .filter((inv) => inv.unlock?.emis?.length)
                                        .map((inv) => (
                                            <div
                                                key={`unlock-${inv.id}`}
                                                className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3"
                                            >
                                                <p className="mb-2 text-sm font-semibold text-fintech-ink">
                                                    Stake {formatUsd(inv.amount_usd)}
                                                    {Number(inv.unlock.admin_fee_usd) > 0 ? (
                                                        <>
                                                            {' '}
                                                            · admin fee {formatUsd(inv.unlock.admin_fee_usd)} · you get{' '}
                                                            {formatUsd(inv.unlock.emi_pool_usd)} in EMIs
                                                        </>
                                                    ) : (
                                                        <>
                                                            {' '}
                                                            · <span className="text-emerald-700">no admin fee</span> ·
                                                            full {formatUsd(inv.unlock.emi_pool_usd)} in EMIs
                                                        </>
                                                    )}
                                                </p>
                                                <ul className="space-y-1.5">
                                                    {inv.unlock.emis.map((emi) => (
                                                        <li
                                                            key={emi.emi_number}
                                                            className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm"
                                                        >
                                                            <span>
                                                                EMI {emi.emi_number} · 30% ·{' '}
                                                                <strong>{formatUsd(emi.amount_usd)}</strong>
                                                            </span>
                                                            <span
                                                                className={
                                                                    emi.status === 'paid'
                                                                        ? 'font-semibold text-emerald-700'
                                                                        : 'text-fintech-muted'
                                                                }
                                                            >
                                                                {emi.status === 'paid'
                                                                    ? `Paid ${formatDueDate(emi.paid_at)}`
                                                                    : `Due ${formatDueDate(emi.due_at)}`}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </RacePdfPanel>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
