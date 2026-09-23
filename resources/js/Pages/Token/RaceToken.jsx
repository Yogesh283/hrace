import PanelCard from '@/Components/PanelCard';
import MemberPageHero from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import {
    EcosystemFeatureCard,
    FeatureDataRow,
    IconBsc,
    IconLiquidity,
    IconMetaMask,
    IconOnChainRewards,
    IconPancake,
    IconRaceToken,
    IconSecureWallet,
    IconStake,
    IconSwap,
    IconUsdt,
    IconWalletConnect,
} from '@/Components/Token/RaceTokenIcons';
import PrimaryButton from '@/Components/PrimaryButton';
import Web3NetworkBanner from '@/Components/Web3NetworkBanner';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useWalletNetwork } from '@/hooks/useWalletNetwork';
import { RACE_BANNER_TOKEN, RACE_LOGO_SRC } from '@/lib/brandAssets';
import { linkWalletToAccount } from '@/lib/walletAccountLink';
import { parseTokenAmount } from '@/lib/web3Deposit';
import {
    claimOnChainMaturityEmi,
    claimOnChainReward,
    friendlyEngineError,
    matureOnChainStake,
    purchaseOnChainParticipation,
    readAllOnChainStakes,
    readEngineMemberState,
    readMemberRank,
    readStakeCount,
    withdrawOnChainStake,
} from '@/lib/web3Engine';
import { readIcoCompleted } from '@/lib/web3RaceICO';
import {
    applySlippage,
    buyRaceWithUsdt,
    formatTokenWei,
    friendlySwapError,
    getSwapQuote,
    readErc20Balance,
    readPairLiquidity,
    readRaceUsdtPrice,
    sellRaceForUsdt,
} from '@/lib/web3PancakeSwap';
import { Head, router, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const fieldClass =
    'w-full rounded-xl border border-sky-500/30 bg-slate-900/60 px-4 py-3 text-sm font-medium text-slate-100 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25';

function shortenAddress(address) {
    if (!address || address.length < 10) return address || '—';
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatUsdFromWei(wei, decimals = 18) {
    const n = Number(formatTokenWei(wei, decimals, 6));
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
    }).format(n);
}

function formatDate(unixSeconds) {
    if (!unixSeconds) return '—';
    return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function formatRemaining(unlockAt) {
    const now = Math.floor(Date.now() / 1000);
    const diff = unlockAt - now;
    if (diff <= 0) return 'Unlocked';
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    return `${days}d ${hours}h`;
}

function TxSuccessBanner({ txHash, explorer }) {
    if (!txHash) return null;
    return (
        <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-4 text-sm text-emerald-100">
            <p className="font-semibold text-emerald-300">Transaction successful</p>
            <p className="mt-1 break-all font-mono text-xs text-emerald-200/90">Tx Hash: {txHash}</p>
            <a
                href={`${explorer}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sky-300 underline hover:text-sky-200"
            >
                View on BscScan
            </a>
        </div>
    );
}

function explorerAddress(explorer, address) {
    if (!explorer || !address) return null;
    return `${explorer}/address/${address}`;
}

function ContractLink({ explorer, address, fallback = 'Not configured' }) {
    if (!address) {
        return <span className="text-slate-500">{fallback}</span>;
    }
    const href = explorerAddress(explorer, address);
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-mono text-[10px] text-sky-300 underline hover:text-sky-200"
        >
            {address}
        </a>
    );
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

export default function RaceToken({ raceTokenConfig = {} }) {
    const { auth } = usePage().props;
    const walletAddress = auth?.user?.wallet_address ?? '';

    const config = raceTokenConfig;
    const engine = config.engine ?? {};
    const engineContract = engine.engine_contract || engine.contract || '';
    const raceToken = config.race_token ?? '';
    const usdtContract = config.usdt_contract ?? '';
    const pancakeRouter = config.pancake_router ?? '';
    const contracts = config.contracts ?? {};
    const lockTiers = engine.lock_tiers ?? [];
    const icoContract = contracts.ico || '';
    const contractsDeployed = Boolean(config.contracts_deployed);
    const engineDeployed = Boolean(config.engine_deployed);
    const explorer = config.block_explorer ?? 'https://bscscan.com';
    const slippageBps = Number(config.default_slippage_bps ?? 100);
    const deadlineSeconds = Number(config.swap_deadline_seconds ?? 1200);
    const qualifyingUsdt = Number(engine.qualifying_usdt ?? 50);
    const minUsdt = Number(engine.min_usdt ?? 1);

    const {
        chainOk,
        switching: networkSwitching,
        networkError: networkSwitchError,
        switchNetwork,
        connectWallet: connectWalletOnNetwork,
        connectedLabel,
        switchButtonLabel,
        networkLabel,
    } = useWalletNetwork({ expectedChainId: config.chain_id });

    const [connecting, setConnecting] = useState(false);
    const [walletError, setWalletError] = useState('');
    const [icoCompleted, setIcoCompleted] = useState(false);

    const [racePriceWei, setRacePriceWei] = useState(null);
    const [raceBalance, setRaceBalance] = useState(0n);
    const [usdtBalance, setUsdtBalance] = useState(0n);
    const [liquidity, setLiquidity] = useState(null);
    const [marketLoading, setMarketLoading] = useState(false);
    const [marketError, setMarketError] = useState('');

    const [buyAmount, setBuyAmount] = useState('');
    const [sellAmount, setSellAmount] = useState('');
    const [buyQuote, setBuyQuote] = useState(0n);
    const [sellQuote, setSellQuote] = useState(0n);
    const [swapBusy, setSwapBusy] = useState(false);
    const [swapError, setSwapError] = useState('');
    const [swapTx, setSwapTx] = useState('');

    const [stakeAmount, setStakeAmount] = useState(String(qualifyingUsdt));
    const [stakeTierDays, setStakeTierDays] = useState(() => {
        const firstFixed = lockTiers.find((t) => Number(t.days) > 0);
        return String(firstFixed?.days ?? lockTiers[0]?.days ?? 180);
    });
    const [stakeBusy, setStakeBusy] = useState(false);
    const [stakeError, setStakeError] = useState('');
    const [stakeTx, setStakeTx] = useState('');
    const [stakes, setStakes] = useState([]);
    const [stakesLoading, setStakesLoading] = useState(false);
    const [actionBusyIndex, setActionBusyIndex] = useState(null);
    const [memberState, setMemberState] = useState({ registered: false, participationActive: false });
    const [memberRank, setMemberRank] = useState(0);
    const [stakeCount, setStakeCount] = useState(0);

    const totalPendingRace = useMemo(
        () => stakes.reduce((sum, stake) => sum + (stake.pendingRewardRace ?? 0n), 0n),
        [stakes],
    );

    const totalStakedUsdt = useMemo(
        () =>
            stakes.reduce((sum, stake) => (stake.withdrawn ? sum : sum + (stake.principalUsdt ?? 0n)), 0n),
        [stakes],
    );

    const liquidityUsdEstimate = useMemo(() => {
        if (!liquidity?.reserveUsdt || !liquidity?.reserveRace || liquidity.reserveRace === 0n) {
            return null;
        }
        const usdtSide = Number(formatTokenWei(liquidity.reserveUsdt, 18, 2));
        const raceSide =
            Number(formatTokenWei(liquidity.reserveRace, 18, 4)) *
            Number(formatTokenWei(racePriceWei ?? 0n, 18, 6));
        return usdtSide + raceSide;
    }, [liquidity, racePriceWei]);

    const availableStakeTiers = useMemo(() => {
        // Flexible only after on-chain RaceICO.icoCompleted.
        if (icoCompleted) return lockTiers;
        return lockTiers.filter((t) => Number(t.days) > 0);
    }, [lockTiers, icoCompleted]);

    const selectedTier = useMemo(
        () =>
            availableStakeTiers.find((t) => String(t.days) === stakeTierDays) ??
            availableStakeTiers[0],
        [availableStakeTiers, stakeTierDays],
    );

    useEffect(() => {
        if (!availableStakeTiers.length) return;
        const stillValid = availableStakeTiers.some((t) => String(t.days) === String(stakeTierDays));
        if (!stillValid) {
            setStakeTierDays(String(availableStakeTiers[0].days));
        }
    }, [availableStakeTiers, stakeTierDays]);

    const connectWallet = async () => {
        setWalletError('');
        if (typeof window === 'undefined' || !window.ethereum) {
            setWalletError('No Web3 wallet detected. Install MetaMask or Trust Wallet.');
            return;
        }
        setConnecting(true);
        try {
            const address = await connectWalletOnNetwork();
            await linkWalletToAccount(address);
        } catch (err) {
            setWalletError(friendlySwapError(err));
        } finally {
            setConnecting(false);
        }
    };

    const ensureNetworkForTx = async (setErrorFn) => {
        if (chainOk) {
            return true;
        }
        try {
            await switchNetwork();
            return true;
        } catch (err) {
            setErrorFn(friendlySwapError(err));
            return false;
        }
    };

    const rpcUrl = config.rpc_url ?? '';

    const refreshMarket = useCallback(async () => {
        if (!contractsDeployed) {
            return;
        }
        setMarketLoading(true);
        setMarketError('');
        try {
            const price = await readRaceUsdtPrice({
                router: pancakeRouter,
                raceToken,
                usdtContract,
                rpcUrl,
            });
            setRacePriceWei(price);

            const liq = await readPairLiquidity({
                router: pancakeRouter,
                raceToken,
                usdtContract,
                rpcUrl,
            });
            setLiquidity(liq);

            if (walletAddress && window.ethereum) {
                const [race, usdt] = await Promise.all([
                    readErc20Balance({ token: raceToken, wallet: walletAddress, rpcUrl }),
                    readErc20Balance({ token: usdtContract, wallet: walletAddress, rpcUrl }),
                ]);
                setRaceBalance(race);
                setUsdtBalance(usdt);
            }

            if (icoContract) {
                try {
                    const done = await readIcoCompleted({ icoContract, rpcUrl });
                    setIcoCompleted(Boolean(done));
                } catch {
                    setIcoCompleted(false);
                }
            } else {
                // No ICO wired — Flexible allowed (matches Engine when icoContract unset).
                setIcoCompleted(true);
            }
        } catch (err) {
            setMarketError(friendlySwapError(err));
        } finally {
            setMarketLoading(false);
        }
    }, [contractsDeployed, pancakeRouter, raceToken, usdtContract, walletAddress, rpcUrl, icoContract]);

    const refreshStakes = useCallback(async () => {
        if (!walletAddress || !engineContract) {
            setStakes([]);
            return;
        }
        setStakesLoading(true);
        try {
            const [allStakes, state, rank, count] = await Promise.all([
                readAllOnChainStakes({ walletAddress, engineContract, rpcUrl }),
                readEngineMemberState({ walletAddress, engineContract, rpcUrl }),
                readMemberRank({ walletAddress, engineContract, rpcUrl }),
                readStakeCount({ walletAddress, engineContract, rpcUrl }),
            ]);
            setStakes(allStakes);
            setMemberState(state);
            setMemberRank(rank);
            setStakeCount(count);
        } catch {
            setStakes([]);
            setMemberRank(0);
            setStakeCount(0);
        } finally {
            setStakesLoading(false);
        }
    }, [walletAddress, engineContract, rpcUrl]);

    useEffect(() => {
        refreshMarket();
        const id = setInterval(refreshMarket, 30000);
        return () => clearInterval(id);
    }, [refreshMarket]);

    useEffect(() => {
        refreshStakes();
    }, [refreshStakes]);

    useEffect(() => {
        if (!contractsDeployed || !buyAmount || Number(buyAmount) <= 0) {
            setBuyQuote(0n);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const amountIn = parseTokenAmount(buyAmount, 18);
                const quote = await getSwapQuote({
                    router: pancakeRouter,
                    path: [usdtContract, raceToken],
                    amountIn,
                    rpcUrl,
                });
                if (!cancelled) setBuyQuote(quote);
            } catch {
                if (!cancelled) setBuyQuote(0n);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [buyAmount, contractsDeployed, pancakeRouter, raceToken, usdtContract, rpcUrl]);

    useEffect(() => {
        if (!contractsDeployed || !sellAmount || Number(sellAmount) <= 0) {
            setSellQuote(0n);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const amountIn = parseTokenAmount(sellAmount, 18);
                const quote = await getSwapQuote({
                    router: pancakeRouter,
                    path: [raceToken, usdtContract],
                    amountIn,
                    rpcUrl,
                });
                if (!cancelled) setSellQuote(quote);
            } catch {
                if (!cancelled) setSellQuote(0n);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [sellAmount, contractsDeployed, pancakeRouter, raceToken, usdtContract, rpcUrl]);

    const handleBuy = async (e) => {
        e.preventDefault();
        setSwapError('');
        setSwapTx('');
        if (!walletAddress) {
            setSwapError('Connect your wallet first.');
            return;
        }
        if (!contractsDeployed) {
            setSwapError('RACE contracts are not deployed on this network yet.');
            return;
        }
        if (!(await ensureNetworkForTx(setSwapError))) {
            return;
        }
        setSwapBusy(true);
        try {
            const txHash = await buyRaceWithUsdt({
                walletAddress,
                router: pancakeRouter,
                usdtContract,
                raceToken,
                amountUsd: buyAmount,
                slippageBps,
                deadlineSeconds,
            });
            setSwapTx(txHash);
            setBuyAmount('');
            await refreshMarket();
        } catch (err) {
            setSwapError(friendlySwapError(err));
        } finally {
            setSwapBusy(false);
        }
    };

    const handleSell = async (e) => {
        e.preventDefault();
        setSwapError('');
        setSwapTx('');
        if (!walletAddress) {
            setSwapError('Connect your wallet first.');
            return;
        }
        if (!contractsDeployed) {
            setSwapError('RACE contracts are not deployed on this network yet.');
            return;
        }
        if (!(await ensureNetworkForTx(setSwapError))) {
            return;
        }
        setSwapBusy(true);
        try {
            const txHash = await sellRaceForUsdt({
                walletAddress,
                router: pancakeRouter,
                usdtContract,
                raceToken,
                amountRace: sellAmount,
                slippageBps,
                deadlineSeconds,
            });
            setSwapTx(txHash);
            setSellAmount('');
            await refreshMarket();
        } catch (err) {
            setSwapError(friendlySwapError(err));
        } finally {
            setSwapBusy(false);
        }
    };

    const handleParticipate = async (e) => {
        e.preventDefault();
        setStakeError('');
        setStakeTx('');
        if (!walletAddress) {
            setStakeError('Connect your wallet first.');
            return;
        }
        if (!engineDeployed) {
            setStakeError('RACE Community Engine is not deployed on this network yet.');
            return;
        }
        if (!(await ensureNetworkForTx(setStakeError))) {
            return;
        }
        if (!selectedTier) {
            setStakeError('Select a valid lock tier.');
            return;
        }
        const amount = Number(stakeAmount);
        if (!Number.isFinite(amount) || amount < minUsdt) {
            setStakeError(`Minimum participation is $${minUsdt} USDT.`);
            return;
        }
        setStakeBusy(true);
        try {
            const txHash = await purchaseOnChainParticipation({
                walletAddress,
                engineContract,
                usdtContract,
                amountUsd: stakeAmount,
                lockSeconds: selectedTier.seconds ?? 0,
            });
            setStakeTx(txHash);
            await refreshStakes();
            await refreshMarket();
        } catch (err) {
            setStakeError(friendlyEngineError(err));
        } finally {
            setStakeBusy(false);
        }
    };

    const handleClaim = async (stakeIndex) => {
        setStakeError('');
        if (!(await ensureNetworkForTx(setStakeError))) {
            return;
        }
        setActionBusyIndex(`claim-${stakeIndex}`);
        try {
            const txHash = await claimOnChainReward({ walletAddress, engineContract, stakeIndex });
            setStakeTx(txHash);
            await refreshStakes();
        } catch (err) {
            setStakeError(friendlyEngineError(err));
        } finally {
            setActionBusyIndex(null);
        }
    };

    const handleWithdraw = async (stakeIndex) => {
        setStakeError('');
        if (!(await ensureNetworkForTx(setStakeError))) {
            return;
        }
        setActionBusyIndex(`withdraw-${stakeIndex}`);
        try {
            const txHash = await withdrawOnChainStake({ walletAddress, engineContract, stakeIndex });
            setStakeTx(txHash);
            await refreshStakes();
            await refreshMarket();
        } catch (err) {
            setStakeError(friendlyEngineError(err));
        } finally {
            setActionBusyIndex(null);
        }
    };

    const handleMature = async (stakeIndex) => {
        setStakeError('');
        if (!(await ensureNetworkForTx(setStakeError))) {
            return;
        }
        setActionBusyIndex(`mature-${stakeIndex}`);
        try {
            const txHash = await matureOnChainStake({ walletAddress, engineContract, stakeIndex });
            setStakeTx(txHash);
            await refreshStakes();
            await refreshMarket();
        } catch (err) {
            setStakeError(friendlyEngineError(err));
        } finally {
            setActionBusyIndex(null);
        }
    };

    const handleClaimEmi = async (stakeIndex, emiNumber) => {
        setStakeError('');
        if (!(await ensureNetworkForTx(setStakeError))) {
            return;
        }
        setActionBusyIndex(`emi-${stakeIndex}-${emiNumber}`);
        try {
            const txHash = await claimOnChainMaturityEmi({
                walletAddress,
                engineContract,
                stakeIndex,
                emiNumber,
            });
            setStakeTx(txHash);
            await refreshStakes();
            await refreshMarket();
        } catch (err) {
            setStakeError(friendlyEngineError(err));
        } finally {
            setActionBusyIndex(null);
        }
    };

    const racePriceDisplay = racePriceWei != null ? formatUsdFromWei(racePriceWei) : marketLoading ? 'Loading…' : '—';

    return (
        <AuthenticatedLayout>
            <Head title="RACE Token" />
            <MemberPageShell>
                <MemberPageHero
                    title="RACE Token"
                    subtitle="On-chain swap, liquidity, and participation via BSC smart contracts."
                    bannerSrc={RACE_BANNER_TOKEN}
                />

                {!contractsDeployed && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
                        RACE contracts are not deployed on this network yet. Set contract addresses in your environment
                        configuration.
                    </div>
                )}

                {/* A. RACE TOKEN */}
                <PanelCard className="mt-6">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                        <div className="flex items-center gap-4">
                            <img src={RACE_LOGO_SRC} alt="RACE" className="h-16 w-16 rounded-2xl object-contain" />
                            <div>
                                <h2 className="text-xl font-bold text-white">RACE Coin</h2>
                                <p className="text-sm text-slate-400">{config.network_name ?? 'BNB Smart Chain'}</p>
                            </div>
                        </div>
                        <div className="grid flex-1 gap-3 sm:grid-cols-2">
                            <InfoRow label="Contract" value={raceToken || 'Not configured'} mono />
                            <InfoRow label="Live RACE / USDT" value={racePriceDisplay} />
                            <InfoRow label="Your RACE" value={formatTokenWei(raceBalance, 18, 4)} />
                            <InfoRow label="Your USDT" value={formatTokenWei(usdtBalance, 18, 2)} />
                        </div>
                    </div>
                    {marketError ? <p className="mt-3 text-sm text-rose-300">{marketError}</p> : null}
                </PanelCard>

                {/* Ecosystem icons + related live data */}
                <PanelCard title="RACE Ecosystem" className="mt-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <EcosystemFeatureCard
                            icon={IconRaceToken}
                            title="RACE Token"
                            description="Official BEP20 token on BNB Smart Chain."
                        >
                            <FeatureDataRow label="Symbol" value="RACE" />
                            <FeatureDataRow label="Network" value={config.network_name ?? 'BSC'} />
                            <FeatureDataRow label="Live price" value={racePriceDisplay} />
                            <FeatureDataRow label="Your balance" value={`${formatTokenWei(raceBalance, 18, 4)} RACE`} />
                            <FeatureDataRow
                                label="Contract"
                                value={raceToken ? shortenAddress(raceToken) : 'Not set'}
                                mono
                                href={explorerAddress(explorer, raceToken)}
                            />
                        </EcosystemFeatureCard>

                        <EcosystemFeatureCard
                            icon={IconBsc}
                            title={config.is_testnet ? 'BNB Smart Chain Testnet' : 'BNB Smart Chain'}
                            description={
                                config.is_testnet
                                    ? 'All RACE transactions run on BSC Testnet (chain 97).'
                                    : 'All RACE transactions run on BSC mainnet.'
                            }
                        >
                            <FeatureDataRow label="Chain ID" value={String(config.chain_id ?? 56)} />
                            <FeatureDataRow label="Network" value={config.network_name ?? 'BSC'} />
                            <FeatureDataRow
                                label="Status"
                                value={chainOk ? connectedLabel : 'Wrong Network'}
                            />
                            <FeatureDataRow label="Gas token" value="BNB" />
                            <FeatureDataRow label="Explorer" value="BscScan" href={explorer} />
                        </EcosystemFeatureCard>

                        <EcosystemFeatureCard
                            icon={IconUsdt}
                            title="USDT (BEP20)"
                            description="Stablecoin used for swap and participation."
                        >
                            <FeatureDataRow label="Token" value="Tether USD" />
                            <FeatureDataRow label="Your balance" value={`${formatTokenWei(usdtBalance, 18, 2)} USDT`} />
                            <FeatureDataRow
                                label="Contract"
                                value={usdtContract ? shortenAddress(usdtContract) : 'Not set'}
                                mono
                                href={explorerAddress(explorer, usdtContract)}
                            />
                            <FeatureDataRow label="Min stake" value={`$${minUsdt} USDT`} />
                            <FeatureDataRow label="Qualifying stake" value={`$${qualifyingUsdt} USDT`} />
                        </EcosystemFeatureCard>

                        <EcosystemFeatureCard
                            icon={IconMetaMask}
                            title="MetaMask"
                            description="Browser extension wallet for signing transactions."
                        >
                            <FeatureDataRow
                                label="Wallet"
                                value={walletAddress ? shortenAddress(walletAddress) : 'Not connected'}
                                mono
                            />
                            <FeatureDataRow label="RACE" value={formatTokenWei(raceBalance, 18, 4)} />
                            <FeatureDataRow label="USDT" value={formatTokenWei(usdtBalance, 18, 2)} />
                            <FeatureDataRow label="Action" value={walletAddress ? 'Ready to sign' : 'Connect below'} />
                        </EcosystemFeatureCard>

                        <EcosystemFeatureCard
                            icon={IconWalletConnect}
                            title="Trust / WalletConnect"
                            description="Mobile & multi-wallet via injected Web3 provider."
                        >
                            <FeatureDataRow label="Supported" value="Trust Wallet, TokenPocket, etc." />
                            <FeatureDataRow label="Connection" value={walletAddress ? 'Active' : 'Disconnected'} />
                            <FeatureDataRow label="Network" value={chainOk ? networkLabel : 'Wrong Network'} />
                            <FeatureDataRow label="Custody" value="Non-custodial" />
                        </EcosystemFeatureCard>

                        <EcosystemFeatureCard
                            icon={IconPancake}
                            title="PancakeSwap"
                            description="DEX router for live RACE/USDT swaps."
                        >
                            <FeatureDataRow
                                label="Router"
                                value={pancakeRouter ? shortenAddress(pancakeRouter) : 'Not set'}
                                mono
                                href={explorerAddress(explorer, pancakeRouter)}
                            />
                            <FeatureDataRow label="Pair" value="RACE / USDT" />
                            <FeatureDataRow
                                label="Pair address"
                                value={liquidity?.pair ? shortenAddress(liquidity.pair) : 'No pair'}
                                mono
                                href={liquidity?.pair ? explorerAddress(explorer, liquidity.pair) : null}
                            />
                            <FeatureDataRow label="Slippage" value={`${(slippageBps / 100).toFixed(2)}%`} />
                        </EcosystemFeatureCard>

                        <EcosystemFeatureCard
                            icon={IconSwap}
                            title="Swap"
                            description="Buy & sell RACE directly to your wallet."
                        >
                            <FeatureDataRow label="Buy route" value="USDT → RACE" />
                            <FeatureDataRow label="Sell route" value="RACE → USDT" />
                            <FeatureDataRow label="Live price" value={racePriceDisplay} />
                            <FeatureDataRow
                                label="Est. buy output"
                                value={buyQuote > 0n ? `${formatTokenWei(buyQuote, 18, 4)} RACE` : '—'}
                            />
                            <FeatureDataRow
                                label="Est. sell output"
                                value={sellQuote > 0n ? `${formatTokenWei(sellQuote, 18, 2)} USDT` : '—'}
                            />
                        </EcosystemFeatureCard>

                        <EcosystemFeatureCard
                            icon={IconStake}
                            title="Participation / Stake"
                            description="RaceCommunityEngine on-chain staking tiers."
                        >
                            <FeatureDataRow
                                label="Engine"
                                value={engineContract ? shortenAddress(engineContract) : 'Not deployed'}
                                mono
                                href={explorerAddress(explorer, engineContract)}
                            />
                            <FeatureDataRow label="Lock tiers" value={`${lockTiers.length} options`} />
                            <FeatureDataRow
                                label="Your stakes"
                                value={walletAddress ? String(stakeCount) : '—'}
                            />
                            <FeatureDataRow
                                label="Status"
                                value={
                                    memberState.participationActive
                                        ? 'Participation active'
                                        : 'Not active'
                                }
                            />
                            <FeatureDataRow label="Withdraw fee" value={`${engine.stake_withdraw_fee_percent ?? '10'}%`} />
                        </EcosystemFeatureCard>

                        <EcosystemFeatureCard
                            icon={IconLiquidity}
                            title="Liquidity"
                            description="Live reserves from PancakeSwap pair."
                        >
                            <FeatureDataRow
                                label="USDT pool"
                                value={
                                    liquidity?.reserveUsdt != null
                                        ? formatTokenWei(liquidity.reserveUsdt, 18, 2)
                                        : '—'
                                }
                            />
                            <FeatureDataRow
                                label="RACE pool"
                                value={
                                    liquidity?.reserveRace != null
                                        ? formatTokenWei(liquidity.reserveRace, 18, 2)
                                        : '—'
                                }
                            />
                            <FeatureDataRow
                                label="Pool TVL (est.)"
                                value={
                                    liquidityUsdEstimate != null
                                        ? new Intl.NumberFormat(undefined, {
                                              style: 'currency',
                                              currency: 'USD',
                                              maximumFractionDigits: 0,
                                          }).format(liquidityUsdEstimate)
                                        : '—'
                                }
                            />
                            <FeatureDataRow label="Price source" value="On-chain getAmountsOut" />
                        </EcosystemFeatureCard>

                        <EcosystemFeatureCard
                            icon={IconSecureWallet}
                            title="Secure Wallet"
                            description="You sign every transaction — keys never leave your device."
                        >
                            <FeatureDataRow label="Private keys" value="Never stored on server" />
                            <FeatureDataRow label="Admin control" value="Cannot change your balance" />
                            <FeatureDataRow label="Swap custody" value="Direct to your wallet" />
                            <FeatureDataRow label="Approvals" value="You approve in wallet" />
                        </EcosystemFeatureCard>

                        <EcosystemFeatureCard
                            icon={IconOnChainRewards}
                            title="On-chain Rewards"
                            description="Daily RACE rewards paid from RewardVault."
                        >
                            <FeatureDataRow
                                label="Vault"
                                value={contracts.reward_vault ? shortenAddress(contracts.reward_vault) : 'Not set'}
                                mono
                                href={explorerAddress(explorer, contracts.reward_vault)}
                            />
                            <FeatureDataRow
                                label="Pending rewards"
                                value={`${formatTokenWei(totalPendingRace, 18, 4)} RACE`}
                            />
                            <FeatureDataRow
                                label="Active principal"
                                value={`${formatTokenWei(totalStakedUsdt, 18, 2)} USDT`}
                            />
                            <FeatureDataRow label="Member rank" value={walletAddress ? String(memberRank) : '—'} />
                        </EcosystemFeatureCard>
                    </div>
                </PanelCard>

                {/* Contract addresses */}
                <PanelCard title="Smart Contracts" className="mt-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                        {[
                            ['RACE Token', contracts.race_token],
                            ['Community Engine', contracts.community_engine],
                            ['Reward Vault', contracts.reward_vault],
                            ['Treasury', contracts.treasury],
                            ['Auto Liquidity', contracts.auto_liquidity],
                            ['Governor', contracts.governor],
                            ['Pancake Router', contracts.pancake_router],
                            ['USDT (BEP20)', contracts.usdt],
                        ].map(([label, address]) => (
                            <div key={label} className="rounded-xl border border-sky-500/15 bg-slate-900/35 p-3">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                                <div className="mt-1">
                                    <ContractLink explorer={explorer} address={address} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                        All addresses are read from server config. Price and liquidity are fetched live from chain — not
                        editable by admin.
                    </p>
                </PanelCard>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    {/* B. WALLET */}
                    <PanelCard title="Wallet">
                        <p className="mb-4 text-sm text-slate-400">
                            Connect MetaMask, Trust Wallet, or any WalletConnect-compatible EVM wallet via your browser
                            extension or mobile dApp browser.
                        </p>
                        {walletAddress ? (
                            <div className="space-y-3">
                                <Web3NetworkBanner
                                    chainOk={chainOk}
                                    connectedLabel={connectedLabel}
                                    switchButtonLabel={switchButtonLabel}
                                    switching={networkSwitching}
                                    networkError={networkSwitchError}
                                    onSwitch={switchNetwork}
                                />
                                <div className="space-y-2 text-sm">
                                    <InfoRow label="Connected wallet" value={shortenAddress(walletAddress)} mono />
                                    <InfoRow label="Network" value={chainOk ? networkLabel : 'Wrong Network'} />
                                    <InfoRow label="RACE Balance" value={formatTokenWei(raceBalance, 18, 4)} />
                                    <InfoRow label="USDT Balance" value={formatTokenWei(usdtBalance, 18, 2)} />
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-3">
                                <PrimaryButton type="button" onClick={connectWallet} disabled={connecting || networkSwitching}>
                                    {connecting || networkSwitching ? 'Connecting…' : 'Connect Wallet'}
                                </PrimaryButton>
                            </div>
                        )}
                        {walletError ? <p className="mt-3 text-sm text-rose-300">{walletError}</p> : null}
                    </PanelCard>

                    {/* K. LIQUIDITY */}
                    <PanelCard title="Liquidity">
                        <div className="space-y-2 text-sm">
                            <InfoRow label="Pair" value="RACE / USDT" />
                            <InfoRow
                                label="PancakeSwap Pair"
                                value={liquidity?.pair ? shortenAddress(liquidity.pair) : 'No pair found'}
                                mono
                            />
                            <InfoRow
                                label="USDT in pool"
                                value={
                                    liquidity?.reserveUsdt != null
                                        ? formatTokenWei(liquidity.reserveUsdt, 18, 2)
                                        : '—'
                                }
                            />
                            <InfoRow
                                label="RACE in pool"
                                value={
                                    liquidity?.reserveRace != null
                                        ? formatTokenWei(liquidity.reserveRace, 18, 2)
                                        : '—'
                                }
                            />
                            <InfoRow label="Router" value={shortenAddress(pancakeRouter)} mono />
                        </div>
                        <p className="mt-3 text-xs text-slate-500">
                            Liquidity and price are read live from the PancakeSwap pair — not set by admin.
                        </p>
                    </PanelCard>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    {/* C. BUY RACE */}
                    <PanelCard title="Buy RACE">
                        <form onSubmit={handleBuy} className="space-y-4">
                            <div>
                                <label className="mb-1 block text-xs font-medium uppercase text-slate-400">
                                    USDT amount
                                </label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    className={fieldClass}
                                    value={buyAmount}
                                    onChange={(e) => setBuyAmount(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="rounded-xl border border-sky-500/20 bg-slate-900/40 p-3 text-sm space-y-1">
                                <InfoRow label="Route" value="USDT → RACE" />
                                <InfoRow label="Live price" value={racePriceDisplay} />
                                <InfoRow
                                    label="Estimated RACE"
                                    value={buyQuote > 0n ? formatTokenWei(buyQuote, 18, 4) : '—'}
                                />
                                <InfoRow label="Slippage" value={`${(slippageBps / 100).toFixed(2)}%`} />
                                <InfoRow label="Network fee" value="Paid in BNB from your wallet" />
                            </div>
                            <PrimaryButton type="submit" disabled={swapBusy || !buyAmount || !walletAddress}>
                                {swapBusy ? 'Confirm in wallet…' : 'Buy RACE on PancakeSwap'}
                            </PrimaryButton>
                        </form>
                    </PanelCard>

                    {/* D. SELL RACE */}
                    <PanelCard title="Sell / Swap RACE">
                        <form onSubmit={handleSell} className="space-y-4">
                            <div>
                                <label className="mb-1 block text-xs font-medium uppercase text-slate-400">
                                    RACE amount
                                </label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    className={fieldClass}
                                    value={sellAmount}
                                    onChange={(e) => setSellAmount(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="rounded-xl border border-sky-500/20 bg-slate-900/40 p-3 text-sm space-y-1">
                                <InfoRow label="Route" value="RACE → USDT" />
                                <InfoRow label="Live price" value={racePriceDisplay} />
                                <InfoRow
                                    label="Estimated USDT"
                                    value={sellQuote > 0n ? formatTokenWei(sellQuote, 18, 2) : '—'}
                                />
                                <InfoRow label="Slippage" value={`${(slippageBps / 100).toFixed(2)}%`} />
                                <InfoRow label="Gas fee" value="Paid in BNB from your wallet" />
                            </div>
                            <PrimaryButton type="submit" disabled={swapBusy || !sellAmount || !walletAddress}>
                                {swapBusy ? 'Confirm in wallet…' : 'Sell RACE on PancakeSwap'}
                            </PrimaryButton>
                        </form>
                    </PanelCard>
                </div>

                {swapError ? <p className="mt-4 text-sm text-rose-300">{swapError}</p> : null}
                <TxSuccessBanner txHash={swapTx} explorer={explorer} />

                {/* E. PARTICIPATE */}
                <PanelCard title="Participate / Stake" className="mt-6">
                    {!engineDeployed ? (
                        <p className="text-sm text-amber-200">
                            RACE Community Engine is not deployed on this network yet.
                        </p>
                    ) : (
                        <>
                            <p className="mb-4 text-sm text-slate-400">
                                Uses <span className="font-mono text-sky-300">RaceCommunityEngine</span> on-chain.
                                Minimum qualifying participation: ${qualifyingUsdt} USDT. Flexible plan is available
                                only after on-chain <span className="font-mono">RaceICO.icoCompleted</span>
                                {icoContract
                                    ? icoCompleted
                                        ? ' (ICO completed — Flexible unlocked).'
                                        : ' (ICO still active — fixed plans only).'
                                    : '.'}{' '}
                                Rewards and withdrawals follow contract rules — no Laravel approval.
                            </p>

                            <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                                {availableStakeTiers.map((tier) => (
                                    <div
                                        key={tier.days}
                                        className="rounded-xl border border-sky-500/25 bg-slate-900/50 px-3 py-2 text-center"
                                    >
                                        <p className="text-xs font-medium text-slate-400">{tier.label}</p>
                                        <p className="text-lg font-bold text-sky-200">{tier.daily_roi_percent}%</p>
                                        <p className="text-[10px] text-slate-500">daily</p>
                                    </div>
                                ))}
                            </div>

                            {walletAddress ? (
                                <p className="mb-3 text-xs text-slate-400">
                                    On-chain status:{' '}
                                    {memberState.participationActive ? 'Participation active' : 'Not active'} ·{' '}
                                    {memberState.registered ? 'Registered' : 'Not registered'}
                                </p>
                            ) : null}

                            <form onSubmit={handleParticipate} className="grid gap-4 lg:grid-cols-3">
                                <div>
                                    <label className="mb-1 block text-xs font-medium uppercase text-slate-400">
                                        USDT amount
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        className={fieldClass}
                                        value={stakeAmount}
                                        onChange={(e) => setStakeAmount(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium uppercase text-slate-400">
                                        Lock tier
                                    </label>
                                    <select
                                        className={fieldClass}
                                        value={stakeTierDays}
                                        onChange={(e) => setStakeTierDays(e.target.value)}
                                    >
                                        {availableStakeTiers.map((tier) => (
                                            <option key={tier.days} value={String(tier.days)}>
                                                {tier.label} — {tier.daily_roi_percent}% daily
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <PrimaryButton
                                        type="submit"
                                        className="w-full"
                                        disabled={stakeBusy || !walletAddress}
                                    >
                                        {stakeBusy ? 'Confirm in wallet…' : 'Participate on-chain'}
                                    </PrimaryButton>
                                </div>
                            </form>
                        </>
                    )}
                    {stakeError ? <p className="mt-3 text-sm text-rose-300">{stakeError}</p> : null}
                    <TxSuccessBanner txHash={stakeTx} explorer={explorer} />
                </PanelCard>

                {/* F & G. STAKES */}
                {engineDeployed && walletAddress ? (
                    <PanelCard title="Your on-chain participations" className="mt-6">
                        {stakesLoading ? (
                            <p className="text-sm text-slate-400">Loading stakes from contract…</p>
                        ) : stakes.length === 0 ? (
                            <p className="text-sm text-slate-400">No on-chain stakes found for this wallet.</p>
                        ) : (
                            <div className="space-y-4">
                                {stakes.map((stake) => {
                                    const isFlexible = stake.lockPeriod === 0;
                                    const now = Math.floor(Date.now() / 1000);
                                    const unlocked = stake.unlockAt <= now || isFlexible;
                                    const dailyPercent = (stake.dailyRateBps / 100).toFixed(2);
                                    const emi = stake.maturityEmi;
                                    const isMaturedEmi = Boolean(emi?.matured) && !emi?.closed;
                                    const isClosed = Boolean(stake.withdrawn) || Boolean(emi?.closed);

                                    const emiRows = isMaturedEmi
                                        ? [
                                              {
                                                  n: 1,
                                                  amount: emi.emi1Race,
                                                  due: emi.due1,
                                                  claimed: emi.claimed1,
                                              },
                                              {
                                                  n: 2,
                                                  amount: emi.emi2Race,
                                                  due: emi.due2,
                                                  claimed: emi.claimed2,
                                              },
                                              {
                                                  n: 3,
                                                  amount: emi.emi3Race,
                                                  due: emi.due3,
                                                  claimed: emi.claimed3,
                                              },
                                          ]
                                        : [];

                                    return (
                                        <div
                                            key={stake.index}
                                            className="rounded-xl border border-sky-500/20 bg-slate-900/40 p-4"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <h3 className="font-semibold text-white">
                                                    Stake #{stake.index + 1} ·{' '}
                                                    {isFlexible
                                                        ? 'Flexible'
                                                        : `${Math.round(stake.lockPeriod / 86400)} Days`}
                                                    {isMaturedEmi ? ' · STAKE MATURED' : null}
                                                    {emi?.closed ? ' · Closed' : null}
                                                </h3>
                                                <span className="text-xs text-sky-300">
                                                    {isMaturedEmi
                                                        ? 'EMI escrow'
                                                        : `${dailyPercent}% daily`}
                                                </span>
                                            </div>

                                            {isMaturedEmi ? (
                                                <>
                                                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                                                        <InfoRow
                                                            label="Original Principal"
                                                            value={`${formatTokenWei(emi.principalRace, 18, 4)} RACE`}
                                                        />
                                                        <InfoRow
                                                            label="10% Company Treasury Fee"
                                                            value={`${formatTokenWei(emi.feeRace, 18, 4)} RACE`}
                                                        />
                                                        <InfoRow
                                                            label="90% EMI Principal"
                                                            value={`${formatTokenWei(emi.emiPoolRace, 18, 4)} RACE`}
                                                        />
                                                    </div>
                                                    <div className="mt-4 space-y-2">
                                                        {emiRows.map((row) => {
                                                            const dueReached = now >= Number(row.due || 0);
                                                            return (
                                                                <div
                                                                    key={row.n}
                                                                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2 text-sm"
                                                                >
                                                                    <div>
                                                                        <p className="font-medium text-slate-100">
                                                                            EMI {row.n}
                                                                        </p>
                                                                        <p className="text-xs text-slate-400">
                                                                            {formatTokenWei(row.amount, 18, 4)}{' '}
                                                                            RACE · Due{' '}
                                                                            {formatDate(row.due)}
                                                                        </p>
                                                                    </div>
                                                                    {row.claimed ? (
                                                                        <span className="text-xs text-slate-500">
                                                                            Claimed
                                                                        </span>
                                                                    ) : dueReached ? (
                                                                        <PrimaryButton
                                                                            type="button"
                                                                            onClick={() =>
                                                                                handleClaimEmi(
                                                                                    stake.index,
                                                                                    row.n,
                                                                                )
                                                                            }
                                                                            disabled={actionBusyIndex != null}
                                                                        >
                                                                            {actionBusyIndex ===
                                                                            `emi-${stake.index}-${row.n}`
                                                                                ? 'Claiming…'
                                                                                : 'Claim'}
                                                                        </PrimaryButton>
                                                                    ) : (
                                                                        <span className="text-xs text-amber-300/90">
                                                                            Locked
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                                                        <InfoRow
                                                            label="Principal (USDT)"
                                                            value={formatTokenWei(stake.principalUsdt, 18, 2)}
                                                        />
                                                        <InfoRow
                                                            label="Staked RACE"
                                                            value={formatTokenWei(stake.stakedRace, 18, 4)}
                                                        />
                                                        <InfoRow
                                                            label="Start"
                                                            value={formatDate(stake.startedAt)}
                                                        />
                                                        {!isFlexible ? (
                                                            <>
                                                                <InfoRow
                                                                    label="Unlock"
                                                                    value={formatDate(stake.unlockAt)}
                                                                />
                                                                <InfoRow
                                                                    label="Remaining"
                                                                    value={formatRemaining(stake.unlockAt)}
                                                                />
                                                            </>
                                                        ) : (
                                                            <InfoRow
                                                                label="Type"
                                                                value="Flexible — withdraw per contract rules"
                                                            />
                                                        )}
                                                        <InfoRow
                                                            label="Pending reward"
                                                            value={`${formatTokenWei(stake.pendingRewardRace, 18, 4)} RACE`}
                                                        />
                                                    </div>
                                                    {isClosed ? (
                                                        <p className="mt-3 text-xs text-slate-500">
                                                            Principal withdrawn / closed
                                                        </p>
                                                    ) : (
                                                        <div className="mt-4 flex flex-wrap gap-2">
                                                            {stake.pendingRewardRace > 0n ? (
                                                                <PrimaryButton
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleClaim(stake.index)
                                                                    }
                                                                    disabled={actionBusyIndex != null}
                                                                >
                                                                    {actionBusyIndex ===
                                                                    `claim-${stake.index}`
                                                                        ? 'Claiming…'
                                                                        : 'Claim rewards'}
                                                                </PrimaryButton>
                                                            ) : null}
                                                            {isFlexible && !stake.withdrawn ? (
                                                                <button
                                                                    type="button"
                                                                    className="rounded-xl border border-sky-500/40 px-4 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-950/50 disabled:opacity-50"
                                                                    onClick={() =>
                                                                        handleWithdraw(stake.index)
                                                                    }
                                                                    disabled={actionBusyIndex != null}
                                                                >
                                                                    {actionBusyIndex ===
                                                                    `withdraw-${stake.index}`
                                                                        ? 'Withdrawing…'
                                                                        : 'Withdraw principal'}
                                                                </button>
                                                            ) : null}
                                                            {!isFlexible && unlocked && !stake.withdrawn ? (
                                                                <PrimaryButton
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleMature(stake.index)
                                                                    }
                                                                    disabled={actionBusyIndex != null}
                                                                >
                                                                    {actionBusyIndex ===
                                                                    `mature-${stake.index}`
                                                                        ? 'Maturing…'
                                                                        : 'Mature stake (start EMI)'}
                                                                </PrimaryButton>
                                                            ) : null}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </PanelCard>
                ) : null}

                <p className="mt-8 text-center text-xs text-slate-500">
                    All swaps and participations are signed in your wallet. RACE Network does not hold your private keys.
                </p>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
