import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { useId, useState } from 'react';

/* ─── Design tokens (exact palette) ─── */
const primary = '#2563EB';
const sky = '#38BDF8';

const primaryBtn =
    'w-full rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#38BDF8] py-3.5 text-center text-sm font-semibold text-white shadow-[0_10px_32px_-6px_rgba(37,99,235,0.42)] ring-1 ring-white/25 transition active:scale-[0.98] hover:shadow-[0_14px_36px_-4px_rgba(37,99,235,0.5)]';

const ghostBtn =
    'w-full rounded-2xl border border-slate-200/90 bg-white/90 py-3.5 text-center text-sm font-semibold text-[#0F172A] shadow-sm transition hover:border-[#2563EB]/30 hover:text-[#2563EB] active:scale-[0.98]';

const card =
    'rounded-[22px] border border-slate-200/70 bg-white/90 p-4 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.1)] ring-1 ring-white/90 backdrop-blur-sm';

const input =
    'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-[#0F172A] shadow-sm outline-none placeholder:text-[#64748B]/65 transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20';

function StatusBar() {
    return (
        <div className="flex items-center justify-between px-5 pb-0.5 pt-[38px] text-[11px] font-semibold text-[#0F172A]">
            <span>9:41</span>
            <div className="flex items-center gap-1">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M1 18h2v4H1v-4zm4-4h2v8H5v-8zm4-6h2v14H9V8zm4-4h2v18h-2V4zm4 6h2v12h-2V10zm4-6h2v18h-2V4z" />
                </svg>
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 3C7.46 3 3.34 4.78.29 7.67c-.18.18-.29.43-.29.71s.11.53.29.71l11 11c.18.18.43.29.71.29.28 0 .53-.11.71-.29l11-11c.18-.18.29-.43.29-.71s-.11-.53-.29-.71C20.66 4.78 16.54 3 12 3z" />
                </svg>
            </div>
        </div>
    );
}

const bottomNavSuiteTabs = [
    {
        id: 'home',
        label: 'Home',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ),
    },
    {
        id: 'wallet',
        label: 'Wallet',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
        ),
    },
    {
        id: 'plans',
        label: 'Plans',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
        ),
    },
    {
        id: 'earn',
        label: 'Earn',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
        ),
    },
    {
        id: 'profile',
        label: 'Profile',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        ),
    },
];

const bottomNavAppTabs = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        icon: (
            <svg className="h-[1.15rem] w-[1.15rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.85}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
        ),
    },
    {
        id: 'earnings',
        label: 'Earnings',
        icon: (
            <svg className="h-[1.15rem] w-[1.15rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.85}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
        ),
    },
    {
        id: 'wallet',
        label: 'Wallet',
        icon: (
            <svg className="h-[1.15rem] w-[1.15rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.85}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
        ),
    },
    {
        id: 'team',
        label: 'Team',
        icon: (
            <svg className="h-[1.15rem] w-[1.15rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.85}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
        ),
    },
    {
        id: 'more',
        label: 'More',
        icon: (
            <svg className="h-[1.15rem] w-[1.15rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.85}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
        ),
    },
];

function BottomNav({ active = 'home', variant = 'suite' }) {
    const reduce = useReducedMotion();
    const tabs = variant === 'app' ? bottomNavAppTabs : bottomNavSuiteTabs;
    const layoutGroupId = variant === 'app' ? 'fintech-bottom-nav-app' : 'fintech-bottom-nav-suite';
    const pillLayoutId = variant === 'app' ? 'fintech-bottom-pill-app' : 'fintech-bottom-pill-suite';

    const Item = ({ id, label, children: icon }) => {
        const on = active === id;
        if (variant === 'app') {
            return (
                <div className="relative flex flex-1 flex-col items-center pb-1 pt-0.5">
                    <span className={`relative z-10 ${on ? 'text-[#2563EB]' : 'text-[#64748B]'}`}>{icon}</span>
                    <span
                        className={`relative z-10 mt-0.5 text-center text-[8.5px] font-semibold leading-tight ${
                            on ? 'font-bold text-[#2563EB]' : 'text-[#64748B]'
                        }`}
                    >
                        {label}
                    </span>
                    {on ? (
                        <motion.div
                            layoutId={pillLayoutId}
                            className="absolute bottom-0 left-1/2 h-[3px] w-7 -translate-x-1/2 rounded-full bg-[#2563EB]"
                            transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                        />
                    ) : null}
                </div>
            );
        }
        return (
            <div
                className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-[18px] py-1.5 transition-colors ${
                    on ? 'text-[#2563EB]' : 'text-[#64748B]'
                }`}
            >
                <AnimatePresence>
                    {on ? (
                        <motion.div
                            key="pill"
                            layoutId={pillLayoutId}
                            className="absolute inset-0 rounded-[18px] bg-gradient-to-b from-[#2563EB]/14 to-[#38BDF8]/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-[#2563EB]/18"
                            initial={reduce ? false : { opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={reduce ? undefined : { opacity: 0, scale: 0.92 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        />
                    ) : null}
                </AnimatePresence>
                <span className={`relative z-10 ${on ? 'drop-shadow-[0_0_12px_rgba(37,99,235,0.4)]' : ''}`}>{icon}</span>
                <span className="relative z-10 text-[8.5px] font-semibold leading-tight">{label}</span>
            </div>
        );
    };

    return (
        <LayoutGroup id={layoutGroupId}>
            <div className="sticky bottom-0 z-20 mt-3 border-t border-slate-200/80 bg-[#F8FAFC]/95 px-1 pb-1 pt-2 backdrop-blur-md">
                <div className="flex items-center justify-between rounded-[22px] bg-white/90 px-0.5 py-1 shadow-[0_-8px_32px_-12px_rgba(37,99,235,0.14)] ring-1 ring-slate-200/70">
                    {tabs.map((t) => (
                        <Item key={t.id} id={t.id} label={t.label}>
                            {t.icon}
                        </Item>
                    ))}
                </div>
            </div>
        </LayoutGroup>
    );
}

function GlowingCoinIllustration() {
    const uid = useId().replace(/:/g, '');
    const gradId = `${uid}-coin-g`;
    return (
        <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
            <div
                className="absolute inset-0 animate-pulse rounded-full opacity-90 blur-2xl"
                style={{
                    background: `radial-gradient(circle at 40% 35%, ${sky}60, transparent 55%), radial-gradient(circle at 60% 65%, ${primary}55, transparent 50%)`,
                    animationDuration: '2.8s',
                }}
            />
            <motion.div
                className="relative flex h-[7.25rem] w-[7.25rem] items-center justify-center rounded-full bg-gradient-to-br from-white via-sky-50 to-blue-100 shadow-[0_16px_48px_-10px_rgba(37,99,235,0.5),inset_0_2px_6px_rgba(255,255,255,0.9),inset_0_-8px_20px_rgba(37,99,235,0.12)] ring-[3px] ring-white/95"
                animate={{ y: [0, -7, 0], rotate: [0, 1.5, 0, -1.5, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
                <svg viewBox="0 0 100 100" className="h-[6.25rem] w-[6.25rem] drop-shadow-[0_0_22px_rgba(56,189,248,0.6)]" aria-hidden>
                    <defs>
                        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#2563EB" />
                            <stop offset="50%" stopColor="#38BDF8" />
                            <stop offset="100%" stopColor="#60a5fa" />
                        </linearGradient>
                        <radialGradient id={`${uid}-coin-shine`} cx="35%" cy="30%" r="55%">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                        </radialGradient>
                    </defs>
                    <ellipse cx="50" cy="54" rx="38" ry="34" fill={`url(#${gradId})`} opacity="0.98" />
                    <ellipse cx="50" cy="54" rx="38" ry="34" fill={`url(#${uid}-coin-shine)`} />
                    <ellipse cx="36" cy="36" rx="16" ry="11" fill="#ffffff" fillOpacity="0.4" />
                    <text x="50" y="60" textAnchor="middle" className="fill-white font-bold" style={{ fontSize: 24, filter: 'drop-shadow(0 2px 4px rgba(15,23,42,0.25))' }}>
                        R
                    </text>
                </svg>
            </motion.div>
        </div>
    );
}

function FloatingLineGraph({ reduce, variant = 'tr' }) {
    const uid = useId().replace(/:/g, '');
    const fillId = `${uid}-fg-area`;
    const pos =
        variant === 'bl'
            ? 'pointer-events-none absolute -left-6 bottom-28 w-36 opacity-[0.2]'
            : 'pointer-events-none absolute -right-4 top-24 w-40 opacity-[0.24]';
    const pathD =
        variant === 'bl'
            ? 'M0 58 L18 48 L36 55 L52 32 L70 42 L88 22 L120 38 L120 70 L0 70 Z'
            : 'M0 50 L15 45 L30 52 L48 28 L65 38 L82 18 L100 30 L120 12 L120 70 L0 70 Z';
    const lineD =
        variant === 'bl'
            ? 'M0 58 L18 48 L36 55 L52 32 L70 42 L88 22 L120 38'
            : 'M0 50 L15 45 L30 52 L48 28 L65 38 L82 18 L100 30 L120 12';
    return (
        <motion.div
            className={pos}
            aria-hidden
            animate={reduce ? undefined : { y: [0, -10, 0], opacity: variant === 'bl' ? [0.16, 0.26, 0.16] : [0.2, 0.32, 0.2] }}
            transition={{ duration: variant === 'bl' ? 6.2 : 5, repeat: Infinity, ease: 'easeInOut' }}
        >
            <svg viewBox="0 0 120 70" className="h-auto w-full">
                <defs>
                    <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity="0.38" />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path d={pathD} fill={`url(#${fillId})`} />
                <path
                    d={lineD}
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </motion.div>
    );
}

export function ScreenLanding() {
    const reduce = useReducedMotion();
    return (
        <motion.div
            className="relative min-h-full overflow-hidden bg-gradient-to-b from-white via-[#eff6ff] to-[#F8FAFC] pb-4 font-inter"
            initial={reduce ? false : { opacity: 0.001 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.35]"
                style={{
                    backgroundImage: `radial-gradient(circle at 20% 15%, rgba(56,189,248,0.2), transparent 42%), radial-gradient(circle at 88% 8%, rgba(37,99,235,0.12), transparent 38%), radial-gradient(circle at 50% 100%, rgba(37,99,235,0.08), transparent 45%)`,
                }}
                aria-hidden
            />
            <StatusBar />
            <FloatingLineGraph reduce={reduce} variant="tr" />
            <FloatingLineGraph reduce={reduce} variant="bl" />
            <div className="relative px-5 pb-2 pt-2">
                <div className="mb-3 flex items-center justify-between">
                    <span className="rounded-full bg-white/95 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#2563EB] shadow-[0_4px_20px_-6px_rgba(37,99,235,0.25)] ring-1 ring-slate-200/80">
                        RACE NETWORK
                    </span>
                    <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-[#64748B] ring-1 ring-slate-200/60">
                        v3.0
                    </span>
                </div>
                <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748B]">Premium finance</p>
                <GlowingCoinIllustration />
                <motion.h1
                    className="mt-5 text-center text-[clamp(1.875rem,10vw,2.25rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-[#0F172A]"
                    initial={reduce ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                    Grow wealth with clarity.
                </motion.h1>
                <p className="mt-2.5 text-center text-[13px] leading-relaxed text-[#64748B]">
                    Institutional-grade wallets, transparent commissions, and a dashboard built for serious builders.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2.5">
                    {[
                        { v: '$24M+', l: 'Payouts' },
                        { v: '99.99%', l: 'Uptime' },
                        { v: '10K+', l: 'Members' },
                        { v: '< 60s', l: 'Settlement' },
                    ].map((s, i) => (
                        <motion.div
                            key={s.l}
                            initial={reduce ? false : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.08 + i * 0.06, duration: 0.4 }}
                            whileHover={reduce ? undefined : { y: -3, boxShadow: '0 12px 32px -8px rgba(37,99,235,0.2)' }}
                            className="rounded-[24px] border border-white/90 bg-white/90 p-3.5 shadow-[0_8px_28px_-10px_rgba(37,99,235,0.14)] ring-1 ring-slate-100/90"
                        >
                            <p className="text-lg font-bold tabular-nums text-[#0F172A]">{s.v}</p>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">{s.l}</p>
                        </motion.div>
                    ))}
                </div>
                <div className="mt-5 flex flex-col gap-2.5">
                    <motion.button
                        type="button"
                        className={primaryBtn}
                        whileHover={reduce ? undefined : { scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        Open account
                    </motion.button>
                    <motion.button
                        type="button"
                        className={ghostBtn}
                        whileHover={reduce ? undefined : { scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        View live demo
                    </motion.button>
                </div>
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">Why teams choose us</p>
                <div className="mt-2 space-y-2">
                    {[
                        { t: 'Real-time ledger', d: 'Every credit and fee visible in one immutable trail.' },
                        { t: 'Global rails', d: 'Multi-currency wallets with compliant payout workflows.' },
                        { t: 'Network intelligence', d: 'Depth-aware analytics without spreadsheet chaos.' },
                    ].map((f) => (
                        <motion.div
                            key={f.t}
                            whileHover={reduce ? undefined : { y: -2, boxShadow: '0 14px 36px -12px rgba(37,99,235,0.18)' }}
                            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                            className={card}
                        >
                            <p className="text-sm font-bold text-[#0F172A]">{f.t}</p>
                            <p className="mt-1 text-xs leading-relaxed text-[#64748B]">{f.d}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}

/* ─── Reference dashboard (spec palette) ─── */
const refGreen = '#10B981';
const refRed = '#EF4444';
const refOrange = '#F59E0B';
const refPurple = '#8B5CF6';
const refLightBlue = '#EFF6FF';

function BrandHexMark({ className = 'h-9 w-9 text-[13px]' }) {
    return (
        <div
            className={`flex shrink-0 items-center justify-center bg-[#2563EB] font-bold leading-none text-white shadow-sm ${className}`}
            style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
            aria-hidden
        >
            R
        </div>
    );
}

function RefEarningsChart() {
    const uid = useId().replace(/:/g, '');
    const gradLine = `${uid}-ref-line`;
    const gradFill = `${uid}-ref-fill`;
    const maxK = 40;
    const rawK = [8, 10, 9, 14, 16, 15, 19, 22, 21, 25, 28, 26, 30, 32, 31, 34, 33, 36, 35, 38];
    const w = 232;
    const h = 100;
    const padL = 4;
    const padR = 6;
    const padT = 6;
    const padB = 4;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    const pts = rawK.map((k, i) => {
        const x = padL + (i / (rawK.length - 1)) * chartW;
        const y = padT + (1 - k / maxK) * chartH;
        return { x, y };
    });
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
    const area = `${d} L${w - padR} ${h - padB} L${padL} ${h - padB} Z`;
    const tipIdx = 14;
    const tip = pts[tipIdx];

    return (
        <div className="mt-3">
            <div className="flex gap-1.5">
                <div className="flex shrink-0 flex-col justify-between py-1 text-right text-[8px] font-semibold tabular-nums leading-none text-[#64748B]">
                    <span>40K</span>
                    <span>30K</span>
                    <span>20K</span>
                    <span>10K</span>
                    <span>0</span>
                </div>
                <div className="relative min-w-0 flex-1">
                    <svg viewBox={`0 0 ${w} ${h}`} className="h-[5.75rem] w-full" preserveAspectRatio="none" aria-hidden>
                        <defs>
                            <linearGradient id={gradLine} x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#2563EB" />
                                <stop offset="100%" stopColor="#3B82F6" />
                            </linearGradient>
                            <linearGradient id={gradFill} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#2563EB" stopOpacity="0.28" />
                                <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        {[0, 1, 2, 3, 4].map((i) => {
                            const y = padT + (i / 4) * chartH;
                            return (
                                <line
                                    key={i}
                                    x1={padL}
                                    y1={y}
                                    x2={w - padR}
                                    y2={y}
                                    stroke="#e2e8f0"
                                    strokeWidth="0.6"
                                    strokeOpacity="0.9"
                                />
                            );
                        })}
                        <path d={area} fill={`url(#${gradFill})`} />
                        <path
                            d={d}
                            fill="none"
                            stroke={`url(#${gradLine})`}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <circle cx={tip.x} cy={tip.y} r="4" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
                    </svg>
                    <div
                        className="pointer-events-none absolute z-10 rounded-xl border border-slate-200/90 bg-white px-2.5 py-1.5 shadow-[0_8px_24px_-6px_rgba(15,23,42,0.12)]"
                        style={{ left: `${(tip.x / w) * 100}%`, top: '6%', transform: 'translateX(-50%)' }}
                    >
                        <p className="whitespace-nowrap text-[9px] font-semibold text-[#64748B]">15 May 2026</p>
                        <p className="whitespace-nowrap font-mono text-[11px] font-bold text-[#0F172A]">$25,680.50</p>
                    </div>
                </div>
            </div>
            <div className="mt-1.5 flex justify-between pl-7 pr-1 text-[8px] font-semibold text-[#64748B]">
                <span>01 May</span>
                <span>08 May</span>
                <span>15 May</span>
                <span>22 May</span>
                <span>30 May</span>
            </div>
        </div>
    );
}

function RefWalletDonutPanel() {
    const uid = useId().replace(/:/g, '');
    const gid = `${uid}-ref-ring`;
    const c = 50;
    const r = 32;
    const circ = 2 * Math.PI * r;
    const segs = [
        { pct: 0.4, color: `url(#${gid})` },
        { pct: 0.22, color: '#93C5FD' },
        { pct: 0.2, color: '#CBD5E1' },
    ];
    let rotation = -90;
    return (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)]">
            <p className="text-center text-[10px] font-bold uppercase tracking-wide text-[#64748B]">Wallet Balance</p>
            <div className="mt-3 flex flex-col items-center gap-3">
                <div className="relative shrink-0">
                    <svg viewBox="0 0 100 100" className="h-[5.25rem] w-[5.25rem]" aria-hidden>
                        <defs>
                            <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#2563EB" />
                                <stop offset="100%" stopColor="#3B82F6" />
                            </linearGradient>
                        </defs>
                        <circle cx={c} cy={c} r={r} fill="none" stroke="#f1f5f9" strokeWidth="9" />
                        {segs.map((s, i) => {
                            const len = s.pct * circ;
                            const rot = rotation;
                            rotation += s.pct * 360;
                            return (
                                <circle
                                    key={i}
                                    cx={c}
                                    cy={c}
                                    r={r}
                                    fill="none"
                                    stroke={s.color}
                                    strokeWidth="9"
                                    strokeLinecap="round"
                                    strokeDasharray={`${len} ${circ - len}`}
                                    transform={`rotate(${rot} ${c} ${c})`}
                                />
                            );
                        })}
                        <circle cx={c} cy={c} r={20} fill="#FFFFFF" stroke="#f1f5f9" strokeWidth="1" />
                        <g transform="translate(50, 50)" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path transform="translate(-11, -10) scale(0.92)" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </g>
                    </svg>
                </div>
                <div className="w-full space-y-2">
                    {[
                        ['Available', '$10,240', '#2563EB'],
                        ['Pending', '$2,140', '#60A5FA'],
                        ['Withdrawn', '$13,300', '#CBD5E1'],
                    ].map(([label, amt, col]) => (
                        <div key={label} className="flex items-center justify-between gap-1 text-left">
                            <span className="flex items-center gap-2 text-[10px] font-medium text-[#64748B]">
                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: col }} />
                                {label}
                            </span>
                            <span className="font-mono text-[11px] font-bold text-[#0F172A]">{amt}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function ScreenDashboard() {
    const reduce = useReducedMotion();
    const [period, setPeriod] = useState('month');
    const cardBase =
        'rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)]';
    const iconBox = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-100/80';

    return (
        <div className="relative min-h-full bg-[#F8FAFC] pb-1 font-inter text-[#0F172A]">
            <StatusBar />
            <div className="relative px-4 pb-2 pt-1">
                {/* Header — reference layout */}
                <div className="flex items-center justify-between gap-2">
                    <button
                        type="button"
                        className={`flex h-10 w-10 shrink-0 items-center justify-center ${cardBase} transition hover:border-[#2563EB]/30`}
                        aria-label="Open menu"
                    >
                        <svg className="h-5 w-5 text-[#0F172A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
                        <BrandHexMark />
                        <span className="truncate text-[15px] font-bold tracking-[0.12em] text-[#0F172A]">RACE NETWORK</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            type="button"
                            className={`relative flex h-10 w-10 items-center justify-center ${cardBase}`}
                            aria-label="Notifications"
                        >
                            <svg className="h-5 w-5 text-[#0F172A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                                />
                            </svg>
                            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#2563EB] px-1 text-[10px] font-bold text-white ring-2 ring-white">
                                3
                            </span>
                        </button>
                        <div
                            className="h-10 w-10 shrink-0 rounded-full bg-slate-200 ring-2 ring-white shadow-sm"
                            style={{
                                backgroundImage:
                                    'linear-gradient(135deg, #93c5fd 0%, #2563eb 45%, #1d4ed8 100%)',
                            }}
                            aria-label="Profile"
                        />
                    </div>
                </div>

                {/* Row 1 — Total balance + Total earnings */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                    <motion.div
                        className="relative overflow-hidden rounded-2xl border border-white/30 p-4 text-white shadow-[0_8px_28px_-6px_rgba(37,99,235,0.45)]"
                        style={{
                            background: `linear-gradient(145deg, ${primary} 0%, #1d4ed8 50%, #1e40af 100%)`,
                        }}
                        whileHover={reduce ? undefined : { y: -1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    >
                        <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10 blur-2xl" />
                        <div className="relative flex items-start justify-between gap-2">
                            <p className="text-[10px] font-semibold text-white/90">Total Balance</p>
                            <div className={`${iconBox} bg-white/95 shadow-sm`}>
                                <svg className="h-4 w-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M21 12V7.5a2.25 2.25 0 00-2.25-2.25h-6.3a2.25 2.25 0 00-1.65.72l-2.4 2.6a.75.75 0 01-.55.24H5.25A2.25 2.25 0 003 10.5V12m18 0v1.5a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 13.5V12m18 0h-3M3 12h3m0 0h12"
                                    />
                                </svg>
                            </div>
                        </div>
                        <p className="relative mt-2 font-mono text-xl font-bold tracking-tight">$25,680.50</p>
                        <p className="relative mt-2 flex items-center gap-1 text-[10px] font-semibold" style={{ color: '#BBF7D0' }}>
                            <span aria-hidden>↑</span>
                            <span>12.5% from last month</span>
                        </p>
                    </motion.div>

                    <motion.div className={`${cardBase} p-4`} whileHover={reduce ? undefined : { y: -1 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}>
                        <div className="flex items-start justify-between gap-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Total Earnings</p>
                            <div className={iconBox} style={{ backgroundColor: refLightBlue }}>
                                <svg className="h-4 w-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v4.125c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 013 17.25v-4.125zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-8.25zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                                </svg>
                            </div>
                        </div>
                        <p className="mt-2 font-mono text-xl font-bold tracking-tight">$12,540.30</p>
                        <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold" style={{ color: refGreen }}>
                            <span aria-hidden>↑</span>
                            <span>8.7% from last month</span>
                        </p>
                    </motion.div>
                </div>

                {/* Row 2 — Active package + Team */}
                <div className="mt-3 grid grid-cols-2 gap-3">
                    <motion.div className={`${cardBase} p-4`} whileHover={reduce ? undefined : { y: -1 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}>
                        <div className="flex items-start justify-between gap-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Active Package</p>
                            <div className={`${iconBox}`} style={{ backgroundColor: '#F5F3FF' }}>
                                <svg className="h-4 w-4" style={{ color: refPurple }} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 16.9 5.7 21l2.3-7-6-4.6h7.6L12 2z" />
                                </svg>
                            </div>
                        </div>
                        <p className="mt-2 text-lg font-bold" style={{ color: refPurple }}>
                            Premium
                        </p>
                        <p className="mt-1 text-[10px] font-medium text-[#64748B]">Valid till 25 May 2026</p>
                    </motion.div>

                    <motion.div className={`${cardBase} p-4`} whileHover={reduce ? undefined : { y: -1 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}>
                        <div className="flex items-start justify-between gap-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Team Members</p>
                            <div className={`${iconBox}`} style={{ backgroundColor: '#FFFBEB' }}>
                                <svg className="h-4 w-4" style={{ color: refOrange }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M18 18.72a9.09 9.09 0 003.741-.479 3 3 0 00-4.906-3.54 9.94 9.94 0 011.8-3.697 9.9 9.9 0 00-4.1-2.07c-.14-.024-.28-.047-.423-.063M15 12a3 3 0 11-6 0 3 3 0 016 0zm-6 0a3 3 0 10-6 0 3 3 0 006 0z"
                                    />
                                </svg>
                            </div>
                        </div>
                        <p className="mt-2 font-mono text-xl font-bold tracking-tight">1,245</p>
                        <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold" style={{ color: refGreen }}>
                            <span aria-hidden>↑</span>
                            <span>15 New this month</span>
                        </p>
                    </motion.div>
                </div>

                {/* Earnings overview */}
                <div className={`${cardBase} relative mt-4 p-4`}>
                    <div className="flex items-start justify-between gap-2">
                        <h2 className="text-sm font-bold text-[#0F172A]">Earnings Overview</h2>
                        <label className="sr-only" htmlFor="ref-dash-period">
                            Period
                        </label>
                        <select
                            id="ref-dash-period"
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            className="rounded-xl border border-slate-200 bg-white py-1.5 pl-2.5 pr-7 text-[10px] font-bold text-[#0F172A] shadow-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                            style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748B'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 0.35rem center',
                                backgroundSize: '0.7rem',
                                appearance: 'none',
                            }}
                        >
                            <option value="month">This Month</option>
                            <option value="q">This Quarter</option>
                            <option value="y">This Year</option>
                        </select>
                    </div>
                    <RefEarningsChart />
                </div>

                {/* Wallet + Package side by side */}
                <div className="mt-3 grid grid-cols-2 gap-3">
                    <RefWalletDonutPanel />
                    <div className="flex min-h-[210px] flex-col rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)]">
                        <div className="flex justify-center">
                            <BrandHexMark className="h-10 w-10 text-[14px]" />
                        </div>
                        <p className="mt-2 text-center text-[9px] font-bold uppercase tracking-wide text-[#64748B]">Active Package</p>
                        <div className="mt-1 flex justify-center">
                            <span
                                className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                                style={{ backgroundColor: refPurple }}
                            >
                                Premium
                            </span>
                        </div>
                        <p className="mt-2 text-center text-[9px] font-medium leading-snug text-[#64748B]">12 month cycle · Priority payouts</p>
                        <span className="mx-auto mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-500/25">
                            Active
                        </span>
                        <motion.button
                            type="button"
                            className="mt-auto w-full rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#1d4ed8] py-2.5 text-center text-[10px] font-bold text-white shadow-[0_6px_20px_-4px_rgba(37,99,235,0.45)] ring-1 ring-white/20"
                            whileHover={reduce ? undefined : { scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            Upgrade Package →
                        </motion.button>
                    </div>
                </div>

                {/* Quick actions — single row, colored icon tiles */}
                <p className="mt-4 text-[10px] font-bold uppercase tracking-wide text-[#64748B]">Quick Actions</p>
                <div className="mt-2 flex gap-2">
                    {[
                        { label: 'Deposit', bg: '#EFF6FF', color: '#2563EB', d: 'M12 4v16m8-8H4' },
                        { label: 'Withdraw', bg: '#ECFDF5', color: refGreen, d: 'M20 12H4' },
                        { label: 'Transfer', bg: '#F5F3FF', color: refPurple, d: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5' },
                        { label: 'Payout', bg: '#FFFBEB', color: refOrange, d: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                    ].map((a) => (
                        <motion.button
                            key={a.label}
                            type="button"
                            whileHover={reduce ? undefined : { y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            className="flex flex-1 flex-col items-center rounded-2xl border border-slate-200/80 bg-white py-3 shadow-[0_4px_20px_-6px_rgba(15,23,42,0.06)]"
                        >
                            <div
                                className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-white/80 shadow-sm"
                                style={{ backgroundColor: a.bg }}
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke={a.color} strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d={a.d} />
                                </svg>
                            </div>
                            <span className="text-[9px] font-bold text-[#0F172A]">{a.label}</span>
                        </motion.button>
                    ))}
                </div>

                {/* Recent transactions */}
                <div className="mt-4 flex items-end justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#0F172A]">Recent Transactions</h3>
                    <button type="button" className="text-[10px] font-bold text-[#2563EB]">
                        View All
                    </button>
                </div>
                <div className={`${cardBase} mt-2 divide-y divide-slate-100 p-0`}>
                    {[
                        { title: 'Wallet Topup', date: '20 May, 2026', amt: '+$250.00', pos: true, dep: true },
                        { title: 'Bank Transfer', date: '19 May, 2026', amt: '-$1,200.00', pos: false, dep: false },
                        { title: 'Binary Bonus', date: '18 May, 2026', amt: '+$84.00', pos: true, dep: true },
                    ].map((row) => (
                        <div key={row.title} className="flex items-center gap-3 px-4 py-3">
                            <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                                    row.dep ? 'bg-emerald-50' : 'bg-red-50'
                                }`}
                            >
                                {row.dep ? (
                                    <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                    </svg>
                                ) : (
                                    <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                    </svg>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-semibold text-[#0F172A]">{row.title}</p>
                                <p className="text-[10px] font-medium text-[#64748B]">{row.date}</p>
                            </div>
                            <div className="shrink-0 text-right">
                                <p
                                    className="font-mono text-[13px] font-bold tabular-nums"
                                    style={{ color: row.pos ? refGreen : refRed }}
                                >
                                    {row.amt}
                                </p>
                                <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-500/20">
                                    Completed
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                <BottomNav active="dashboard" variant="app" />
            </div>
        </div>
    );
}

export function ScreenLogin() {
    const reduce = useReducedMotion();
    return (
        <div className="min-h-full bg-white pb-6 font-inter">
            <StatusBar />
            <div className="px-5 pt-6">
                <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#38BDF8] shadow-lg shadow-blue-500/25">
                    <span className="text-xl font-black text-white">R</span>
                </div>
                <h1 className="text-center text-2xl font-bold tracking-tight text-[#0F172A]">Welcome back</h1>
                <p className="mt-2 text-center text-sm text-[#64748B]">Sign in to continue to your wallet</p>
                <div className="mt-8 space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-[#64748B]">Email</label>
                        <input type="email" placeholder="you@company.com" className={`${input} mt-1.5`} readOnly />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-[#64748B]">Password</label>
                        <input type="password" placeholder="••••••••" className={`${input} mt-1.5`} readOnly />
                    </div>
                    <div className="flex justify-end">
                        <button type="button" className="text-xs font-semibold text-[#2563EB]">
                            Forgot password?
                        </button>
                    </div>
                </div>
                <motion.button
                    type="button"
                    className={`${primaryBtn} mt-6`}
                    whileHover={reduce ? undefined : { scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                >
                    Sign in
                </motion.button>
                <div className="mt-6 flex items-center gap-3">
                    <span className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs text-[#64748B]">or continue with</span>
                    <span className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="mt-5 flex justify-center gap-3">
                    {[
                        <svg key="fb" className="h-[22px] w-[22px]" viewBox="0 0 24 24" aria-hidden>
                            <path
                                fill="#1877F2"
                                d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                            />
                        </svg>,
                        <svg key="g" className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>,
                        <svg key="a" className="h-5 w-5 text-[#0F172A]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                        </svg>,
                    ].map((icon, i) => (
                        <motion.button
                            key={i}
                            type="button"
                            whileHover={reduce ? undefined : { scale: 1.06, boxShadow: '0 0 20px rgba(37,99,235,0.2)' }}
                            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm"
                        >
                            {icon}
                        </motion.button>
                    ))}
                </div>
                <p className="mt-10 text-center text-sm text-[#64748B]">
                    New here?{' '}
                    <span className="font-semibold text-[#2563EB]">Create an account</span>
                </p>
            </div>
        </div>
    );
}

export function ScreenRegister() {
    const reduce = useReducedMotion();
    return (
        <div className="min-h-full bg-[#F8FAFC] pb-6 font-inter">
            <StatusBar />
            <div className="px-4 pb-4 pt-2">
                <div className="rounded-[26px] border border-slate-200/70 bg-white/95 p-5 shadow-[0_12px_40px_-16px_rgba(37,99,235,0.15)] ring-1 ring-white">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#2563EB]">Create account</p>
                    <h1 className="mt-1 text-xl font-bold text-[#0F172A]">Join RACE NETWORK</h1>
                    <p className="mt-1 text-xs text-[#64748B]">Professional onboarding in under two minutes.</p>
                    <div className="mt-5 space-y-3.5">
                        <div>
                            <label className="text-xs font-semibold text-[#64748B]">Full name</label>
                            <input type="text" placeholder="Alex Morgan" className={`${input} mt-1.5`} readOnly />
                        </div>
                        <div>
                            <label htmlFor="fintech-reg-country" className="text-xs font-semibold text-[#64748B]">
                                Country
                            </label>
                            <select
                                id="fintech-reg-country"
                                defaultValue="US"
                                className={`${input} mt-1.5 cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-10`}
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748B'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                                }}
                            >
                                <option value="US">United States</option>
                                <option value="GB">United Kingdom</option>
                                <option value="AE">United Arab Emirates</option>
                                <option value="IN">India</option>
                                <option value="PK">Pakistan</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-[#64748B]">Phone</label>
                            <div className="mt-1.5 flex gap-2">
                                <span className={`${input} w-[4.5rem] shrink-0 text-center text-sm`}>+1</span>
                                <input type="tel" placeholder="555 000 0000" className={input} readOnly />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-[#64748B]">Email</label>
                            <input type="email" placeholder="you@email.com" className={`${input} mt-1.5`} readOnly />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-[#64748B]">Password</label>
                            <input type="password" placeholder="Create a strong password" className={`${input} mt-1.5`} readOnly />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-[#64748B]">Referral code</label>
                            <input type="text" placeholder="Sponsor or invite code (optional)" className={`${input} mt-1.5`} readOnly />
                        </div>
                        <label className="flex cursor-pointer items-start gap-3 pt-1">
                            <input type="checkbox" defaultChecked className="mt-1 rounded-md border-slate-300 text-[#2563EB] focus:ring-[#2563EB]" readOnly />
                            <span className="text-[11px] leading-relaxed text-[#64748B]">
                                I agree to the <span className="font-semibold text-[#2563EB]">Terms</span> and{' '}
                                <span className="font-semibold text-[#2563EB]">Privacy Policy</span>.
                            </span>
                        </label>
                    </div>
                    <motion.button
                        type="button"
                        className={`${primaryBtn} mt-6`}
                        whileHover={reduce ? undefined : { scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        Create account
                    </motion.button>
                    <p className="mt-4 text-center text-xs text-[#64748B]">
                        Already a member? <span className="font-semibold text-[#2563EB]">Sign in</span>
                    </p>
                </div>
            </div>
        </div>
    );
}

export function ScreenWallet() {
    return (
        <div className="min-h-full bg-[#F8FAFC] pb-1 font-inter">
            <StatusBar />
            <div className="px-4 pb-1 pt-2">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold text-[#0F172A]">Wallet</h1>
                    <button type="button" className="text-xs font-semibold text-[#2563EB]">
                        Analytics
                    </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                    <motion.button
                        type="button"
                        whileHover={{ y: -2 }}
                        className="flex flex-col items-center rounded-[22px] bg-gradient-to-br from-[#2563EB] to-[#1d4ed8] py-4 text-white shadow-[0_12px_32px_-8px_rgba(37,99,235,0.45)] ring-1 ring-white/20"
                    >
                        <svg className="mb-1 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-sm font-bold">Deposit</span>
                    </motion.button>
                    <motion.button
                        type="button"
                        whileHover={{ y: -2 }}
                        className="flex flex-col items-center rounded-[22px] border border-slate-200/90 bg-white py-4 shadow-sm ring-1 ring-white"
                    >
                        <svg className="mb-1 h-6 w-6 text-[#0F172A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                        </svg>
                        <span className="text-sm font-bold text-[#0F172A]">Withdraw</span>
                    </motion.button>
                </div>
                <div
                    className={`${card} relative mt-4 overflow-hidden border-0 bg-gradient-to-br from-white to-sky-50/80`}
                    style={{ boxShadow: '0 12px 40px -12px rgba(37,99,235,0.12)' }}
                >
                    <div className="absolute -right-6 top-0 h-24 w-24 rounded-full bg-[#38BDF8]/15 blur-2xl" />
                    <p className="relative text-[10px] font-bold uppercase tracking-wide text-[#64748B]">Balance overview</p>
                    <p className="relative mt-1 font-mono text-[26px] font-bold text-[#0F172A]">$24,580.40</p>
                    <p className="relative mt-1 text-xs text-[#64748B]">+$1,240.00 this month · settled &amp; cleared</p>
                </div>
                <div className="mt-3 grid grid-cols-5 gap-2">
                    <div className="col-span-2 rounded-[20px] border border-slate-200/70 bg-white p-3 shadow-sm ring-1 ring-white">
                        <p className="text-[9px] font-bold uppercase text-[#64748B]">Wallet flow</p>
                        <div className="mt-2 flex h-[72px] items-end gap-1">
                            {[35, 55, 40, 70, 50, 80, 60].map((h, i) => (
                                <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-[#2563EB]/25 to-[#2563EB]" style={{ height: `${h}%` }} />
                            ))}
                        </div>
                    </div>
                    <div className="col-span-3 rounded-[20px] border border-slate-200/70 bg-white p-3 shadow-sm ring-1 ring-white">
                        <p className="text-[9px] font-bold uppercase text-[#64748B]">Analytics snapshot</p>
                        <div className="mt-3 space-y-2.5">
                            {[
                                ['Liquid', '38%', '#38BDF8'],
                                ['Staked', '45%', '#2563EB'],
                                ['Pending', '17%', '#94a3b8'],
                            ].map(([l, p, col]) => (
                                <div key={l} className="flex items-center gap-2 text-[11px]">
                                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: col }} />
                                    <span className="text-[#64748B]">{l}</span>
                                    <span className="ml-auto font-bold text-[#0F172A]">{p}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-wide text-[#64748B]">Transaction history</p>
                <div className="mt-2 space-y-2">
                    {[
                        ['Deposit · USDT', 'May 10', '+$500.00', true],
                        ['Withdraw · Bank', 'May 8', '-$200.00', false],
                        ['Commission', 'May 7', '+$84.00', true],
                    ].map(([t, d, a, pos]) => (
                        <div
                            key={t}
                            className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white px-3 py-2.5 shadow-sm"
                        >
                            <div>
                                <p className="text-[13px] font-semibold text-[#0F172A]">{t}</p>
                                <p className="text-[10px] text-[#64748B]">{d}</p>
                            </div>
                            <span className={`text-[13px] font-bold ${pos ? 'text-emerald-600' : 'text-[#0F172A]'}`}>{a}</span>
                        </div>
                    ))}
                </div>
                <BottomNav active="wallet" />
            </div>
        </div>
    );
}

export function ScreenPackages() {
    const tiers = [
        {
            name: 'Starter',
            price: '$99',
            tag: 'Entry',
            perks: ['Core dashboard', 'Standard payouts', 'Email support'],
            highlight: false,
        },
        {
            name: 'Premium',
            price: '$499',
            tag: 'Most popular',
            perks: ['Priority settlement', 'Advanced analytics', 'Dedicated manager'],
            highlight: true,
        },
        {
            name: 'VIP',
            price: '$1,999',
            tag: 'Scale',
            perks: ['Custom limits', 'API access', 'White-glove onboarding'],
            highlight: false,
        },
    ];
    return (
        <div className="min-h-full bg-[#F8FAFC] pb-1 font-inter">
            <StatusBar />
            <div className="px-4 pb-1 pt-2">
                <h1 className="text-xl font-bold text-[#0F172A]">Packages</h1>
                <p className="mt-1 text-xs text-[#64748B]">Compare plans and upgrade anytime.</p>
                <div className="mt-4 space-y-3">
                    {tiers.map((tier) => (
                        <motion.div
                            key={tier.name}
                            whileHover={tier.highlight ? { scale: 1.02 } : { y: -2 }}
                            className={`relative overflow-hidden rounded-[24px] p-4 ${
                                tier.highlight
                                    ? 'border-2 border-[#38BDF8]/60 bg-white shadow-[0_16px_48px_-12px_rgba(37,99,235,0.25)] ring-1 ring-[#2563EB]/10'
                                    : `${card} !shadow-[0_6px_24px_-10px_rgba(15,23,42,0.08)]`
                            }`}
                        >
                            {tier.highlight ? (
                                <div
                                    className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-40 blur-2xl"
                                    style={{ background: `linear-gradient(135deg, ${primary}, ${sky})` }}
                                />
                            ) : null}
                            <div className="relative flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">{tier.tag}</p>
                                    <p className="mt-0.5 text-lg font-bold text-[#0F172A]">{tier.name}</p>
                                </div>
                                <p className="font-mono text-xl font-bold text-[#2563EB]">{tier.price}</p>
                            </div>
                            <ul className="relative mt-3 space-y-1.5">
                                {tier.perks.map((p) => (
                                    <li key={p} className="flex items-center gap-2 text-[11px] text-[#64748B]">
                                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2563EB]/10">
                                            <svg className="h-2.5 w-2.5 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </span>
                                        {p}
                                    </li>
                                ))}
                            </ul>
                            <button
                                type="button"
                                className={
                                    tier.highlight
                                        ? `${primaryBtn} mt-4 !py-3`
                                        : `${ghostBtn} mt-4 !py-3 border-slate-200 bg-slate-50/80`
                                }
                            >
                                {tier.highlight ? 'Get Premium' : `Choose ${tier.name}`}
                            </button>
                        </motion.div>
                    ))}
                </div>
                <div className={`${card} mt-4 !p-3`}>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">At a glance</p>
                    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80">
                        <div className="grid grid-cols-4 border-b border-slate-200/70 bg-slate-50/90 text-[8px] font-bold uppercase tracking-wide text-[#64748B]">
                            <span className="px-2 py-2">Feature</span>
                            <span className="py-2 text-center text-[#0F172A]">Starter</span>
                            <span className="py-2 text-center text-[#2563EB]">Premium</span>
                            <span className="py-2 text-center text-[#0F172A]">VIP</span>
                        </div>
                        {[
                            ['Payout speed', 'Standard', 'Priority', 'Instant'],
                            ['Analytics', 'Core', 'Advanced', 'Enterprise'],
                            ['Support', 'Email', 'Dedicated', '24/7 white-glove'],
                            ['API access', '—', 'Limited', 'Full'],
                        ].map(([label, a, b, c]) => (
                            <div
                                key={label}
                                className="grid grid-cols-4 border-b border-slate-100/90 text-[10px] last:border-b-0"
                            >
                                <span className="px-2 py-2 font-medium text-[#64748B]">{label}</span>
                                <span className="py-2 text-center text-[#0F172A]/85">{a}</span>
                                <span className="py-2 text-center font-semibold text-[#2563EB]">{b}</span>
                                <span className="py-2 text-center font-medium text-[#0F172A]">{c}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <BottomNav active="plans" />
            </div>
        </div>
    );
}

function EarningsBarChart() {
    const bars = [48, 72, 56, 88, 64, 92, 78, 100, 84, 96, 70, 90];
    const reduce = useReducedMotion();
    return (
        <div className="flex h-28 items-end justify-between gap-1 px-0.5">
            {bars.map((h, i) => (
                <motion.div
                    key={i}
                    initial={reduce ? false : { height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={reduce ? { duration: 0 } : { delay: i * 0.03, duration: 0.5, ease: 'easeOut' }}
                    className="flex-1 rounded-t-md bg-gradient-to-t from-[#2563EB]/30 to-[#38BDF8]"
                    style={{ minHeight: '8%' }}
                />
            ))}
        </div>
    );
}

export function ScreenEarnings() {
    return (
        <div className="min-h-full bg-[#F8FAFC] pb-1 font-inter">
            <StatusBar />
            <div className="px-4 pb-1 pt-2">
                <h1 className="text-xl font-bold text-[#0F172A]">Earnings</h1>
                <p className="mt-1 text-xs text-[#64748B]">Revenue, commissions, and team performance.</p>
                <div className={`${card} mt-4 border-0 bg-gradient-to-br from-[#2563EB] to-[#0ea5e9] p-4 text-white shadow-[0_14px_40px_-10px_rgba(37,99,235,0.45)]`}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80">Total revenue (YTD)</p>
                    <p className="mt-1 font-mono text-2xl font-bold">$48,920.00</p>
                    <p className="mt-2 text-[11px] text-emerald-200">+22.1% vs last year</p>
                </div>
                <div className={`${card} mt-3`}>
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">Monthly performance</p>
                        <span className="text-[10px] font-bold text-[#2563EB]">2026</span>
                    </div>
                    <EarningsBarChart />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                    {[
                        ['Direct', '$12.4K', '+6%'],
                        ['Binary', '$8.1K', '+3%'],
                        ['Matching', '$4.2K', '+9%'],
                        ['Leadership', '$2.9K', '+1%'],
                    ].map(([t, v, g]) => (
                        <motion.div
                            key={t}
                            whileHover={{ scale: 1.02 }}
                            className="rounded-[20px] border border-slate-200/70 bg-white p-3 shadow-sm ring-1 ring-white"
                        >
                            <p className="text-[10px] font-bold uppercase text-[#64748B]">{t}</p>
                            <p className="mt-1 font-mono text-lg font-bold text-[#0F172A]">{v}</p>
                            <p className="mt-0.5 text-[10px] font-semibold text-emerald-600">{g}</p>
                        </motion.div>
                    ))}
                </div>
                <div className={`${card} mt-3`}>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">Performance overview</p>
                    <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
                        Your payout velocity is in the top <span className="font-bold text-[#2563EB]">8%</span> of the network.
                        Maintain Premium status to unlock boosted matching.
                    </p>
                </div>
                <BottomNav active="earn" />
            </div>
        </div>
    );
}

/* Legacy exports — kept as aliases so older imports do not break */
export const ScreenWelcome = ScreenLanding;
