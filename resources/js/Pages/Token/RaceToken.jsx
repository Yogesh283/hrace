import PanelCard from '@/Components/PanelCard';
import MemberPageHero from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import PrimaryButton from '@/Components/PrimaryButton';
import Web3NetworkBanner from '@/Components/Web3NetworkBanner';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useWalletNetwork } from '@/hooks/useWalletNetwork';
import { RACE_BANNER_TOKEN, RACE_LOGO_SRC } from '@/lib/brandAssets';
import { linkWalletToAccount } from '@/lib/walletAccountLink';
import { formatTokenWei, readErc20Balance } from '@/lib/web3PancakeSwap';
import { Head, Link, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';

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

function ContractLink({ explorer, address, fallback = 'Not configured' }) {
    if (!address) {
        return <span className="text-slate-500">{fallback}</span>;
    }
    return (
        <a
            href={`${explorer}/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-mono text-[10px] text-sky-300 underline hover:text-sky-200"
        >
            {address}
        </a>
    );
}

/**
 * Clean RACE token overview — no DEX/stake UIs (those live on /swap, /ico, /investment).
 */
export default function RaceToken({ raceTokenConfig = {} }) {
    const { auth } = usePage().props;
    const walletAddress = auth?.user?.wallet_address ?? '';

    const config = raceTokenConfig;
    const raceToken = config.race_token ?? '';
    const usdtContract = config.usdt_contract ?? '';
    const contracts = config.contracts ?? {};
    const explorer = config.block_explorer ?? 'https://bscscan.com';

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
    const [raceBalance, setRaceBalance] = useState(0n);
    const [usdtBalance, setUsdtBalance] = useState(0n);

    const refreshBalances = useCallback(async () => {
        if (!walletAddress || !raceToken || !usdtContract) {
            setRaceBalance(0n);
            setUsdtBalance(0n);
            return;
        }
        try {
            const [race, usdt] = await Promise.all([
                readErc20Balance({ token: raceToken, wallet: walletAddress }),
                readErc20Balance({ token: usdtContract, wallet: walletAddress }),
            ]);
            setRaceBalance(race);
            setUsdtBalance(usdt);
        } catch {
            /* ignore — balances optional on overview */
        }
    }, [walletAddress, raceToken, usdtContract]);

    useEffect(() => {
        refreshBalances();
    }, [refreshBalances]);

    const connectWallet = async () => {
        setConnecting(true);
        setWalletError('');
        try {
            const address = await connectWalletOnNetwork();
            if (address) {
                await linkWalletToAccount(address);
            }
        } catch (err) {
            setWalletError(err?.message || 'Could not connect wallet.');
        } finally {
            setConnecting(false);
        }
    };

    const essentialContracts = [
        ['RACE Token', contracts.race_token || raceToken],
        ['USDT (BEP20)', contracts.usdt || usdtContract],
        ['Community Engine', contracts.community_engine],
        ['Reward Vault', contracts.reward_vault],
        ['ICO', contracts.ico],
        ['Treasury', contracts.treasury],
    ];

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">
                    RACE Coin
                </h2>
            }
        >
            <Head title="RACE Coin" />
            <MemberPageShell>
                <MemberPageHero
                    title="RACE Coin"
                    subtitle="Official BEP20 token on BNB Smart Chain. Swap, ICO, and staking use their own pages."
                    logoSrc={RACE_LOGO_SRC}
                    bannerSrc={RACE_BANNER_TOKEN}
                />

                <PanelCard className="mt-6">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                        <div className="flex items-center gap-4">
                            <img src={RACE_LOGO_SRC} alt="RACE" className="h-16 w-16 rounded-2xl object-contain" />
                            <div>
                                <h2 className="text-xl font-bold text-white">RACE</h2>
                                <p className="text-sm text-slate-400">{config.network_name ?? 'BNB Smart Chain'}</p>
                            </div>
                        </div>
                        <div className="grid flex-1 gap-3 sm:grid-cols-2">
                            <InfoRow label="Network" value={config.network_name ?? 'BSC'} />
                            <InfoRow label="Chain ID" value={String(config.chain_id ?? '—')} />
                            <InfoRow label="Your RACE" value={formatTokenWei(raceBalance, 18, 4)} />
                            <InfoRow label="Your USDT" value={formatTokenWei(usdtBalance, 18, 2)} />
                            <InfoRow
                                label="Contract"
                                value={raceToken ? shortenAddress(raceToken) : 'Not configured'}
                                mono
                            />
                        </div>
                    </div>
                    {raceToken ? (
                        <p className="mt-4 break-all font-mono text-xs text-slate-500">
                            Full address:{' '}
                            <a
                                href={`${explorer}/address/${raceToken}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-300 underline"
                            >
                                {raceToken}
                            </a>
                        </p>
                    ) : null}
                </PanelCard>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <PanelCard title="Wallet">
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
                                    <InfoRow label="Connected" value={shortenAddress(walletAddress)} mono />
                                    <InfoRow label="Network" value={chainOk ? networkLabel : 'Wrong Network'} />
                                </div>
                            </div>
                        ) : (
                            <PrimaryButton type="button" onClick={connectWallet} disabled={connecting || networkSwitching}>
                                {connecting || networkSwitching ? 'Connecting…' : 'Connect Wallet'}
                            </PrimaryButton>
                        )}
                        {walletError ? <p className="mt-3 text-sm text-rose-300">{walletError}</p> : null}
                    </PanelCard>

                    <PanelCard title="Go to">
                        <div className="flex flex-col gap-3">
                            <Link
                                href={route('swap')}
                                className="rounded-xl border border-sky-500/30 bg-slate-900/50 px-4 py-3 text-sm font-semibold text-sky-200 hover:border-sky-400/50"
                            >
                                Swap USDT ↔ RACE
                            </Link>
                            <Link
                                href={route('ico')}
                                className="rounded-xl border border-sky-500/30 bg-slate-900/50 px-4 py-3 text-sm font-semibold text-sky-200 hover:border-sky-400/50"
                            >
                                ICO Buy & Stake
                            </Link>
                            <Link
                                href={route('investment')}
                                className="rounded-xl border border-sky-500/30 bg-slate-900/50 px-4 py-3 text-sm font-semibold text-sky-200 hover:border-sky-400/50"
                            >
                                Staking
                            </Link>
                        </div>
                    </PanelCard>
                </div>

                <PanelCard title="Smart Contracts" className="mt-6">
                    <div className="grid gap-3 sm:grid-cols-2">
                        {essentialContracts.map(([label, address]) => (
                            <div key={label} className="rounded-xl border border-sky-500/15 bg-slate-900/35 p-3">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    {label}
                                </p>
                                <div className="mt-1">
                                    <ContractLink explorer={explorer} address={address} />
                                </div>
                            </div>
                        ))}
                    </div>
                </PanelCard>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
