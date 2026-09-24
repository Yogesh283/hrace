import { RACE_LOGO_SRC } from '@/lib/brandAssets';
import Dropdown from '@/Components/Dropdown';
import GlobalFlashModal from '@/Components/GlobalFlashModal';
import Modal from '@/Components/Modal';
import MobileFintechBottomNav from '@/Components/Member/MobileFintechBottomNav';
import MobilePremiumHeader from '@/Components/Member/MobilePremiumHeader';
import { RynexBackdrop } from '@/Components/Rx';
import { formatMemberCode } from '@/lib/memberCode';
import { Link, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

const NAVY = '#020B2D';
const SIDEBAR_W = 236;

function routeHref(name) {
    try {
        return route(name);
    } catch {
        return '#';
    }
}

function formatNavUsd(value) {
    const n = Number(value);
    if (Number.isNaN(n)) {
        return '';
    }
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(n);
}

function navHref(item) {
    try {
        if (item.query) {
            return route(item.routeKey, item.query);
        }
        return route(item.routeKey);
    } catch {
        return '#';
    }
}

function navActive(item) {
    try {
        const current = route().current();
        if (!current) {
            return false;
        }
        if (item.query?.income) {
            const income =
                typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('income') : null;
            return current === item.routeKey && income === item.query.income;
        }
        if (item.routeKey === 'transactions' && !item.query) {
            const income =
                typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('income') : null;
            return current === 'transactions' && !income;
        }
        return current === item.routeKey;
    } catch {
        return false;
    }
}

/** Sidebar order — client menu sequence (notebook list). */
/** @type {Array<{ routeKey: string, label: string, iconKey: string, query?: { income: string } }>} */
const memberNav = [
    { routeKey: 'dashboard', label: 'Dashboard', iconKey: 'dashboard' },
    { routeKey: 'profile.edit', label: 'Profile', iconKey: 'profile.edit' },
    { routeKey: 'swap', label: 'Swap', iconKey: 'swap' },
    { routeKey: 'race-token', label: 'Race coin', iconKey: 'race-token' },
    { routeKey: 'ico', label: 'ICO', iconKey: 'isu' },
    { routeKey: 'investment', label: 'Staking', iconKey: 'investment' },
    {
        routeKey: 'transactions',
        label: 'Staking Reward',
        iconKey: 'investment',
        query: { income: 'participation_rewards' },
    },
    {
        routeKey: 'transactions',
        label: 'Community Referrals',
        iconKey: 'community_referrals',
        query: { income: 'community_referrals' },
    },
    {
        routeKey: 'transactions',
        label: 'ROI Sharing',
        iconKey: 'network-roi',
        query: { income: 'affiliate_network_roi' },
    },
    { routeKey: 'leadership', label: 'Community Leadership', iconKey: 'leadership' },
    { routeKey: 'rewards', label: 'Community Team Rewards', iconKey: 'rewards' },
    {
        routeKey: 'transactions',
        label: 'Royalty',
        iconKey: 'bonza',
        query: { income: 'community_leadership' },
    },
    { routeKey: 'direct-team', label: 'Direct Team', iconKey: 'direct-team' },
    { routeKey: 'team', label: 'Total Team', iconKey: 'team' },
    { routeKey: 'transactions', label: 'Total Earnings', iconKey: 'transactions' },
    { routeKey: 'withdrawal', label: 'Payouts', iconKey: 'withdrawal' },
    { routeKey: 'wallet', label: 'Wallet', iconKey: 'wallet' },
    { routeKey: 'about', label: 'Support', iconKey: 'about' },
];

function MemberPopupModal() {
    const page = usePage();
    const popup = page.props.memberPopup;
    const enabled = Boolean(popup?.enabled);
    const title = popup?.title ?? 'Notice';
    const message = (popup?.message ?? '').trim();
    const key = `${title}:${message}`;

    const [open, setOpen] = useState(false);
    const [dismissedKey, setDismissedKey] = useState('');

    useEffect(() => {
        if (!enabled || !message) {
            setOpen(false);
            return;
        }
        if (dismissedKey === key) {
            return;
        }
        setOpen(true);
    }, [enabled, message, key, dismissedKey]);

    const close = () => {
        setDismissedKey(key);
        setOpen(false);
    };

    return (
        <Modal show={open} onClose={close} maxWidth="md">
            <div className="rounded-2xl border border-sky-200 bg-white p-6 text-fintech-ink shadow-lg">
                <h3 className="text-lg font-semibold text-[#0F172A]">{title}</h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{message}</p>
                <button
                    type="button"
                    className="mt-6 w-full rounded-xl border border-transparent bg-gradient-to-r from-[#2563EB] to-[#38BDF8] py-2.5 text-sm font-semibold text-white shadow-md hover:brightness-105"
                    onClick={close}
                >
                    OK
                </button>
            </div>
        </Modal>
    );
}

function NavIconSvg({ name }) {
    const c = 'h-4 w-4';
    switch (name) {
        case 'dashboard':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75A2.25 2.25 0 0115.75 18h2.25A2.25 2.25 0 0120.25 15.75v-2.25a2.25 2.25 0 00-2.25-2.25H15.75a2.25 2.25 0 00-2.25 2.25v2.25zM13.5 3.75A2.25 2.25 0 0115.75 6v2.25A2.25 2.25 0 0113.5 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6a2.25 2.25 0 012.25-2.25h2.25zM6 13.5A2.25 2.25 0 018.25 15.75v2.25A2.25 2.25 0 016 20.25H3.75A2.25 2.25 0 011.5 18v-2.25A2.25 2.25 0 013.75 13.5H6z"
                    />
                </svg>
            );
        case 'profile.edit':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                </svg>
            );
        case 'direct-team':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235A4.97 4.97 0 003 16.75v-1.378c0-1.731 1.252-3.183 2.941-3.478.826-.144 1.741-.144 2.618 0 1.69.295 2.941 1.747 2.941 3.478v1.378a4.97 4.97 0 00-.235 2.485M16 19.235V16.75m0 0v-2.625m0 2.625v2.485M16 7.5V4.875"
                    />
                </svg>
            );
        case 'team':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18 18.72a9.09 9.09 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666M18 18.72a9.09 9.09 0 005.06-2.687m0 0a9.01 9.01 0 00-.94-3.197m0 0A9 9 0 005.64 5.64m9.367 9.367a9 9 0 00-9.367 9.367m9.367-9.367c.11-.408.17-.84.17-1.284m0 0a3 3 0 01-6 0m6 0a3 3 0 00-6 0"
                    />
                </svg>
            );
        case 'bonza':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                    />
                </svg>
            );
        case 'bonza-buster':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                    />
                </svg>
            );
        case 'leadership':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M15.75 4.969V3.375A1.125 1.125 0 0014.625 2.25h-5.25A1.125 1.125 0 008.25 3.375v1.594m7.5 0V6a2.25 2.25 0 01-2.25 2.25h-4.5A2.25 2.25 0 016 4.969V4.969"
                    />
                </svg>
            );
        case 'rewards':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18 18.72a9.09 9.09 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.955 11.955 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.688-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                    />
                </svg>
            );
        case 'transactions':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125H18.75a60.07 60.07 0 01-15.797 2.101c-.727.198-1.453-.342-1.453-1.096V18.75M18.75 4.5h.008v.008H18.75V4.5z"
                    />
                </svg>
            );
        case 'withdrawal':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                </svg>
            );
        case 'deposit':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 3V9M3 12l9-3 9 3M5.25 18h13.5M12 15.75h.008v.008H12V15.75z"
                    />
                </svg>
            );
        case 'swap':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                    />
                </svg>
            );
        case 'race-token':
        case 'race-ico':
        case 'isu':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
            );
        case 'investment':
        case 'self-hold':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                    />
                </svg>
            );
        case 'network-roi':
        case 'trading_roi':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l5.94-2.28m-5.94 2.28l2.28 5.941" />
                </svg>
            );
        case 'affiliate_referral':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18 18.72a9.09 9.09 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.955 11.955 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0v-1.5"
                    />
                </svg>
            );
        case 'affiliate_sponsor':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
            );
        case 'wallet':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 3V9M3 12l9-3 9 3"
                    />
                </svg>
            );
        case 'about':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12V15.75z"
                    />
                </svg>
            );
        default:
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                </svg>
            );
    }
}

const ROUTE_TITLES = {
    dashboard: 'Dashboard',
    'profile.edit': 'Profile',
    swap: 'Swap',
    governance: 'Governance',
    deposit: 'Deposit (Race coin)',
    'race-token': 'Race coin',
    ico: 'ICO',
    lending: 'Lending & Borrowing',
    investment: 'Staking',
    leadership: 'Community Leadership',
    rewards: 'Community Team Rewards',
    'direct-team': 'Direct Team',
    team: 'Total Team',
    transactions: 'Total Earnings',
    withdrawal: 'Payouts',
    wallet: 'Wallet',
    about: 'Support',
    'self-hold': 'Self Hold',
    'network-roi': 'ROI Sharing',
    'bonza-buster': 'Bonanza',
    bonza: 'Affiliate Booster',
};

function usePageTitle(pageTitleProp) {
    const page = usePage();
    if (pageTitleProp) return pageTitleProp;
    try {
        const cur = route().current();
        return ROUTE_TITLES[cur] ?? (typeof page.props?.title === 'string' ? page.props.title : 'Dashboard');
    } catch {
        return 'Dashboard';
    }
}

export default function AuthenticatedLayout({
    header,
    children,
    pageTitle: pageTitleProp,
    memberSurface = 'race',
    showMobileFintechNav = false,
    mobileFintechPageTitle,
    /** Floating “Share referral link” FAB — only Dashboard should enable this. */
    showReferralFab = false,
}) {
    const { auth, incomeHub } = usePage().props;
    const user = auth.user;
    const [open, setOpen] = useState(false);
    const [fabCopied, setFabCopied] = useState(false);
    const pageTitle = usePageTitle(pageTitleProp);
    const isRaceShell =
        memberSurface === 'race' || memberSurface === 'fintech-light' || memberSurface === 'default';

    useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        if (open) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = prev;
            };
        }
        return undefined;
    }, [open]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const mq = window.matchMedia('(min-width: 1024px)');
        const onChange = (e) => {
            if (e.matches) setOpen(false);
        };
        mq.addEventListener?.('change', onChange);
        return () => mq.removeEventListener?.('change', onChange);
    }, []);

    const referralLink = useMemo(() => {
        if (!user?.referral_code || typeof window === 'undefined') {
            return null;
        }
        return `${window.location.origin}/register?join_code=${encodeURIComponent(user.referral_code)}`;
    }, [user?.referral_code]);

    const initials = useMemo(() => {
        if (!user?.name) {
            return '?';
        }
        const parts = user.name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return user.name.slice(0, 2).toUpperCase();
    }, [user?.name]);

    const memberId = formatMemberCode(user?.member_number, { withHash: true });

    const copyReferral = async () => {
        if (!referralLink) return;
        await navigator.clipboard.writeText(referralLink);
        setFabCopied(true);
        setTimeout(() => setFabCopied(false), 1600);
    };

    const dropdownSurface =
        'border border-[#2563EB]/30 bg-[#0F172A]/95 py-1 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl';

    const sidebar = (
        <div
            className="relative flex h-full flex-col overflow-hidden border-r border-white/[0.06] px-2.5 py-3 shadow-[6px_0_32px_rgba(2,11,45,0.3)]"
            style={{ backgroundColor: NAVY }}
        >
            <div
                className="pointer-events-none absolute -top-28 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full opacity-40 blur-3xl"
                style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.35), transparent 70%)' }}
                aria-hidden
            />
            <div
                className="pointer-events-none absolute -bottom-20 -right-10 h-48 w-48 rounded-full opacity-30 blur-3xl"
                style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.45), transparent 70%)' }}
                aria-hidden
            />

            <div className="relative mb-2.5 flex items-center justify-between gap-1.5 px-0.5">
                <Link href={routeHref('dashboard')} className="flex min-w-0 items-center gap-2" onClick={() => setOpen(false)}>
                    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/[0.08] ring-1 ring-white/10">
                        <img src={RACE_LOGO_SRC} alt="" className="h-6 w-6 object-contain" />
                    </span>
                    <span className="min-w-0 font-poppins text-sm font-bold tracking-tight text-white">RACE NETWORK</span>
                </Link>
                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close menu"
                    className="rounded-lg border border-white/10 bg-white/[0.06] p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <nav className="relative flex min-h-0 flex-1 flex-col gap-px overflow-y-auto overscroll-contain py-0.5">
                {memberNav.map((item, idx) => {
                    const active = navActive(item);
                    const href = navHref(item);
                    return (
                        <Link
                            key={`${item.iconKey}-${item.label}-${idx}`}
                            href={href}
                            onClick={() => setOpen(false)}
                            className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 text-[0.8125rem] font-semibold leading-tight transition ${
                                active
                                    ? 'bg-[#2563EB]/25 text-white shadow-[inset_0_0_0_1px_rgba(56,189,248,0.3)]'
                                    : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                            }`}
                        >
                            <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition ${
                                    active
                                        ? 'border-[#38BDF8]/45 bg-[#2563EB]/35 text-white'
                                        : 'border-white/[0.07] bg-white/[0.035] text-slate-200 group-hover:border-[#38BDF8]/25 group-hover:text-white'
                                }`}
                            >
                                <NavIconSvg name={item.iconKey} />
                            </span>
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {item.iconKey === 'transactions' && !item.query && incomeHub?.total_income_usd ? (
                                <span className="shrink-0 font-mono text-[0.65rem] font-bold text-emerald-300">
                                    {formatNavUsd(incomeHub.total_income_usd)}
                                </span>
                            ) : null}
                        </Link>
                    );
                })}
            </nav>

            <div className="relative mt-auto shrink-0 space-y-2 border-t border-white/[0.08] pt-2.5">
                <Link
                    href={routeHref('logout')}
                    method="post"
                    as="button"
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/70 bg-red-600 px-2 py-2 text-xs font-semibold text-white shadow-[0_4px_14px_-4px_rgba(220,38,38,0.55)] transition hover:border-red-400 hover:bg-red-500 active:bg-red-700"
                >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                        />
                    </svg>
                    Logout
                </Link>
            </div>
        </div>
    );

    const topBarRight = (
        <div className="flex shrink-0 items-center gap-1 sm:gap-2.5">
            <Link
                href={routeHref('profile.edit')}
                aria-label="Settings"
                className="hidden min-[380px]:inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#2563EB]/30 bg-[#0F172A]/80 text-slate-300 shadow-sm transition hover:border-[#38BDF8]/40 hover:text-white sm:h-10 sm:w-10 sm:rounded-xl"
            >
                <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </Link>
            <Dropdown>
                <Dropdown.Trigger>
                    <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-xl border border-[#2563EB]/30 bg-[#0F172A]/80 py-1 pl-1 pr-1.5 shadow-sm transition hover:border-[#38BDF8]/35 sm:gap-2.5 sm:rounded-2xl sm:py-1.5 sm:pl-1.5 sm:pr-3"
                    >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#2563EB] to-[#38BDF8] text-[0.65rem] font-bold text-white sm:h-9 sm:w-9 sm:rounded-xl sm:text-xs">
                            {initials}
                        </span>
                        <span className="hidden min-w-0 text-left md:block">
                            <span className="block max-w-[140px] truncate text-sm font-semibold text-white">{user?.name ?? 'Member'}</span>
                            <span className="block truncate font-mono text-[0.65rem] font-medium text-[#94A3B8]">{memberId}</span>
                        </span>
                    </button>
                </Dropdown.Trigger>
                <Dropdown.Content align="right" width="48" contentClasses={dropdownSurface}>
                    <Dropdown.Link
                        href={routeHref('profile.edit')}
                        className="text-slate-200 hover:bg-white/5 focus:bg-white/5"
                    >
                        Profile settings
                    </Dropdown.Link>
                    <Dropdown.Link
                        href={routeHref('logout')}
                        method="post"
                        as="button"
                        className="text-red-400 hover:bg-red-500/10 focus:bg-red-500/10"
                    >
                        Log out
                    </Dropdown.Link>
                </Dropdown.Content>
            </Dropdown>
        </div>
    );

    return (
        <>
            <MemberPopupModal />
            <GlobalFlashModal />

            {open ? (
                <button
                    type="button"
                    className={`fixed inset-x-0 bottom-0 z-[90] bg-[#0F172A]/45 backdrop-blur-[6px] lg:hidden ${
                        showMobileFintechNav
                            ? 'top-[calc(5.85rem+env(safe-area-inset-top,0px))]'
                            : 'top-0'
                    }`}
                    aria-label="Close menu"
                    onClick={() => setOpen(false)}
                />
            ) : null}

            <aside
                className={`fixed bottom-0 left-0 z-[100] max-w-[min(100vw-1rem,${SIDEBAR_W}px)] transition-transform duration-300 ease-out lg:inset-y-0 lg:top-0 lg:max-w-none lg:translate-x-0 ${
                    showMobileFintechNav
                        ? 'top-[calc(5.85rem+env(safe-area-inset-top,0px))]'
                        : 'top-0'
                } ${
                    open
                        ? 'translate-x-0 shadow-[8px_0_40px_rgba(2,11,45,0.35)]'
                        : '-translate-x-full pointer-events-none lg:pointer-events-auto lg:translate-x-0'
                }`}
                style={{ width: SIDEBAR_W }}
                aria-hidden={!open}
            >
                {sidebar}
            </aside>

            {showMobileFintechNav ? (
                <MobilePremiumHeader
                    menuOpen={open}
                    onMenuToggle={() => setOpen((v) => !v)}
                    pageTitle={mobileFintechPageTitle || pageTitle}
                    initials={initials}
                    profileHref={routeHref('profile.edit')}
                    logoutHref={routeHref('logout')}
                    dropdownSurface={dropdownSurface}
                />
            ) : null}

            <div
                className={`member-portal race-theme relative max-w-[100vw] overflow-x-clip font-sans antialiased ${
                    isRaceShell ? 'member-portal--race' : 'member-portal--fintech-light bg-gradient-to-b from-sky-100/80 via-white to-slate-50'
                }`}
            >
            {isRaceShell ? (
                <>
                    <RynexBackdrop />
                    <div className="race-particles pointer-events-none fixed inset-0 z-0 opacity-30" aria-hidden />
                </>
            ) : (
                <RynexBackdrop />
            )}

            <div className="relative z-10 min-h-screen overflow-visible" id="member-shell">
                <style>{`
                    #referral-fab {
                        position: fixed;
                        display: flex;
                        justify-content: center;
                        z-index: 55;
                        bottom: max(0.75rem, env(safe-area-inset-bottom, 0px));
                    }
                    @media (max-width: 1023px) {
                        #referral-fab {
                            left: 0.75rem;
                            right: 0.75rem;
                            transform: none;
                        }
                        ${
                            showReferralFab && showMobileFintechNav
                                ? `#referral-fab { bottom: calc(5.25rem + env(safe-area-inset-bottom, 0px)) !important; }`
                                : ''
                        }
                    }
                    @media (min-width: 1024px) {
                        #member-shell { padding-left: ${SIDEBAR_W}px !important; }
                        #member-header-desktop { left: ${SIDEBAR_W}px !important; }
                        #referral-fab {
                            left: calc(50% + ${SIDEBAR_W / 2}px) !important;
                            right: auto !important;
                            bottom: 2rem;
                            transform: translateX(-50%) !important;
                        }
                    }
                `}</style>

                {/* Mobile header (non-fintech pages) */}
                {!showMobileFintechNav ? (
                <header
                    className="fixed inset-x-0 top-0 z-40 flex min-h-[3.5rem] items-center justify-between gap-1.5 border-b border-[#38BDF8]/45 bg-[#0B0B0B]/92 px-2 pb-0 pt-[env(safe-area-inset-top,0px)] shadow-[0_8px_28px_-12px_rgba(37,99,235,0.45)] backdrop-blur-md sm:min-h-[4rem] sm:gap-3 sm:px-5 lg:hidden"
                >
                        <>
                            <button
                                type="button"
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#2563EB]/30 bg-[#0F172A]/80 text-slate-200 shadow-sm transition hover:border-[#38BDF8]/40 active:scale-[0.98] sm:h-10 sm:w-10 sm:rounded-xl"
                                onClick={() => setOpen((v) => !v)}
                                aria-expanded={open}
                                aria-label={open ? 'Close menu' : 'Open menu'}
                            >
                                <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    {open ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                                    )}
                                </svg>
                            </button>
                            <h1 className="min-w-0 flex-1 truncate px-1 text-center font-poppins text-sm font-bold leading-tight text-white sm:text-base">
                                {pageTitle}
                            </h1>
                            {topBarRight}
                        </>
                </header>
                ) : null}

                {/* Desktop header — fixed for scroll */}
                <header
                    id="member-header-desktop"
                    className={`fixed right-0 top-0 z-30 hidden h-16 items-center justify-between border-b px-4 shadow-sm backdrop-blur-md sm:px-6 lg:flex ${
                        isRaceShell
                            ? 'border-[#38BDF8]/45 bg-[#0B0B0B]/90 shadow-[0_8px_28px_-12px_rgba(37,99,235,0.4)]'
                            : 'border-sky-300/60 bg-white/90 shadow-[0_8px_24px_-12px_rgba(37,99,235,0.2)]'
                    }`}
                >
                    <h1 className="min-w-0 truncate font-poppins text-base font-bold tracking-tight text-white sm:text-lg">
                        {pageTitle}
                    </h1>
                    {topBarRight}
                </header>

                <main
                    id="member-main"
                    className={`relative mx-auto w-full max-w-[100vw] px-2.5 sm:px-5 lg:max-w-none lg:px-8 lg:pb-10 lg:pt-[calc(6rem+env(safe-area-inset-top,0px))] ${
                        showMobileFintechNav
                            ? 'pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(6.75rem+env(safe-area-inset-top,0px))] sm:pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] sm:pt-[calc(7rem+env(safe-area-inset-top,0px))]'
                            : 'pb-24 pt-[calc(3.5rem+env(safe-area-inset-top,0px)+0.25rem)] sm:pt-[calc(4rem+env(safe-area-inset-top,0px)+0.25rem)] lg:pb-10'
                    }`}
                >
                    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
                        {header ? <div className="mb-3 max-w-full sm:mb-6">{header}</div> : null}
                        {children}
                    </div>
                </main>
            </div>

            </div>

            {showMobileFintechNav ? <MobileFintechBottomNav /> : null}

            {showReferralFab ? (
                <div id="referral-fab" className="fixed">
                    <button
                        type="button"
                        disabled={!referralLink}
                        onClick={copyReferral}
                        className={`flex w-full max-w-md items-center justify-center gap-1.5 rounded-full border border-[#2563EB]/20 bg-gradient-to-r from-[#2563EB] to-[#38BDF8] px-3 py-2 text-[11px] font-semibold text-white shadow-[0_12px_32px_-8px_rgba(37,99,235,0.45)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-xs lg:w-auto lg:max-w-none lg:px-5 lg:py-3 lg:text-sm ${
                            showMobileFintechNav ? 'max-lg:hidden lg:flex' : ''
                        }`}
                    >
                        <svg className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
                            />
                        </svg>
                        {fabCopied ? 'Link copied' : 'Share referral link'}
                    </button>
                </div>
            ) : null}
        </>
    );
}
