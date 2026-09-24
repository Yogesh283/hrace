import PlanIncomeSection from '@/Components/PlanIncomeSection';
import MemberPageHero from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatMemberCode } from '@/lib/memberCode';
import { hasWeb3Wallet } from '@/lib/web3Auth';
import { chainIdMatches, readChainIdHex, readEngineMemberState } from '@/lib/web3Engine';
import { Head, Link, usePage, usePoll } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

function formatUsd(value) {
    const n = Number(value);
    if (Number.isNaN(n)) return '—';
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(n);
}

function formatUsdt(value) {
    const s = formatUsd(value);
    return s === '—' ? '—' : `${s} USDT`;
}

function formatRaceCoins(value) {
    const n = Number(value);
    if (Number.isNaN(n)) return '—';
    return `${new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(n)} RC`;
}

const defaultSummary = {
    balance_usd: '0.00',
    race_coin_balance: '0.0000',
    race_coin_price_usd: '0.10',
    lifetime_credits_usd: '0.00',
    total_income_usd: '0.00',
    today_income_usd: '0.00',
    today_income_count: 0,
    today_label: '',
    principal_invested_usd: '0.00',
    active_principal_usd: '0.00',
    roi_paid_usd: '0.00',
    active_investments: 0,
    income_by_type: {},
    plan_income: [],
    income_entries: [],
    income_payout_count: 0,
    recent_ledger: [],
    direct_referrals: 0,
    team_size: 0,
    income_pct: {
        total: '+0.00%',
        direct: '+0.00%',
        matching: '+0.00%',
        roi: '+0.00%',
        other: '+0.00%',
    },
    commission_breakdown: [],
    monthly_income_series: [],
    team_growth_series: [],
    network_preview: {},
};

function DpCard({ className = '', children, hover = true }) {
    return (
        <div
            className={`relative overflow-hidden rounded-[1.25rem] border border-white/90 bg-white/90 shadow-[0_6px_24px_-12px_rgba(37,99,235,0.16)] ${
                hover
                    ? 'transition duration-200 hover:border-sky-200/90 hover:shadow-[0_10px_28px_-12px_rgba(37,99,235,0.22)]'
                    : ''
            } ${className}`}
        >
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/40 to-transparent" />
            {children}
        </div>
    );
}

function DailyEarningCard({ amountUsd, count, dateLabel }) {
    const hasEarnings = Number(amountUsd) > 0;

    return (
        <DpCard className="border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-white/80 to-sky-50/50 p-5 sm:p-6">
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-emerald-700">Daily earning</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                        Reward credited today only · {dateLabel || 'Today'}
                    </p>
                    <p
                        className={`mt-3 font-mono text-3xl font-extrabold tracking-tight sm:text-4xl ${
                            hasEarnings ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                    >
                        {formatUsd(amountUsd)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                        {count > 0
                            ? `${count} credit${count === 1 ? '' : 's'} today (all reward types, excl. deposits)`
                            : 'No reward credits yet today — ROI and team payouts appear here when paid'}
                    </p>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                    <div className="flex h-14 w-14 items-center justify-center self-start rounded-2xl border border-emerald-200/80 bg-white/90 text-emerald-600 shadow-sm sm:self-auto">
                        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </div>
                    <Link
                        href={route('transactions')}
                        className="inline-flex items-center justify-center rounded-xl border border-emerald-200/80 bg-white/90 px-4 py-2 text-xs font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50"
                    >
                        View earnings ledger →
                    </Link>
                </div>
            </div>
        </DpCard>
    );
}

function GlassMetricCard({ title, value, sub, icon, tintClass }) {
    return (
        <DpCard className="p-4 sm:p-5">
            <div className="relative flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">{title}</p>
                    <p className="mt-2 break-words font-mono text-lg font-bold tracking-tight text-[#0F172A] sm:text-xl">
                        {value}
                    </p>
                    {sub ? <p className="mt-1 text-xs font-semibold text-emerald-600">{sub}</p> : null}
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-200/50 bg-gradient-to-br from-sky-50 to-white text-[#2563EB] shadow-[0_0_20px_rgba(56,189,248,0.25)]">
                    {icon}
                </div>
            </div>
        </DpCard>
    );
}

function useReferralLink() {
    const { user } = usePage().props.auth;
    return useMemo(() => {
        if (!user?.referral_code || typeof window === 'undefined') {
            return null;
        }
        return `${window.location.origin}/register?join_code=${encodeURIComponent(user.referral_code)}`;
    }, [user?.referral_code]);
}

function ReferralLinkCopyCard() {
    const { user } = usePage().props.auth;
    const referralLink = useReferralLink();
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        if (!referralLink) return;
        await navigator.clipboard.writeText(referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const code = user?.referral_code ? String(user.referral_code).toUpperCase() : null;

    return (
        <DpCard className="p-4 sm:p-5">
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2563EB] sm:text-[11px]">Referral</p>
                    <h3 className="mt-1 font-poppins text-lg font-bold text-[#0F172A] sm:text-xl">Your referral link</h3>
                    <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                        Copy the link below and share it with friends — they can sign up using your join code.
                    </p>
                </div>
            </div>
            {code ? (
                <p className="mt-2 font-mono text-xs font-semibold text-slate-600">
                    Join code: <span className="text-[#2563EB]">{code}</span>
                </p>
            ) : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <div className="relative min-w-0 flex-1">
                    <input
                        type="text"
                        readOnly
                        value={referralLink ?? '—'}
                        className="w-full truncate rounded-xl border border-[#2563EB]/35 bg-[#0F172A]/80 px-3 py-3 pr-3 font-mono text-[11px] text-slate-100 shadow-inner outline-none ring-0 sm:text-xs"
                        aria-label="Referral link"
                    />
                </div>
                <button
                    type="button"
                    disabled={!referralLink}
                    onClick={copy}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-200/70 bg-gradient-to-r from-[#2563EB] to-[#38BDF8] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_28px_-6px_rgba(37,99,235,0.45)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[8.5rem]"
                >
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 5.25H18A2.25 2.25 0 0120.25 7.5v12a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 19.5V7.5A2.25 2.25 0 016 5.25h2.25m9-3H9A2.25 2.25 0 006.75 4.5v15a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25V4.5A2.25 2.25 0 0015.75 2.25z"
                        />
                    </svg>
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
        </DpCard>
    );
}

function RoyaltyHexIcon({ children }) {
    return (
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center sm:h-14 sm:w-14">
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full drop-shadow-[0_4px_14px_rgba(37,99,235,0.5)]" aria-hidden>
                <polygon
                    points="50,4 91,27 91,73 50,96 9,73 9,27"
                    fill="url(#royaltyHexFill)"
                    stroke="#3B82F6"
                    strokeWidth="3"
                />
            </svg>
            <span className="relative text-sky-100">{children}</span>
        </span>
    );
}

function RoyaltyInfoRow({ icon, title, children }) {
    return (
        <div className="relative flex gap-3 rounded-2xl border border-sky-500/25 bg-white/[0.04] p-4 backdrop-blur-sm sm:gap-4 sm:p-5">
            <RoyaltyHexIcon>{icon}</RoyaltyHexIcon>
            <div className="min-w-0 flex-1">
                <h4 className="font-poppins text-sm font-extrabold uppercase tracking-wide text-amber-300 sm:text-base">
                    {title}
                </h4>
                <div className="mt-1.5 space-y-2 text-xs leading-relaxed text-slate-300 sm:text-[13px]">{children}</div>
            </div>
        </div>
    );
}

function RoyaltyCheck({ children }) {
    return (
        <p className="flex gap-2">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span>{children}</span>
        </p>
    );
}

function RoyaltyAchievementShowcase() {
    return (
        <section className="relative overflow-hidden rounded-[1.5rem] border border-amber-400/30 bg-gradient-to-b from-[#0a1230] via-[#0a1838] to-[#060d24] p-5 shadow-[0_24px_60px_-16px_rgba(4,10,30,0.8)] sm:p-8">
            <svg width="0" height="0" className="absolute" aria-hidden>
                <defs>
                    <linearGradient id="royaltyHexFill" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#0f2a5e" />
                        <stop offset="100%" stopColor="#0a1838" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="pointer-events-none absolute -left-16 top-10 h-48 w-48 rounded-full bg-sky-500/15 max-lg:hidden" aria-hidden />
            <div className="pointer-events-none absolute -right-16 bottom-10 h-48 w-48 rounded-full bg-amber-500/10 max-lg:hidden" aria-hidden />

            <div className="relative text-center">
                <h2 className="font-poppins text-3xl font-black leading-none tracking-tight sm:text-5xl">
                    <span className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">ROYALTY </span>
                    <span className="bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent">
                        ACHIEVEMENT
                    </span>
                </h2>
                <div className="mx-auto mt-4 inline-flex items-baseline gap-1.5 rounded-2xl border-2 border-amber-400/70 bg-[#0a1838]/80 px-6 py-2.5 shadow-[0_0_30px_rgba(245,158,11,0.35),inset_0_0_20px_rgba(245,158,11,0.12)] sm:px-8 sm:py-3">
                    <span className="font-poppins text-3xl font-black text-amber-300 drop-shadow-[0_0_12px_rgba(245,158,11,0.6)] sm:text-5xl">
                        $5000
                    </span>
                    <span className="font-poppins text-base font-bold text-slate-200 sm:text-xl">/month*</span>
                </div>
            </div>

            <div className="relative mt-6 space-y-3 sm:mt-8 sm:space-y-4">
                <RoyaltyInfoRow
                    title="Royalty Qualification"
                    icon={
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.09 9.09 0 003.741-.479 3 3 0 00-4.682-2.72M6.34 15.52a3 3 0 00-4.682 2.72 9.094 9.094 0 003.742.479m0 0a9 9 0 006.72 0m-6.72 0v.278a3 3 0 006.72 0v-.278m0 0a9.09 9.09 0 003.742.479m-3.742-.479a3 3 0 016.72 0M12 12a3 3 0 100-6 3 3 0 000 6z" />
                        </svg>
                    }
                >
                    <p>
                        Participants who have successfully achieved Leadership Rank 11 and subsequently have a direct team
                        member also achieve Leadership Rank 11 may transition from the Community Leadership Reward Program
                        to the Royalty Achievement Program, subject to the applicable program rules.
                    </p>
                    <p>
                        Upon qualification, Community Leadership Reward eligibility for the participant will cease, and
                        Royalty Achievement eligibility may commence.
                    </p>
                </RoyaltyInfoRow>

                <RoyaltyInfoRow
                    title="Royalty Eligibility Requirements"
                    icon={
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                        </svg>
                    }
                >
                    <p className="font-semibold text-slate-200">To remain eligible for the Royalty Achievement Program:</p>
                    <RoyaltyCheck>
                        Both the participant and the qualified Rank 11 team member must continuously maintain a minimum
                        cumulative team volume of <strong className="text-amber-300">USD 10,000,000</strong> each, in
                        accordance with the program requirements.
                    </RoyaltyCheck>
                    <RoyaltyCheck>
                        All eligibility criteria, compliance requirements, and governance policies must remain satisfied.
                    </RoyaltyCheck>
                </RoyaltyInfoRow>

                <RoyaltyInfoRow
                    title="Royalty Recognition"
                    icon={
                        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M5 16L3 6l5.5 4L12 4l3.5 6L21 6l-2 10H5zm0 2h14v2H5v-2z" />
                        </svg>
                    }
                >
                    <p>
                        Eligible participants who continue to satisfy the Royalty Achievement criteria may qualify for a
                        royalty allocation of up to <strong className="text-amber-300">USD 5,000</strong> per month,
                        subject to the approved program framework, treasury availability, governance policies, and ongoing
                        eligibility verification.
                    </p>
                </RoyaltyInfoRow>

                <RoyaltyInfoRow
                    title="Important Notice"
                    icon={
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                    }
                >
                    <p>
                        Royalty allocations are subject to periodic validation and compliance with all applicable program
                        rules. Eligibility may be reviewed, updated, or discontinued in accordance with the governance
                        framework and operational policies of the RACE Network ecosystem.
                    </p>
                </RoyaltyInfoRow>
            </div>

            <div className="relative mt-6 flex justify-center">
                <Link
                    href={route('leadership')}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-6 py-3 text-sm font-extrabold text-[#0a1230] shadow-[0_10px_30px_-8px_rgba(245,158,11,0.6)] transition hover:brightness-105"
                >
                    View Leadership & Royalty →
                </Link>
            </div>
        </section>
    );
}

function useDashboardActivation(serverActivation) {
    const page = usePage();
    const user = page.props.auth?.user;
    const web3 = page.props.blockchain?.web3 ?? {};
    const blockchainOnly = Boolean(page.props.blockchain?.blockchain_only);
    const enabled = Boolean(web3.enabled);
    const engineContract = web3.engine_contract || web3.contract || '';
    const expectedChainId = Number(web3.chain_id || 56);
    const profileWallet = user?.wallet_address ?? '';

    const [chain, setChain] = useState({
        loading: enabled && Boolean(engineContract),
        error: null,
        participationActive: false,
    });
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        if (!enabled || !engineContract) {
            setChain({ loading: false, error: null, participationActive: false });
            return undefined;
        }

        let cancelled = false;

        (async () => {
            setChain((prev) => ({ ...prev, loading: true, error: null }));

            let walletAddress = profileWallet;
            try {
                const accounts = await window.ethereum?.request?.({ method: 'eth_accounts' });
                if (accounts?.[0]) {
                    walletAddress = accounts[0];
                }
            } catch {
                /* keep profile wallet */
            }

            if (!walletAddress) {
                if (cancelled) return;
                setChain({ loading: false, error: blockchainOnly ? 'connect' : null, participationActive: false });
                return;
            }

            const chainId = await readChainIdHex();
            if (cancelled) return;

            if (chainId && !chainIdMatches(chainId, expectedChainId)) {
                setChain({ loading: false, error: 'network', participationActive: false });
                return;
            }

            try {
                const state = await readEngineMemberState({ walletAddress, engineContract });
                if (cancelled) return;
                setChain({ loading: false, error: null, participationActive: Boolean(state.participationActive) });
            } catch {
                if (cancelled) return;
                setChain({ loading: false, error: 'rpc', participationActive: false });
            }
        })();

        const bump = () => setRefreshKey((n) => n + 1);
        window.ethereum?.on?.('chainChanged', bump);
        window.ethereum?.on?.('accountsChanged', bump);

        return () => {
            cancelled = true;
            window.ethereum?.removeListener?.('chainChanged', bump);
            window.ethereum?.removeListener?.('accountsChanged', bump);
        };
    }, [enabled, engineContract, profileWallet, expectedChainId, blockchainOnly, refreshKey]);

    return useMemo(() => {
        const base = { ...(serverActivation ?? {}) };

        if (!enabled) {
            return { ...base, loading: false, banner: null };
        }

        if (chain.loading) {
            return {
                ...base,
                loading: true,
                banner: null,
                member_status: 'loading',
                member_status_label: 'Loading…',
                id_status: 'loading',
                id_status_label: 'Loading…',
                participation_status: 'loading',
                participation_status_label: 'Loading…',
                income_eligibility_label: 'Confirming on-chain status…',
                next_step: 'none',
            };
        }

        if (chain.error === 'connect') {
            return { ...base, loading: false, banner: 'connect' };
        }
        if (chain.error === 'network') {
            return { ...base, loading: false, banner: 'network' };
        }
        if (chain.error === 'rpc' && blockchainOnly) {
            return {
                ...base,
                loading: false,
                banner: 'rpc',
                member_status: 'unknown',
                member_status_label: '—',
                id_status: 'unknown',
                id_status_label: '—',
                participation_status: 'unknown',
                participation_status_label: '—',
                income_eligibility_label: 'Could not confirm on-chain status. Try again shortly.',
                next_step: 'none',
            };
        }

        if (chain.participationActive) {
            return {
                ...base,
                loading: false,
                banner: null,
                member_status: 'active',
                member_status_label: 'Active',
                id_status: 'active',
                id_status_label: 'Activated',
                participation_status: 'active',
                participation_status_label: 'Active',
                income_eligibility: 'full',
                income_eligibility_label: 'Full program enabled',
                next_step: 'none',
            };
        }

        if (blockchainOnly) {
            return {
                ...base,
                loading: false,
                banner: null,
                member_status: 'inactive',
                member_status_label: 'Inactive',
                id_status: 'pending',
                id_status_label: 'Pending',
                participation_status: 'inactive',
                participation_status_label: 'Inactive',
                income_eligibility: 'participation_pending',
                income_eligibility_label: 'Add $50+ staking for full program incomes',
                next_step: 'participation',
            };
        }

        return { ...base, loading: false, banner: chain.error === 'rpc' ? 'rpc-soft' : null };
    }, [serverActivation, enabled, blockchainOnly, chain]);
}

function MemberActivationStatusCard({ activation, memberNumber, isTestnet = false }) {
    const a = activation ?? {};
    const memberLabel = formatMemberCode(memberNumber, { withHash: true });
    const idActive = a.id_status === 'active';
    const loading = a.loading || a.member_status === 'loading';
    const statusClass = (ok) => {
        if (loading) {
            return 'border-slate-500/50 bg-slate-900/80 text-slate-200';
        }
        return ok
            ? 'border-emerald-400/60 bg-emerald-950/50 text-emerald-100'
            : 'border-amber-400/70 bg-amber-950/50 text-amber-100';
    };

    return (
        <DpCard className="!p-4 sm:!p-5 ring-2 ring-[#2563EB]/40 ring-offset-2 !bg-gradient-to-br !from-sky-50 !to-white shadow-[0_8px_24px_-10px_rgba(37,99,235,0.28)]" hover={false}>
            <span className="inline-flex items-center rounded-full bg-[#2563EB] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-sm">
                Account activation
            </span>
            <p className="mt-2 text-xs font-medium text-slate-700 sm:text-sm">
                Register to access the dashboard. Staking ($50+) unlocks the full rewards program.
            </p>

            {a.banner === 'connect' ? (
                <p className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-900">
                    {hasWeb3Wallet() ? 'Connect Wallet to confirm on-chain status.' : 'Connect Wallet'}
                </p>
            ) : null}
            {a.banner === 'network' ? (
                <p className="mt-3 rounded-xl border border-amber-400/60 bg-amber-950/50 px-3 py-2 text-xs font-semibold text-amber-100">
                    {isTestnet ? 'Switch to BSC Testnet (Chain ID 97)' : 'Switch to BNB Smart Chain'}
                </p>
            ) : null}
            {a.banner === 'rpc' || a.banner === 'rpc-soft' ? (
                <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                    Network is slow. Status will refresh automatically.
                </p>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className={`rounded-xl border px-4 py-3 ${statusClass(a.member_status === 'active')}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wide opacity-90">Member status</p>
                    <p className="mt-1 text-sm font-bold">{a.member_status_label ?? '—'}</p>
                </div>
                <div className={`rounded-xl border px-4 py-3 ${statusClass(a.participation_status === 'active')}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wide opacity-90">Staking</p>
                    <p className="mt-1 text-sm font-bold">{a.participation_status_label ?? '—'}</p>
                </div>
                <div className={`rounded-xl border px-4 py-3 ${statusClass(idActive)}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wide opacity-90">Member ID</p>
                    <p className="mt-1 truncate text-sm font-bold">
                        {memberLabel} · {a.id_status_label ?? (idActive ? 'Activated' : 'Pending')}
                    </p>
                </div>
            </div>
            <p className="mt-3 text-xs text-slate-600">
                {loading
                    ? 'Confirming on-chain status…'
                    : idActive
                      ? a.income_eligibility_label
                      : 'Start Staking ($50+) to activate your member ID.'}
            </p>
            {a.next_step === 'participation' && !loading ? (
                <Link
                    href={route('investment')}
                    className="mt-4 inline-flex items-center justify-center rounded-xl border border-emerald-300 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                    Start Staking ($50+)
                </Link>
            ) : null}
        </DpCard>
    );
}

export default function Dashboard({ summary: summaryProp = {}, memberActivation: memberActivationProp }) {
    const page = usePage();
    const { user } = page.props.auth;
    const isTestnet = Boolean(page.props.blockchain?.is_testnet);
    const memberActivation = useDashboardActivation(memberActivationProp ?? page.props.memberActivation ?? {});
    const summary = { ...defaultSummary, ...summaryProp };
    const displayName = user?.name?.trim() || 'Member';

    usePoll(
        120000,
        { only: ['summary'] },
        { preserveScroll: true, preserveState: true },
    );

    const topCards = useMemo(() => [
        {
            title: 'Total balance',
            value: formatUsdt(summary.balance_usd),
            sub: summary.income_pct?.total ?? '+0.00% vs prior',
            tintClass: 'bg-blue-400/30',
            icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125H18.75a60.07 60.07 0 01-15.797 2.101c-.727.198-1.453-.342-1.453-1.096V18.75M18.75 4.5h.008v.008H18.75V4.5z"
                    />
                </svg>
            ),
        },
        {
            title: 'Race Coin',
            value: formatRaceCoins(summary.race_coin_balance),
            sub: `@ ${formatUsd(summary.race_coin_price_usd)} per coin`,
            tintClass: 'bg-violet-400/30',
            icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                    />
                </svg>
            ),
        },
        {
            title: 'Total reward earned',
            value: formatUsd(summary.total_income_usd ?? summary.lifetime_credits_usd),
            sub: summary.income_payout_count
                ? `${summary.income_payout_count} payout(s) · ROI ${summary.income_pct?.roi ?? '+0.00%'}`
                : (summary.income_pct?.roi ?? '+0.00% ROI window'),
            tintClass: 'bg-emerald-400/25',
            icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l5.94-2.28m-5.94 2.28l2.28 5.941" />
                </svg>
            ),
        },
        {
            title: 'Active package',
            value: formatUsd(summary.active_principal_usd ?? summary.principal_invested_usd),
            sub:
                summary.active_investments > 0
                    ? `${summary.active_investments} active position${summary.active_investments === 1 ? '' : 's'}`
                    : null,
            tintClass: 'bg-sky-400/30',
            icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                    />
                </svg>
            ),
        },
        {
            title: 'Total team',
            value: String(summary.team_size),
            sub: `${summary.direct_referrals} direct referral(s)`,
            tintClass: 'bg-violet-400/25',
            icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18 18.72a9.09 9.09 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666M18 18.72a9.09 9.09 0 005.06-2.687m0 0a9.01 9.01 0 00-.94-3.197m0 0A9 9 0 005.64 5.64m9.367 9.367a9 9 0 00-9.367 9.367m9.367-9.367c.11-.408.17-.84.17-1.284m0 0a3 3 0 01-6 0m6 0a3 3 0 00-6 0"
                    />
                </svg>
            ),
        },
    ], [
        summary.balance_usd,
        summary.income_pct?.total,
        summary.income_pct?.roi,
        summary.race_coin_balance,
        summary.race_coin_price_usd,
        summary.total_income_usd,
        summary.lifetime_credits_usd,
        summary.income_payout_count,
        summary.active_principal_usd,
        summary.principal_invested_usd,
        summary.active_investments,
        summary.team_size,
        summary.direct_referrals,
    ]);

    return (
        <AuthenticatedLayout pageTitle="Dashboard" memberSurface="race" showMobileFintechNav mobileFintechPageTitle="Dashboard" showReferralFab>
            <Head title="Dashboard" />

            <MemberPageShell particles={false}>
                    <MemberPageHero kicker="Member dashboard" title={`Welcome back, ${displayName}`} variant="pdf" icon="dashboard">
                        Track balances, daily earnings, team growth, and all income programs in one place.
                    </MemberPageHero>

                    <MemberActivationStatusCard
                        activation={memberActivation}
                        memberNumber={user?.member_number}
                        isTestnet={isTestnet}
                    />

                    <DailyEarningCard
                        amountUsd={summary.today_income_usd}
                        count={summary.today_income_count ?? 0}
                        dateLabel={summary.today_label}
                    />

                    <div className="member-stat-grid gap-3 lg:grid lg:grid-cols-4 lg:gap-4">
                        {topCards.map((c) => (
                            <GlassMetricCard key={c.title} {...c} />
                        ))}
                    </div>

                    <ReferralLinkCopyCard />

                    <PlanIncomeSection
                        planIncome={summary.plan_income}
                        totalIncomeUsd={summary.total_income_usd}
                        incomeEntries={summary.income_entries}
                        animate={false}
                    >
                        <RoyaltyAchievementShowcase />
                    </PlanIncomeSection>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
