import IcoPhaseProgress from '@/Components/Ico/IcoPhaseProgress';
import PanelCard from '@/Components/PanelCard';
import Web3NetworkBanner from '@/Components/Web3NetworkBanner';
import MemberPageHero from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import PrimaryButton from '@/Components/PrimaryButton';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useWalletNetwork } from '@/hooks/useWalletNetwork';
import { RACE_BANNER_STAKING, RACE_LOGO_SRC } from '@/lib/brandAssets';
import { notifyError, notifySuccess } from '@/lib/appNotify';
import { configureWeb3Network, parseTokenAmount, syncBlockchainTx, TESTNET_MOCK_USDT } from '@/lib/web3Deposit';
import { ensureEngineReferralBeforeStake, ensureSponsorActiveForLevelIncome } from '@/lib/web3Engine';
import {
    approveUsdtForIco,
    formatPurchaseDate,
    formatTokenWei,
    formatUsdPriceFromWei,
    friendlyIcoError,
    ICO_STAKE_PLANS,
    purchaseIcoRace,
    quoteIcoRaceOut,
    readAllIcoPhases,
    readErc20Allowance,
    readErc20BalanceOf,
    readIcoCompleted,
    readIcoCurrentPhase,
    readTotalIcoSold,
    readUserIcoPurchases,
} from '@/lib/web3RaceICO';
import {
    claimOnChainReward,
    claimPolicyMessage,
    compoundOnChainReward,
    friendlyEngineError,
    readAllOnChainStakes,
    readClaimPolicyState,
    withdrawOnChainStake,
} from '@/lib/web3Engine';
import { syncParticipationTx } from '@/lib/web3Participation';
import { Head, router, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const fieldClass =
    'w-full rounded-xl border border-sky-500/30 bg-slate-900/60 px-4 py-3 text-sm font-medium text-slate-100 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25';

const PHASE_LABELS = {
    1: { label: 'Phase 1', displayPrice: '$0.25' },
    2: { label: 'Phase 2', displayPrice: '$0.35' },
    3: { label: 'Phase 3', displayPrice: '$0.45' },
};

const ICO_PHASE_POLL_MS = 20_000;

function shortenAddress(address) {
    if (!address || address.length < 10) return address || '—';
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function InfoRow({ label, value, mono = false }) {
    return (
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
            <span className={`text-sm font-semibold text-slate-100 ${mono ? 'break-all font-mono text-xs' : ''}`}>
                {value}
            </span>
        </div>
    );
}

function mapIndexedEngineStakes(rows = []) {
    return rows.map((row) => {
        let principalUsdt = 0n;
        let stakedRace = 0n;
        try {
            principalUsdt = parseTokenAmount(String(row.principal_usdt ?? '0').replace(/,/g, ''), 18);
        } catch {
            principalUsdt = 0n;
        }
        try {
            stakedRace = parseTokenAmount(String(row.staked_race ?? '0').replace(/,/g, ''), 18);
        } catch {
            stakedRace = 0n;
        }
        return {
            index: Number(row.stake_index ?? 0),
            principalUsdt,
            stakedRace,
            lockPeriod: Number(row.lock_seconds ?? 0),
            startedAt: Number(row.started_at ?? 0),
            unlockAt: Number(row.unlock_at ?? 0),
            dailyRateBps: Number(row.daily_rate_bps ?? 0),
            withdrawn: Boolean(row.withdrawn),
            pendingRewardRace: 0n,
            pendingRewardUsdt: 0n,
            fromIndex: true,
            txHash: row.tx_hash ?? '',
            planLabel: row.plan_label ?? '',
            sourceType: row.source_type ?? '',
        };
    });
}

export default function Isu({
    web3Ico = {},
    web3Engine = {},
    lock_tiers = [],
    indexed_purchases = [],
    indexed_engine_stakes = [],
    on_chain_sponsor_wallet = null,
}) {
    const page = usePage();
    const { auth, blockchain } = page.props;

    const icoConfig = useMemo(
        () => ({
            ...(blockchain?.web3 ?? {}),
            ...(blockchain?.ico ?? {}),
            ...web3Engine,
            ...web3Ico,
            community_engine:
                web3Ico?.community_engine ||
                web3Ico?.contracts?.community_engine ||
                web3Engine?.engine_contract ||
                web3Engine?.contract ||
                blockchain?.contracts?.community_engine ||
                blockchain?.ico?.community_engine ||
                '',
            on_chain_enabled:
                web3Ico?.on_chain_enabled ??
                web3Engine?.on_chain_enabled ??
                web3Engine?.enabled ??
                blockchain?.web3?.on_chain_enabled ??
                blockchain?.web3?.enabled ??
                false,
        }),
        [blockchain, web3Engine, web3Ico],
    );

    const boundWallet = auth?.user?.wallet_address ?? '';

    const icoContract =
        icoConfig?.ico_contract ||
        icoConfig?.contracts?.ico ||
        blockchain?.contracts?.ico ||
        '';
    const raceToken =
        icoConfig?.race_token ||
        icoConfig?.contracts?.race_token ||
        blockchain?.contracts?.race_token ||
        '';
    const usdtContract =
        icoConfig?.usdt_contract ||
        icoConfig?.contracts?.usdt ||
        blockchain?.contracts?.usdt ||
        '';
    const engineContract = icoConfig?.community_engine || '';
    const rpcUrl = icoConfig?.rpc_url || blockchain?.rpc_url || '';
    const blockExplorer = icoConfig?.block_explorer || 'https://bscscan.com';
    const stakePlans = useMemo(() => {
        const fromIco = icoConfig?.stake_plans ?? [];
        if (fromIco.length) {
            return fromIco.filter((plan) => Number(plan.days ?? plan.id ?? 0) > 0);
        }
        if (lock_tiers?.length) {
            return lock_tiers.filter((plan) => Number(plan.days ?? 0) > 0);
        }
        return ICO_STAKE_PLANS;
    }, [icoConfig?.stake_plans, lock_tiers]);
    const onChainEnabled = Boolean(icoConfig?.on_chain_enabled);
    const engineReady = Boolean(
        icoConfig?.engine_ready ?? (onChainEnabled && engineContract !== ''),
    );
    const contractsReady = Boolean(
        icoConfig?.ico_ready === true ||
            (onChainEnabled &&
                engineReady &&
                icoContract !== '' &&
                raceToken !== '' &&
                usdtContract !== '' &&
                engineContract !== ''),
    );

    const expectedChainId = useMemo(() => {
        const usdt = (usdtContract || '').trim().toLowerCase();
        if (usdt === TESTNET_MOCK_USDT) {
            return 97;
        }
        const fromIco = Number(icoConfig?.chain_id);
        if (Number.isFinite(fromIco) && fromIco > 0) {
            return fromIco;
        }
        const fromBlockchain = Number(blockchain?.chain_id);
        if (Number.isFinite(fromBlockchain) && fromBlockchain > 0) {
            return fromBlockchain;
        }
        if (icoConfig?.is_testnet ?? blockchain?.is_testnet) {
            return 97;
        }
        return 56;
    }, [
        usdtContract,
        icoConfig?.chain_id,
        icoConfig?.is_testnet,
        blockchain?.chain_id,
        blockchain?.is_testnet,
    ]);

    useEffect(() => {
        configureWeb3Network({
            chainId: expectedChainId,
            usdtContract,
            rpcUrl,
        });
    }, [expectedChainId, usdtContract, rpcUrl]);

    const {
        chainOk,
        switching: networkSwitching,
        networkError: networkSwitchError,
        switchNetwork,
        connectWallet: connectWalletOnNetwork,
        connectedLabel,
        switchButtonLabel,
    } = useWalletNetwork({ expectedChainId });

    useEffect(() => {
        if (!import.meta.env.DEV) {
            return;
        }
        console.log('[ico:config]', {
            chainId: icoConfig?.chain_id ?? blockchain?.chain_id,
            isTestnet: icoConfig?.is_testnet ?? blockchain?.is_testnet,
            onChainMode: onChainEnabled,
            raceCommunityEngine: engineContract,
            raceIco: icoContract,
            usdt: usdtContract,
            engineReady,
            contractsReady,
            stakePlanCount: stakePlans.length,
        });
    }, [
        blockchain?.chain_id,
        blockchain?.is_testnet,
        icoConfig?.chain_id,
        icoConfig?.is_testnet,
        icoContract,
        engineContract,
        usdtContract,
        onChainEnabled,
        engineReady,
        contractsReady,
        stakePlans.length,
    ]);

    const [walletAddress, setWalletAddress] = useState(boundWallet);
    const [connecting, setConnecting] = useState(false);
    const [amountUsd, setAmountUsd] = useState('100');
    const [planId, setPlanId] = useState('180');
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(null);

    const [currentPhaseId, setCurrentPhaseId] = useState(0);
    const [icoCompleted, setIcoCompleted] = useState(false);
    const [phases, setPhases] = useState([]);
    const [totalSold, setTotalSold] = useState(0n);
    const [quotedRace, setQuotedRace] = useState(0n);
    const [quoteError, setQuoteError] = useState('');
    const [usdtBalance, setUsdtBalance] = useState(0n);
    const [raceBalance, setRaceBalance] = useState(0n);
    const [allowance, setAllowance] = useState(0n);
    const [purchases, setPurchases] = useState([]);
    const [stakes, setStakes] = useState([]);
    const [loadingChain, setLoadingChain] = useState(false);
    const [claimEnabledOnChain, setClaimEnabledOnChain] = useState(false);
    const [canClaimRewards, setCanClaimRewards] = useState(false);
    const [nextAllowedClaimAt, setNextAllowedClaimAt] = useState(0);
    const [claimPolicySupported, setClaimPolicySupported] = useState(false);
    const [claimTick, setClaimTick] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => setClaimTick((t) => t + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    const claimStatusMessage = useMemo(
        () =>
            claimPolicyMessage({
                icoCompleted,
                claimEnabled: claimEnabledOnChain,
                canClaim: canClaimRewards,
                nextAllowedAt: nextAllowedClaimAt,
                supported: claimPolicySupported,
            }),
        [icoCompleted, claimEnabledOnChain, canClaimRewards, nextAllowedClaimAt, claimPolicySupported, claimTick],
    );

    const selectedPlan = useMemo(
        () =>
            stakePlans.find((p) => String(p.id ?? p.days) === String(planId)) ||
            ICO_STAKE_PLANS.find((p) => p.id === planId) ||
            stakePlans[0] ||
            ICO_STAKE_PLANS[0],
        [stakePlans, planId],
    );

    useEffect(() => {
        if (stakePlans.length === 0) {
            return;
        }
        const hasPlan = stakePlans.some((p) => String(p.id ?? p.days) === String(planId));
        if (!hasPlan) {
            setPlanId(String(stakePlans[0]?.id ?? stakePlans[0]?.days ?? '180'));
        }
    }, [stakePlans, planId]);

    const lockPeriodSeconds = useMemo(() => {
        const fromCanonical = ICO_STAKE_PLANS.find((p) => String(p.id) === String(planId));
        if (fromCanonical?.lockPeriodSeconds) {
            return Number(fromCanonical.lockPeriodSeconds);
        }
        const raw = Number(selectedPlan?.lockPeriodSeconds ?? selectedPlan?.seconds ?? 0);
        // Guard: days mistaken for seconds (e.g. 180) must not be sent on-chain.
        if (raw > 0 && raw < 86400) {
            const byDays = ICO_STAKE_PLANS.find((p) => Number(p.id) === raw);
            return Number(byDays?.lockPeriodSeconds ?? 0);
        }
        return raw;
    }, [planId, selectedPlan]);

    const activePhase = useMemo(
        () => phases.find((p) => p.id === currentPhaseId) ?? null,
        [phases, currentPhaseId],
    );

    const amountWei = useMemo(() => {
        try {
            if (!amountUsd || Number(amountUsd) <= 0) return 0n;
            return parseTokenAmount(amountUsd, 18);
        } catch {
            return 0n;
        }
    }, [amountUsd]);

    const needsApprove = amountWei > 0n && allowance < amountWei;
    const hasSelectedLock = lockPeriodSeconds > 0 && Boolean(selectedPlan);
    const canBuy =
        walletAddress &&
        contractsReady &&
        busy === '' &&
        amountWei > 0n &&
        hasSelectedLock &&
        currentPhaseId > 0 &&
        !icoCompleted;

    const refreshChainState = useCallback(async () => {
        if (!contractsReady) return;
        setLoadingChain(true);
        setError('');
        try {
            const [phaseId, completed, allPhases, sold] = await Promise.all([
                readIcoCurrentPhase({ icoContract, rpcUrl }),
                readIcoCompleted({ icoContract, rpcUrl }),
                readAllIcoPhases({ icoContract, rpcUrl }),
                readTotalIcoSold({ icoContract, rpcUrl }),
            ]);
            setCurrentPhaseId(phaseId);
            setIcoCompleted(completed);
            setPhases(allPhases);
            setTotalSold(sold);

            if (walletAddress) {
                const [usdtBal, raceBal, allow, history] = await Promise.all([
                    readErc20BalanceOf({ token: usdtContract, wallet: walletAddress, rpcUrl }),
                    readErc20BalanceOf({ token: raceToken, wallet: walletAddress, rpcUrl }),
                    readErc20Allowance({
                        token: usdtContract,
                        owner: walletAddress,
                        spender: icoContract,
                        rpcUrl,
                    }),
                    readUserIcoPurchases({ icoContract, wallet: walletAddress, rpcUrl }),
                ]);
                setUsdtBalance(usdtBal);
                setRaceBalance(raceBal);
                setAllowance(allow);
                setPurchases(history.slice().reverse());
                try {
                    const policy = await readClaimPolicyState({
                        walletAddress,
                        engineContract,
                        rpcUrl,
                    });
                    setClaimPolicySupported(Boolean(policy.supported));
                    setClaimEnabledOnChain(Boolean(policy.claimEnabled));
                    setCanClaimRewards(Boolean(policy.canClaim));
                    setNextAllowedClaimAt(Number(policy.nextAllowedAt) || 0);
                } catch {
                    setClaimPolicySupported(false);
                    setClaimEnabledOnChain(false);
                    setCanClaimRewards(false);
                    setNextAllowedClaimAt(0);
                }
                if (engineContract) {
                    let onChainStakes = [];
                    try {
                        onChainStakes =
                            (await readAllOnChainStakes({
                                engineContract,
                                walletAddress,
                                rpcUrl,
                            })) || [];
                    } catch {
                        onChainStakes = [];
                    }
                    if (onChainStakes.length > 0) {
                        setStakes(onChainStakes);
                    } else if (indexed_engine_stakes?.length) {
                        setStakes(mapIndexedEngineStakes(indexed_engine_stakes));
                    } else {
                        setStakes([]);
                    }
                }
            }
        } catch (err) {
            setError(friendlyIcoError(err));
            notifyError(friendlyIcoError(err), 'ICO');
        } finally {
            setLoadingChain(false);
        }
    }, [
        contractsReady,
        icoContract,
        raceToken,
        usdtContract,
        rpcUrl,
        walletAddress,
        engineContract,
        indexed_engine_stakes,
    ]);

    useEffect(() => {
        if (!walletAddress || stakes.length > 0 || !indexed_engine_stakes?.length) {
            return;
        }
        setStakes(mapIndexedEngineStakes(indexed_engine_stakes));
    }, [walletAddress, indexed_engine_stakes, stakes.length]);

    useEffect(() => {
        refreshChainState();
    }, [refreshChainState]);

    const refreshPhaseState = useCallback(async () => {
        if (!contractsReady) return;
        try {
            const [phaseId, completed, allPhases, sold] = await Promise.all([
                readIcoCurrentPhase({ icoContract, rpcUrl }),
                readIcoCompleted({ icoContract, rpcUrl }),
                readAllIcoPhases({ icoContract, rpcUrl }),
                readTotalIcoSold({ icoContract, rpcUrl }),
            ]);
            setCurrentPhaseId(phaseId);
            setIcoCompleted(completed);
            setPhases(allPhases);
            setTotalSold(sold);
        } catch {
            // Background poll: keep last on-chain snapshot; manual refresh surfaces errors.
        }
    }, [contractsReady, icoContract, rpcUrl]);

    useEffect(() => {
        if (!contractsReady) return undefined;
        const timer = setInterval(() => {
            if (typeof document !== 'undefined' && document.hidden) return;
            refreshPhaseState();
        }, ICO_PHASE_POLL_MS);
        return () => clearInterval(timer);
    }, [contractsReady, refreshPhaseState]);

    const scrollToBuy = useCallback(() => {
        document.getElementById('ico-buy')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    useEffect(() => {
        let cancelled = false;
        async function runQuote() {
            setQuoteError('');
            if (!contractsReady || !currentPhaseId || !amountUsd || Number(amountUsd) <= 0) {
                setQuotedRace(0n);
                return;
            }
            try {
                const out = await quoteIcoRaceOut({
                    icoContract,
                    phaseId: currentPhaseId,
                    usdtAmount: amountUsd,
                    rpcUrl,
                });
                if (!cancelled) setQuotedRace(out);
            } catch (err) {
                if (!cancelled) {
                    setQuotedRace(0n);
                    setQuoteError(friendlyIcoError(err));
                }
            }
        }
        runQuote();
        return () => {
            cancelled = true;
        };
    }, [contractsReady, icoContract, currentPhaseId, amountUsd, rpcUrl]);

    const showIcoError = (errOrMsg) => {
        const msg = typeof errOrMsg === 'string' ? errOrMsg : friendlyIcoError(errOrMsg);
        setError(msg);
        notifyError(msg, 'ICO');
    };

    const showIcoSuccess = (msg) => {
        notifySuccess(msg, 'ICO');
    };

    const connectWallet = async () => {
        setConnecting(true);
        setError('');
        try {
            const address = await connectWalletOnNetwork();
            setWalletAddress(address);
            showIcoSuccess(`Wallet connected: ${address.slice(0, 6)}…${address.slice(-4)}`);
        } catch (err) {
            showIcoError(err);
        } finally {
            setConnecting(false);
        }
    };

    const ensureNetworkForTx = async () => {
        if (chainOk) {
            return true;
        }
        try {
            await switchNetwork();
            return true;
        } catch (err) {
            showIcoError(err);
            return false;
        }
    };

    const onApprove = async () => {
        if (!walletAddress) {
            showIcoError('Connect your wallet first.');
            return;
        }
        if (!(await ensureNetworkForTx())) {
            return;
        }
        setBusy('approve');
        setError('');
        setSuccess(null);
        try {
            await approveUsdtForIco({
                walletAddress,
                icoContract,
                usdtContract,
                amountUsd,
                chainId: expectedChainId,
                waitConfirmations: 1,
            });
            await refreshChainState();
            showIcoSuccess('USDT approved for ICO. Now tap Buy & Stake RACE.');
        } catch (err) {
            showIcoError(err);
        } finally {
            setBusy('');
        }
    };

    const onBuy = async () => {
        if (!walletAddress) {
            showIcoError('Connect your wallet first.');
            return;
        }
        if (!(await ensureNetworkForTx())) {
            return;
        }
        if (!currentPhaseId || icoCompleted) {
            showIcoError('No active ICO phase.');
            return;
        }
        if (!hasSelectedLock || lockPeriodSeconds <= 0) {
            showIcoError('Select a stake plan: 180 / 365 / 730 / 1095 days.');
            return;
        }
        if (quotedRace <= 0n) {
            showIcoError(quoteError || 'Enter a valid USDT amount.');
            return;
        }
        if (activePhase && quotedRace > activePhase.remaining) {
            showIcoError('Not enough RACE remaining in this phase.');
            return;
        }
        if (usdtBalance < amountWei) {
            showIcoError('Insufficient USDT balance.');
            return;
        }

        setBusy('buy');
        setError('');
        setSuccess(null);
        try {
            // Auto-approve when allowance is short so Buy & Stake is one flow.
            const currentAllowance = await readErc20Allowance({
                token: usdtContract,
                owner: walletAddress,
                spender: icoContract,
            });
            if (currentAllowance < amountWei) {
                setBusy('approve');
                await approveUsdtForIco({
                    walletAddress,
                    icoContract,
                    usdtContract,
                    amountUsd,
                    chainId: expectedChainId,
                    waitConfirmations: 1,
                });
                await refreshChainState();
            }

            if (engineContract && Number(amountUsd) >= 50) {
                setBusy('register');
                await ensureSponsorActiveForLevelIncome({
                    sponsorWallet: on_chain_sponsor_wallet,
                    engineContract,
                    rpcUrl,
                    stakeUsd: amountUsd,
                });
                await ensureEngineReferralBeforeStake({
                    walletAddress,
                    engineContract,
                    rpcUrl,
                    sponsorWallet: on_chain_sponsor_wallet,
                    chainId: expectedChainId,
                    waitConfirmations: 1,
                });
            }

            setBusy('buy');
            const txHash = await purchaseIcoRace({
                walletAddress,
                icoContract,
                usdtContract,
                amountUsd,
                lockPeriodSeconds,
                chainId: expectedChainId,
                waitConfirmations: 2,
                rpcUrl,
            });

            const priceLabel = activePhase
                ? `$${formatUsdPriceFromWei(activePhase.priceUsdt)}`
                : PHASE_LABELS[currentPhaseId]?.displayPrice || '—';

            setSuccess({
                txHash,
                usdtPaid: amountUsd,
                raceStaked: formatTokenWei(quotedRace, 18, 4),
                price: priceLabel,
                phase: currentPhaseId,
                plan: selectedPlan?.label || '—',
                dailyRoi: selectedPlan?.daily_roi_percent || selectedPlan?.dailyRoiPercent || '—',
                lockLabel: selectedPlan?.lock_label || selectedPlan?.lockLabel || '—',
            });

            showIcoSuccess(
                `Stake created: ${amountUsd} USDT → ${formatTokenWei(quotedRace, 18, 4)} RACE locked on-chain. USDT sent to admin wallet. Tx ${txHash.slice(0, 10)}…`,
            );

            try {
                await syncBlockchainTx({ txHash });
                await syncParticipationTx({
                    txHash,
                    verifyUrl: '/participation/verify-onchain',
                });
                router.reload();
            } catch (syncErr) {
                console.warn('ICO sync-tx / verify-onchain:', syncErr?.message || syncErr);
                notifyError(
                    `On-chain stake OK, but DB sync lagged: ${syncErr?.message || syncErr}. Indexer will catch up.`,
                    'ICO sync',
                );
            }
            await refreshChainState();
        } catch (err) {
            showIcoError(err);
        } finally {
            setBusy('');
        }
    };

    const historyRows = purchases.length
        ? purchases
        : (indexed_purchases || []).map((row) => {
              const toWei = (v) => {
                  try {
                      return parseTokenAmount(String(v).replace(/,/g, ''), 18);
                  } catch {
                      return 0n;
                  }
              };
              return {
                  id: row.purchase_id,
                  phaseId: row.phase,
                  usdtPaid: toWei(row.usdt_amount),
                  raceAmount: toWei(row.race_amount),
                  priceUsdt: toWei(row.price),
                  purchasedAt: row.created_at ? Math.floor(new Date(row.created_at).getTime() / 1000) : 0,
                  txHash: row.tx_hash,
                  status: row.status || 'confirmed',
                  planLabel: row.plan_label || (row.lock_days ? `${row.lock_days}D` : ''),
                  stakeIndex: row.stake_index,
                  fromIndex: true,
              };
          });

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">
                    RACE ICO
                </h2>
            }
        >
            <Head title="RACE ICO" />
            <MemberPageShell>
                <MemberPageHero
                    title="RACE ICO"
                    subtitle="USDT → admin wallet. Purchased RACE stakes into a FIXED plan only (180/365/730/1095). Flexible is not available during ICO."
                    logoSrc={RACE_LOGO_SRC}
                    bannerSrc={RACE_BANNER_STAKING}
                />

                {!contractsReady && (
                    <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 text-sm text-amber-100">
                        <p className="font-semibold">ICO configuration incomplete</p>
                        <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
                            {!onChainEnabled ? (
                                <li>
                                    On-chain mode is disabled for this network — set{' '}
                                    <code className="font-mono">RACE_COMMUNITY_ENGINE_CONTRACT</code> on BSC Testnet
                                    (chain 97).
                                </li>
                            ) : null}
                            {!engineContract ? (
                                <li>
                                    CommunityEngine missing — set{' '}
                                    <code className="font-mono">RACE_COMMUNITY_ENGINE_CONTRACT</code> in Laravel{' '}
                                    <code className="font-mono">.env</code>.
                                </li>
                            ) : null}
                            {!icoContract ? (
                                <li>
                                    ICO contract missing — set{' '}
                                    <code className="font-mono">RACE_ICO_CONTRACT</code>.
                                </li>
                            ) : null}
                            {!raceToken ? (
                                <li>
                                    RACE token missing — set <code className="font-mono">RACE_TOKEN_CONTRACT</code>.
                                </li>
                            ) : null}
                            {!usdtContract ? (
                                <li>
                                    USDT missing — set <code className="font-mono">USDT_CONTRACT_BEP20</code>{' '}
                                    (TestnetMockUSDT on chain 97).
                                </li>
                            ) : null}
                        </ul>
                    </div>
                )}

                {contractsReady ? (
                    <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-100">
                        CommunityEngine, ICO, RACE, and TEST-USDT configured for chain{' '}
                        {icoConfig?.chain_id ?? '—'}.
                        {engineContract ? (
                            <>
                                {' '}
                                Engine: <span className="font-mono">{shortenAddress(engineContract)}</span>
                            </>
                        ) : null}
                    </div>
                ) : null}

                {walletAddress ? (
                    <Web3NetworkBanner
                        className="mt-4"
                        chainOk={chainOk}
                        connectedLabel={connectedLabel}
                        switchButtonLabel={switchButtonLabel}
                        switching={networkSwitching}
                        networkError={networkSwitchError}
                        onSwitch={switchNetwork}
                    />
                ) : null}

                <IcoPhaseProgress
                    phases={phases}
                    currentPhaseId={currentPhaseId}
                    icoCompleted={icoCompleted}
                    totalSold={totalSold}
                    loading={loadingChain}
                    canBuyNow={contractsReady && !icoCompleted}
                    onBuy={scrollToBuy}
                />

                <div id="ico-buy" className="mt-6 grid scroll-mt-24 gap-6 lg:grid-cols-2">
                    <PanelCard title="Buy RACE">
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="text-xs uppercase text-slate-400">Wallet</p>
                                    <p className="font-mono text-sm text-slate-100">
                                        {walletAddress ? shortenAddress(walletAddress) : 'Not connected'}
                                    </p>
                                </div>
                                <PrimaryButton type="button" onClick={connectWallet} disabled={connecting || networkSwitching}>
                                    {connecting || networkSwitching ? 'Connecting…' : walletAddress ? 'Refresh wallet' : 'Connect wallet'}
                                </PrimaryButton>
                            </div>

                            <InfoRow
                                label="Current phase"
                                value={
                                    currentPhaseId
                                        ? `${PHASE_LABELS[currentPhaseId]?.label || currentPhaseId}`
                                        : icoCompleted
                                          ? 'Completed'
                                          : 'None active'
                                }
                            />
                            <InfoRow
                                label="Current price"
                                value={
                                    activePhase
                                        ? `$${formatUsdPriceFromWei(activePhase.priceUsdt)} / RACE`
                                        : '—'
                                }
                            />
                            <InfoRow
                                label="Phase remaining"
                                value={
                                    activePhase
                                        ? `${formatTokenWei(activePhase.remaining, 18, 2)} RACE`
                                        : '—'
                                }
                            />
                            <InfoRow label="Your USDT" value={`${formatTokenWei(usdtBalance, 18, 4)} USDT`} />
                            <InfoRow
                                label="Wallet RACE (claims only — not ICO principal)"
                                value={`${formatTokenWei(raceBalance, 18, 4)} RACE`}
                            />

                            <label className="block">
                                <span className="mb-1 block text-xs font-medium uppercase text-slate-400">
                                    Lock duration
                                </span>
                                <p className="mb-3 text-xs text-slate-500">
                                    Fixed lock options only (180 / 365 / 730 / 1095). Flexible is not
                                    available during ICO.
                                </p>
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                    {stakePlans.map((plan) => {
                                        const id = plan.id ?? String(plan.days);
                                        const active = String(planId) === String(id);
                                        const roi = plan.daily_roi_percent || plan.dailyRoiPercent;
                                        const lock = plan.lock_label || plan.lockLabel;
                                        const dayLabel = plan.days ? `${plan.days}D` : plan.label;
                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                onClick={() => setPlanId(String(id))}
                                                className={`rounded-xl border p-3 text-left text-sm transition ${
                                                    active
                                                        ? 'border-sky-400 bg-sky-950/40 ring-1 ring-sky-400/40'
                                                        : 'border-slate-700 bg-slate-900/40 hover:border-slate-500'
                                                }`}
                                            >
                                                <p className="font-semibold text-white">{dayLabel}</p>
                                                <p className="text-emerald-300">{roi}% daily</p>
                                                <p className="mt-1 text-xs text-slate-400">{lock || plan.label}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </label>

                            <InfoRow
                                label="Selected lock"
                                value={
                                    selectedPlan
                                        ? `${selectedPlan.days ?? selectedPlan.id} days — ${
                                              selectedPlan.lock_label ||
                                              selectedPlan.lockLabel ||
                                              selectedPlan.label
                                          }`
                                        : 'Select a lock duration'
                                }
                            />

                            <label className="block">
                                <span className="mb-1 block text-xs font-medium uppercase text-slate-400">
                                    USDT amount
                                </span>
                                <input
                                    className={fieldClass}
                                    value={amountUsd}
                                    onChange={(e) => setAmountUsd(e.target.value)}
                                    inputMode="decimal"
                                    placeholder="100"
                                    disabled={!contractsReady || busy !== ''}
                                />
                            </label>

                            <InfoRow
                                label="Estimated RACE"
                                value={
                                    quotedRace > 0n
                                        ? `${formatTokenWei(quotedRace, 18, 4)} RACE`
                                        : quoteError || '—'
                                }
                            />

                            <p className="text-xs text-slate-500">
                                Price from RaceICO. Principal RACE goes into your staking position — no ICO claim.
                            </p>

                            {error && (
                                <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-100">
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-4 text-sm text-emerald-100">
                                    <p className="text-base font-semibold text-emerald-300">Stake Created</p>
                                    <div className="mt-3 space-y-1">
                                        <p>USDT Paid: {success.usdtPaid} USDT</p>
                                        <p>RACE Staked: {success.raceStaked} RACE</p>
                                        <p>Price: {success.price} / RACE</p>
                                        <p>Plan: {success.plan}</p>
                                        <p>Daily ROI: {success.dailyRoi}%</p>
                                        <p>{success.lockLabel}</p>
                                    </div>
                                    <p className="mt-3 text-emerald-200/90">
                                        Principal is locked in staking — not sent as spendable wallet RACE.
                                    </p>
                                    <p className="mt-2 break-all font-mono text-xs">Tx: {success.txHash}</p>
                                    <a
                                        href={`${blockExplorer}/tx/${success.txHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-2 inline-block text-sky-300 underline"
                                    >
                                        View on explorer
                                    </a>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-3">
                                {needsApprove ? (
                                    <PrimaryButton
                                        type="button"
                                        onClick={onApprove}
                                        disabled={!walletAddress || !contractsReady || busy !== '' || amountWei <= 0n}
                                    >
                                        {busy === 'approve' ? 'Approving…' : 'Approve USDT'}
                                    </PrimaryButton>
                                ) : (
                                    <PrimaryButton
                                        type="button"
                                        onClick={onBuy}
                                        disabled={!canBuy}
                                    >
                                        {busy === 'buy'
                                            ? 'Staking…'
                                            : !hasSelectedLock
                                              ? 'Select lock duration first'
                                              : 'Buy & Stake RACE'}
                                    </PrimaryButton>
                                )}
                                <button
                                    type="button"
                                    className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
                                    onClick={refreshChainState}
                                    disabled={loadingChain || busy !== ''}
                                >
                                    Refresh
                                </button>
                            </div>
                        </div>
                    </PanelCard>

                    <PanelCard title="Your staking positions">
                        <p className="mb-3 text-xs text-slate-500">
                            Live from RaceCommunityEngine. Claim / Compound / Withdraw are on-chain only.
                        </p>
                        <p className="mb-3 rounded-lg border border-slate-700/80 bg-slate-900/40 px-3 py-2 text-xs text-slate-200">
                            {claimStatusMessage}
                        </p>
                        {!engineContract ? (
                            <p className="text-sm text-amber-200">
                                CommunityEngine not loaded — check Laravel Testnet config (
                                <code className="font-mono">RACE_COMMUNITY_ENGINE_CONTRACT</code>).
                            </p>
                        ) : stakes.length === 0 ? (
                            <p className="text-sm text-slate-400">No staking positions yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {stakes.map((stake) => {
                                    const nowSec = Math.floor(Date.now() / 1000);
                                    const isFlexible = Number(stake.lockPeriod) === 0;
                                    const matured =
                                        isFlexible ||
                                        (Number(stake.unlockAt) > 0 && nowSec >= Number(stake.unlockAt));
                                    const withdrawn = Boolean(stake.withdrawn);
                                    const statusLabel = withdrawn
                                        ? 'CLOSED'
                                        : matured
                                          ? 'WITHDRAWABLE'
                                          : 'LOCKED';
                                    const lockDisplay = isFlexible
                                        ? 'Withdraw Anytime'
                                        : Number(stake.unlockAt)
                                          ? `Locked until ${formatPurchaseDate(stake.unlockAt)}`
                                          : 'Locked';
                                    const dailyPct = (Number(stake.dailyRateBps || 0) / 100).toFixed(2);
                                    const stakeBusy = busy === `stake-${stake.index}`;
                                    const claimableReward = stake.pendingRewardRace || 0n;
                                    const claimAllowed =
                                        !withdrawn &&
                                        icoCompleted &&
                                        claimableReward > 0n &&
                                        (claimPolicySupported
                                            ? claimEnabledOnChain && canClaimRewards
                                            : true);

                                    return (
                                        <div
                                            key={`stake-${stake.index}`}
                                            className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-3 text-sm"
                                        >
                                            <InfoRow label="Status" value={statusLabel} />
                                            <InfoRow
                                                label="Principal"
                                                value={`${formatTokenWei(stake.stakedRace || 0n, 18, 4)} RACE`}
                                            />
                                            <InfoRow
                                                label="Principal (USDT notional)"
                                                value={`${formatTokenWei(stake.principalUsdt || 0n, 18, 4)} USDT`}
                                            />
                                            <InfoRow label="Daily ROI" value={`${dailyPct}%`} />
                                            <InfoRow
                                                label="Start"
                                                value={
                                                    stake.startedAt
                                                        ? formatPurchaseDate(stake.startedAt)
                                                        : '—'
                                                }
                                            />
                                            <InfoRow
                                                label="End / Flexible"
                                                value={
                                                    isFlexible
                                                        ? 'Flexible'
                                                        : stake.unlockAt
                                                          ? formatPurchaseDate(stake.unlockAt)
                                                          : '—'
                                                }
                                            />
                                            <InfoRow label="Lock" value={lockDisplay} />
                                            <InfoRow
                                                label="Claimable reward"
                                                value={`${formatTokenWei(stake.pendingRewardRace || 0n, 18, 6)} RACE`}
                                            />
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <PrimaryButton
                                                    type="button"
                                                    disabled={
                                                        !claimAllowed || stakeBusy || busy !== ''
                                                    }
                                                    onClick={async () => {
                                                        setBusy(`stake-${stake.index}`);
                                                        setError('');
                                                        try {
                                                            const txHash = await claimOnChainReward({
                                                                walletAddress,
                                                                engineContract,
                                                                stakeIndex: stake.index,
                                                            });
                                                            try {
                                                                await syncBlockchainTx({ txHash });
                                                            } catch (syncErr) {
                                                                console.warn(
                                                                    'claim sync-tx:',
                                                                    syncErr?.message || syncErr,
                                                                );
                                                            }
                                                            await refreshChainState();
                                                        } catch (err) {
                                                            setError(friendlyEngineError(err));
                                                            notifyError(friendlyEngineError(err), 'Stake');
                                                        } finally {
                                                            setBusy('');
                                                        }
                                                    }}
                                                >
                                                    Claim
                                                </PrimaryButton>
                                                <button
                                                    type="button"
                                                    className="rounded-xl border border-sky-500/40 px-3 py-2 text-sm text-sky-200 hover:bg-sky-950/40 disabled:opacity-50"
                                                    disabled={withdrawn || stakeBusy || busy !== ''}
                                                    onClick={async () => {
                                                        setBusy(`stake-${stake.index}`);
                                                        setError('');
                                                        try {
                                                            const txHash = await compoundOnChainReward({
                                                                walletAddress,
                                                                engineContract,
                                                                stakeIndex: stake.index,
                                                            });
                                                            try {
                                                                await syncBlockchainTx({ txHash });
                                                            } catch (syncErr) {
                                                                console.warn(
                                                                    'compound sync-tx:',
                                                                    syncErr?.message || syncErr,
                                                                );
                                                            }
                                                            await refreshChainState();
                                                        } catch (err) {
                                                            setError(friendlyEngineError(err));
                                                            notifyError(friendlyEngineError(err), 'Stake');
                                                        } finally {
                                                            setBusy('');
                                                        }
                                                    }}
                                                >
                                                    Compound
                                                </button>
                                                <button
                                                    type="button"
                                                    className="rounded-xl border border-emerald-500/40 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-950/40 disabled:opacity-50"
                                                    disabled={
                                                        withdrawn ||
                                                        !matured ||
                                                        stakeBusy ||
                                                        busy !== ''
                                                    }
                                                    onClick={async () => {
                                                        setBusy(`stake-${stake.index}`);
                                                        setError('');
                                                        try {
                                                            const txHash = await withdrawOnChainStake({
                                                                walletAddress,
                                                                engineContract,
                                                                stakeIndex: stake.index,
                                                            });
                                                            try {
                                                                await syncBlockchainTx({ txHash });
                                                            } catch (syncErr) {
                                                                console.warn(
                                                                    'withdraw sync-tx:',
                                                                    syncErr?.message || syncErr,
                                                                );
                                                            }
                                                            await refreshChainState();
                                                        } catch (err) {
                                                            setError(friendlyEngineError(err));
                                                            notifyError(friendlyEngineError(err), 'Stake');
                                                        } finally {
                                                            setBusy('');
                                                        }
                                                    }}
                                                >
                                                    {isFlexible ? 'Withdraw / Exit' : 'Withdraw principal'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </PanelCard>

                    <PanelCard title="Purchase history">
                        <p className="mb-3 text-xs text-slate-500">
                            On-chain purchases (source of truth). Laravel index is history only. Principal is staked — not a wallet claim.
                        </p>
                        {historyRows.length === 0 ? (
                            <p className="text-sm text-slate-400">No purchases yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {historyRows.map((buy) => (
                                    <div
                                        key={`${buy.id}-${buy.txHash || buy.purchasedAt}`}
                                        className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-3 text-sm"
                                    >
                                        <InfoRow
                                            label="Date"
                                            value={
                                                buy.purchasedAt
                                                    ? formatPurchaseDate(buy.purchasedAt)
                                                    : '—'
                                            }
                                        />
                                        <InfoRow label="Phase" value={String(buy.phaseId)} />
                                        {buy.planLabel ? (
                                            <InfoRow label="Plan" value={buy.planLabel} />
                                        ) : null}
                                        <InfoRow
                                            label="USDT paid"
                                            value={`${formatTokenWei(buy.usdtPaid, 18, 4)} USDT`}
                                        />
                                        <InfoRow
                                            label="RACE staked"
                                            value={`${formatTokenWei(buy.raceAmount, 18, 4)} RACE`}
                                        />
                                        <InfoRow
                                            label="Price"
                                            value={`$${formatUsdPriceFromWei(buy.priceUsdt)}`}
                                        />
                                        <InfoRow label="Status" value="Stake Created / Active" />
                                        {buy.txHash && (
                                            <a
                                                href={`${blockExplorer}/tx/${buy.txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-2 inline-block text-xs text-sky-300 underline"
                                            >
                                                {shortenAddress(buy.txHash)}
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </PanelCard>
                </div>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
