import { WelcomeAuthComingSoonButton } from '@/Components/Welcome/WelcomeAuthComingSoon';
import { RACE_FEATURE_NETWORK, RACE_LOGO_SRC } from '@/lib/brandAssets';
import {
    CORE_ECOSYSTEM,
    FAQ_ITEMS,
    FEATURES_GRID,
    FOOTER_LINKS,
    HERO_ORBIT,
    PRODUCT_SECTIONS,
    SOCIAL,
    STATS,
    TESTIMONIALS,
    TIMELINE,
    TRUSTED_LOGOS,
} from '@/data/premiumWelcomeContent';
import { motion, useInView, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

const NAVY = '#06111F';
const GLOW = '#00BFFF';
const ELECTRIC = '#00E5FF';
const GOLD = '#FFC72C';
const TEXT = '#F8FAFC';

const fadeUp = {
    hidden: { opacity: 0, y: 36 },
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.75, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
    }),
};

function Icon({ name, className = 'h-5 w-5' }) {
    const p = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.6 };
    const paths = {
        brain: 'M9.5 4.5a2.5 2.5 0 011.5 2.29v11.42a2.5 2.5 0 01-4.48 1.54 2.5 2.5 0 01-.52-2.77 2.25 2.25 0 01-.25-4.19 2.5 2.5 0 011.75-4.24A2.5 2.5 0 019.5 4.5z M14.5 4.5a2.5 2.5 0 00-1.5 2.29v11.42a2.5 2.5 0 004.48 1.54 2.5 2.5 0 00.52-2.77 2.25 2.25 0 00.25-4.19 2.5 2.5 0 00-1.75-4.24A2.5 2.5 0 0014.5 4.5z M12 6.75v10.5',
        wallet: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
        gamepad: 'M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.746 3.133 1.593 4.415a47.865 47.865 0 01-3.067 3.75M14.25 6.087v0a.64.64 0 00-.658-.643 48.39 48.39 0 00-4.163.3c.186-1.613.746-3.133 1.593-4.415a47.865 47.865 0 013.067-3.75M6.75 15.113v0A48.413 48.413 0 0112 13.5c2.592 0 5.026.64 7.162 1.77M6.75 15.113A48.11 48.11 0 0112 16.5c2.592 0 5.026-.64 7.162-1.77m0 0a48.524 48.524 0 00-4.287-2.403',
        cubes: 'M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122',
        'shield-check': 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
        shield: 'M9 12.75L11.25 15 15 9.75M3.75 4.5h16.5v3A17.932 17.932 0 0112 21.75 17.932 17.932 0 014.5 7.5v-3z',
        globe: 'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m14.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m14.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A8.966 8.966 0 013 12c0-1.97.633-3.794 1.716-5.277',
        rocket: 'M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z',
        users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
        lightbulb: 'M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m4.5 0a12.05 12.05 0 003.478-.897M6.75 9.75a5.25 5.25 0 1110.5 0c0 1.61-.59 3.09-1.565 4.228M9.75 18h4.5',
        server: 'M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a3 3 0 013-3h13.5a3 3 0 013 3m0 0v.75A2.25 2.25 0 0118 6.75h-12A2.25 2.25 0 015.25 9v.75',
        chart: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
    };
    const d = paths[name];
    if (!d) return null;
    return (
        <svg {...p}>
            {d.split(' M').map((seg, i) => (
                <path key={i} strokeLinecap="round" strokeLinejoin="round" d={i === 0 ? seg : `M${seg}`} />
            ))}
        </svg>
    );
}

function CinematicBackground({ reduce }) {
    const particles = Array.from({ length: 56 }, (_, i) => ({
        id: i,
        left: `${(i * 17 + 3) % 100}%`,
        top: `${(i * 23 + 7) % 100}%`,
        size: 1 + (i % 3),
        delay: (i % 12) * 0.25,
        gold: i % 5 === 0,
    }));

    return (
        <div className="rx-cinematic-bg" aria-hidden>
            <div className="rx-cinematic-bg__grid" />
            <div className="rx-cinematic-bg__circuit" />
            <div className="rx-cinematic-bg__fog" />
            <div className="rx-cinematic-bg__beam rx-cinematic-bg__beam--1" />
            <div className="rx-cinematic-bg__beam rx-cinematic-bg__beam--2" />
            <div className="rx-cinematic-bg__beam rx-cinematic-bg__beam--3" />
            <svg className="rx-city-skyline" viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice">
                <defs>
                    <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0A1E35" stopOpacity="0" />
                        <stop offset="100%" stopColor="#00BFFF" stopOpacity="0.15" />
                    </linearGradient>
                </defs>
                <path fill="url(#skyGrad)" d="M0,320 L0,180 L40,160 L80,200 L120,140 L160,190 L200,120 L240,170 L280,100 L320,150 L360,90 L400,130 L440,80 L480,140 L520,70 L560,120 L600,60 L640,110 L680,50 L720,100 L760,40 L800,90 L840,55 L880,105 L920,45 L960,95 L1000,65 L1040,115 L1080,75 L1120,125 L1160,85 L1200,135 L1240,95 L1280,145 L1320,100 L1360,150 L1400,110 L1440,160 L1440,320 Z" opacity="0.35" />
                <path fill="#0A1E35" d="M0,320 L0,220 L60,200 L100,240 L150,190 L200,250 L260,180 L320,230 L380,170 L440,220 L500,160 L560,210 L620,150 L680,200 L740,140 L800,190 L860,130 L920,180 L980,120 L1040,170 L1100,110 L1160,160 L1220,100 L1280,150 L1340,90 L1400,140 L1440,120 L1440,320 Z" opacity="0.85" />
                {Array.from({ length: 36 }, (_, i) => (
                    <circle key={i} cx={48 + i * 38} cy={198 - (i % 3) * 6} r="1.5" fill={i % 4 === 0 ? GOLD : GLOW} opacity={0.18 + (i % 3) * 0.06} />
                ))}
            </svg>
            {particles.map((p) => (
                <motion.span
                    key={p.id}
                    className="absolute rounded-full"
                    style={{
                        left: p.left,
                        top: p.top,
                        width: p.size,
                        height: p.size,
                        backgroundColor: p.gold ? GOLD : ELECTRIC,
                    }}
                    animate={reduce ? undefined : { opacity: [0.08, 0.75, 0.08], y: [0, -24, 0] }}
                    transition={{ duration: 4 + (p.id % 5), repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

function GlassCard({ children, className = '', hover = true }) {
    return (
        <div className={`rx-glass-card ${hover ? 'rx-glass-card--hover' : ''} ${className}`}>
            <div className="relative z-[1]">{children}</div>
        </div>
    );
}

function Icon3D({ name, size = 'h-12 w-12' }) {
    return (
        <div className={`rx-icon-3d ${size}`}>
            <Icon name={name} className="h-5 w-5" />
        </div>
    );
}

function SectionHead({ label, title, highlight, subtitle, center = true }) {
    return (
        <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className={`mb-12 max-w-3xl ${center ? 'mx-auto text-center' : ''}`}
        >
            <p className="text-[11px] font-bold uppercase tracking-[0.32em]" style={{ color: ELECTRIC }}>{label}</p>
            <div className={`rx-gold-divider mt-4 ${center ? 'mx-auto max-w-xs' : 'max-w-xs'}`} />
            <h2 className="font-space mt-6 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl" style={{ color: TEXT }}>
                {title}{' '}
                {highlight && <span className="rx-text-gold">{highlight}</span>}
            </h2>
            {subtitle && (
                <p className={`mt-5 text-sm leading-relaxed text-slate-400 sm:text-base ${center ? 'mx-auto' : ''}`}>{subtitle}</p>
            )}
        </motion.div>
    );
}

function BtnPrimary({ children, onClick, href, className = '' }) {
    const cls = `rx-btn-cinematic inline-flex items-center justify-center px-8 py-4 text-sm sm:text-base ${className}`;
    const shine = <span className="rx-btn-cinematic__shine" aria-hidden />;
    if (href) {
        return <a href={href} className={cls}>{shine}{children}</a>;
    }
    return <button type="button" onClick={onClick} className={cls}>{shine}{children}</button>;
}

function BtnGhost({ children, href, className = '' }) {
    return (
        <a href={href} className={`rx-btn-gold-ghost inline-flex items-center justify-center px-8 py-4 text-sm font-bold sm:text-base ${className}`}>
            {children}
        </a>
    );
}

function NetworkOverlay() {
    return (
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 400 400" fill="none" preserveAspectRatio="xMidYMid slice">
            <circle cx="200" cy="200" r="120" stroke={GLOW} strokeWidth="0.5" opacity="0.3" strokeDasharray="4 8" />
            <circle cx="200" cy="200" r="155" stroke={ELECTRIC} strokeWidth="0.4" opacity="0.2" />
            {[
                [200, 80], [320, 200], [200, 320], [80, 200], [280, 120], [120, 280], [280, 280], [120, 120],
            ].map(([cx, cy], i) => (
                <g key={i}>
                    <line x1="200" y1="200" x2={cx} y2={cy} stroke={GLOW} strokeWidth="0.6" opacity="0.25" />
                    <circle cx={cx} cy={cy} r="4" fill={i % 2 === 0 ? GOLD : ELECTRIC} opacity="0.7">
                        <animate attributeName="opacity" values="0.4;1;0.4" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
                    </circle>
                </g>
            ))}
            <circle cx="200" cy="200" r="6" fill={ELECTRIC} opacity="0.9">
                <animate attributeName="r" values="5;8;5" dur="3s" repeatCount="indefinite" />
            </circle>
        </svg>
    );
}

function HeroCinematic({ reduce }) {
    const mx = useMotionValue(0);
    const my = useMotionValue(0);
    const px = useSpring(mx, { stiffness: 70, damping: 22 });
    const py = useSpring(my, { stiffness: 70, damping: 22 });

    return (
        <motion.div
            className="rx-hero-stage mx-auto w-full max-w-[min(100%,620px)]"
            style={{ x: px, y: py }}
            onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                mx.set(((e.clientX - r.left) / r.width - 0.5) * 18);
                my.set(((e.clientY - r.top) / r.height - 0.5) * 14);
            }}
            onMouseLeave={() => { mx.set(0); my.set(0); }}
        >
            <div className="rx-hero-floor" />
            <div className="relative">
                <div className="rx-hero-glow-aura" />
                <div className={`rx-hero-orbit-ring ${reduce ? '!animate-none' : ''}`} />
                <div className={`rx-hero-orbit-ring rx-hero-orbit-ring--dashed ${reduce ? '!animate-none' : ''}`} />
                <div className="rx-hero-cinematic-card relative z-[1]">
                    <img src={RACE_FEATURE_NETWORK} alt="RACE Network — global AI and blockchain ecosystem" className="aspect-square object-cover" />
                    <NetworkOverlay />
                </div>
            </div>
            <div className="rx-hero-reflection" aria-hidden>
                <img src={RACE_FEATURE_NETWORK} alt="" className="aspect-square object-cover" />
            </div>
        </motion.div>
    );
}

function CinematicNav() {
    const links = [
        { label: 'Ecosystem', href: '#ecosystem' },
        { label: 'Products', href: '#ai-products' },
        { label: 'Features', href: '#features' },
        { label: 'Roadmap', href: '#timeline' },
    ];
    const loginHref = typeof route === 'function' ? route('login') : '/login';
    const registerHref = typeof route === 'function' ? route('register') : '/register';

    return (
        <header className="rx-nav-cinematic fixed inset-x-0 top-0 z-50">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
                <a href="#hero" className="flex items-center gap-3">
                    <img src={RACE_LOGO_SRC} alt="RACE Network" className="h-9 w-9 object-contain" />
                    <span className="font-space hidden text-sm font-bold sm:inline" style={{ color: TEXT }}>RACE Network</span>
                </a>
                <nav className="hidden items-center gap-8 md:flex">
                    {links.map((l) => (
                        <a key={l.href} href={l.href} className="text-xs font-semibold uppercase tracking-widest text-slate-400 transition hover:text-[#00E5FF]">
                            {l.label}
                        </a>
                    ))}
                </nav>
                <div className="flex items-center gap-2">
                    <a
                        href={loginHref}
                        className="rx-btn-gold-ghost inline-flex items-center justify-center !px-4 !py-2.5 !text-xs sm:!text-sm"
                    >
                        Sign in
                    </a>
                    <BtnPrimary href={registerHref} className="!px-5 !py-2.5 !text-xs sm:!text-sm">
                        Register
                    </BtnPrimary>
                </div>
            </div>
        </header>
    );
}

function CounterCard({ stat, index }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true });
    const mv = useMotionValue(0);
    const spring = useSpring(mv, { stiffness: 55, damping: 18 });
    const [n, setN] = useState(0);
    useEffect(() => { if (inView) mv.set(stat.value); }, [inView, mv, stat.value]);
    useEffect(() => { const u = spring.on('change', (v) => setN(Math.round(v))); return u; }, [spring]);

    return (
        <motion.div ref={ref} custom={index} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlassCard className="p-8 text-center">
                <p className="font-space text-4xl font-bold">
                    <span className="rx-text-blue">{n}{stat.suffix}</span>
                </p>
                <div className="rx-gold-divider mx-auto my-3 max-w-[60px]" />
                <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: GOLD }}>{stat.label}</p>
                <p className="mt-1 text-xs text-slate-500">{stat.caption}</p>
            </GlassCard>
        </motion.div>
    );
}

function FaqItem({ item, open, onToggle }) {
    return (
        <GlassCard hover={false} className="overflow-hidden">
            <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6">
                <span className="font-space text-sm font-semibold sm:text-base" style={{ color: TEXT }}>{item.q}</span>
                <span className={`shrink-0 text-lg transition ${open ? 'rotate-45' : ''}`} style={{ color: GOLD }}>+</span>
            </button>
            {open && (
                <>
                    <div className="rx-gold-divider mx-6" />
                    <p className="px-5 pb-5 pt-3 text-sm leading-relaxed text-slate-400 sm:px-6 sm:pb-6">{item.a}</p>
                </>
            )}
        </GlassCard>
    );
}

function SectionShell({ children, className = '' }) {
    return (
        <GlassCard hover={false} className={`rx-section-shell ${className}`}>
            {children}
        </GlassCard>
    );
}

export default function PremiumWelcomeLanding() {
    const reduce = useReducedMotion();
    const [faqOpen, setFaqOpen] = useState(0);
    const registerHref = typeof route === 'function' ? route('register') : '/register';

    return (
        <>
            <div className="rx-cinematic relative min-h-screen overflow-x-clip font-inter antialiased" style={{ backgroundColor: NAVY, color: TEXT }}>
                <CinematicBackground reduce={reduce} />
                <CinematicNav />

                <main className="relative z-10 pt-20">
                    {/* 1. HERO */}
                    <section id="hero" className="relative mx-auto max-w-7xl scroll-mt-24 px-4 pb-20 pt-8 sm:px-6 sm:pb-28 sm:pt-12 lg:min-h-screen lg:py-24">
                        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
                            <motion.div initial="hidden" animate="visible" variants={fadeUp}>
                                <span className="inline-flex items-center gap-2 rounded-full border border-[#00BFFF]/30 bg-[#0A1E35]/80 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: ELECTRIC }}>
                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: GOLD }} />
                                    Web3 · AI · Enterprise
                                </span>
                                <h1 className="font-space mt-8 text-4xl font-bold leading-[1.04] tracking-tight sm:text-5xl lg:text-6xl xl:text-[4.25rem]">
                                    The{' '}
                                    <span className="rx-text-gold">Intelligent</span>{' '}
                                    Infrastructure for a{' '}
                                    <span className="rx-text-blue">Connected World</span>
                                </h1>
                                <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 lg:text-lg">
                                    RACE Network unites artificial intelligence, blockchain, digital payments, and DAO governance — built with cinematic precision for investors, enterprises, and global communities.
                                </p>
                                <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                                    <BtnPrimary href="#ecosystem">Explore Ecosystem</BtnPrimary>
                                    <WelcomeAuthComingSoonButton
                                        href={registerHref}
                                        className="rx-btn-gold-ghost inline-flex items-center justify-center px-8 py-4 text-sm font-bold sm:text-base"
                                    >
                                        Join the Network
                                    </WelcomeAuthComingSoonButton>
                                </div>
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.92 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                            >
                                <HeroCinematic reduce={reduce} />
                            </motion.div>
                        </div>
                    </section>

                    {/* 2. TRUSTED */}
                    <section id="trusted" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
                        <SectionShell>
                            <p className="mb-8 text-center text-[10px] font-bold uppercase tracking-[0.34em] text-slate-500">
                                Trusted by forward-thinking enterprises
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-5">
                                {TRUSTED_LOGOS.map((name) => (
                                    <span key={name} className="font-space text-sm font-semibold text-slate-500 transition hover:text-[#FFC72C] sm:text-base">
                                        {name}
                                    </span>
                                ))}
                            </div>
                        </SectionShell>
                    </section>

                    {/* 3. CORE ECOSYSTEM */}
                    <section id="ecosystem" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24">
                        <SectionHead
                            label="Core Ecosystem"
                            title="Six Pillars of"
                            highlight="Digital Excellence"
                            subtitle="AI, payments, blockchain, gaming, governance, and global connectivity — engineered as one premium platform."
                        />
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {CORE_ECOSYSTEM.map((card, i) => (
                                <motion.div key={card.title} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                                    <GlassCard className="h-full p-6 sm:p-7">
                                        <Icon3D name={card.icon} className="mb-5 h-12 w-12" />
                                        <h3 className="font-space text-lg font-bold" style={{ color: TEXT }}>{card.title}</h3>
                                        <div className="rx-gold-divider my-3 max-w-[48px]" />
                                        <p className="text-sm leading-relaxed text-slate-400">{card.description}</p>
                                    </GlassCard>
                                </motion.div>
                            ))}
                        </div>
                    </section>

                    {/* 4–7. PRODUCT SECTIONS */}
                    {PRODUCT_SECTIONS.map((sec, i) => (
                        <section key={sec.id} id={sec.id} className="mx-auto max-w-7xl scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16">
                            <SectionShell>
                                <div className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-14 ${sec.reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
                                    <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                                        <div className="overflow-hidden rounded-[20px] border border-[#00BFFF]/25 shadow-[0_0_48px_rgba(0,191,255,0.2)]">
                                            <img src={sec.image} alt="" className="w-full object-cover" />
                                        </div>
                                    </motion.div>
                                    <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1}>
                                        <p className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: ELECTRIC }}>{sec.label}</p>
                                        <div className="rx-gold-divider mt-3 max-w-[64px]" />
                                        <h2 className="font-space mt-5 text-3xl font-bold sm:text-4xl" style={{ color: TEXT }}>
                                            {sec.title}{' '}
                                            <span className="rx-text-gold">{sec.highlight}</span>
                                        </h2>
                                        <p className="mt-4 text-sm leading-relaxed text-slate-400 sm:text-base">{sec.description}</p>
                                        <ul className="mt-6 space-y-2.5">
                                            {sec.features.map((f) => (
                                                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                                                    <span style={{ color: GOLD }}>◆</span> {f}
                                                </li>
                                            ))}
                                        </ul>
                                        <BtnGhost href="#cta" className="mt-8">Learn More →</BtnGhost>
                                    </motion.div>
                                </div>
                            </SectionShell>
                        </section>
                    ))}

                    {/* 8. STATS */}
                    <section id="stats" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16">
                        <SectionHead label="By the Numbers" title="Built for" highlight="Global Scale" />
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            {STATS.map((s, i) => <CounterCard key={s.label} stat={s} index={i} />)}
                        </div>
                    </section>

                    {/* 9. FEATURES */}
                    <section id="features" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16">
                        <SectionShell>
                            <SectionHead
                                label="Platform Features"
                                title="Engineered for"
                                highlight="Excellence"
                                subtitle="Enterprise security, lightning performance, and AI-native intelligence — every detail refined."
                            />
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                {FEATURES_GRID.map((f, i) => (
                                    <motion.div key={f.title} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                                        <GlassCard className="h-full p-5">
                                            <Icon3D name={f.icon} className="mb-4 h-10 w-10" />
                                            <h3 className="font-space text-sm font-bold" style={{ color: TEXT }}>{f.title}</h3>
                                            <p className="mt-2 text-xs leading-relaxed text-slate-500">{f.description}</p>
                                        </GlassCard>
                                    </motion.div>
                                ))}
                            </div>
                        </SectionShell>
                    </section>

                    {/* 10. TIMELINE */}
                    <section id="timeline" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16">
                        <SectionHead label="Roadmap" title="Journey to" highlight="Tomorrow" />
                        <div className="relative space-y-5 pl-10 before:absolute before:left-4 before:top-3 before:h-[calc(100%-1.5rem)] before:w-px before:bg-gradient-to-b before:from-[#FFC72C] before:via-[#00E5FF] before:to-transparent sm:pl-14">
                            {TIMELINE.map((t, i) => (
                                <motion.div key={t.year} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="relative">
                                    <span
                                        className="absolute -left-10 top-7 h-3.5 w-3.5 rounded-full border-2 sm:-left-12"
                                        style={{ borderColor: GOLD, backgroundColor: NAVY, boxShadow: `0 0 14px ${GOLD}` }}
                                    />
                                    <GlassCard className="p-6 sm:p-7">
                                        <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: GOLD }}>{t.year}</p>
                                        <h3 className="font-space mt-2 text-lg font-bold" style={{ color: TEXT }}>{t.title}</h3>
                                        <p className="mt-2 text-sm text-slate-400">{t.body}</p>
                                    </GlassCard>
                                </motion.div>
                            ))}
                        </div>
                    </section>

                    {/* 11. TESTIMONIALS */}
                    <section id="testimonials" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16">
                        <SectionHead label="Testimonials" title="Trusted by" highlight="Innovators" />
                        <div className="grid gap-5 lg:grid-cols-3">
                            {TESTIMONIALS.map((t, i) => (
                                <motion.div key={t.name} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                                    <GlassCard className="h-full p-7">
                                        <p className="text-sm leading-relaxed text-slate-300">&ldquo;{t.quote}&rdquo;</p>
                                        <div className="rx-gold-divider my-5" />
                                        <p className="font-space text-sm font-bold" style={{ color: TEXT }}>{t.name}</p>
                                        <p className="text-xs text-slate-500">{t.role}</p>
                                    </GlassCard>
                                </motion.div>
                            ))}
                        </div>
                    </section>

                    {/* 12. FAQ */}
                    <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16">
                        <SectionHead label="FAQ" title="Common" highlight="Questions" />
                        <div className="space-y-3">
                            {FAQ_ITEMS.map((item, i) => (
                                <FaqItem key={item.q} item={item} open={faqOpen === i} onToggle={() => setFaqOpen(faqOpen === i ? -1 : i)} />
                            ))}
                        </div>
                    </section>

                    {/* 13. CTA */}
                    <section id="cta" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16">
                        <motion.div initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
                            <SectionShell className="!border-[#00E5FF]/35 text-center">
                                <h2 className="font-space text-3xl font-bold sm:text-5xl" style={{ color: TEXT }}>
                                    Ready to Build the{' '}
                                    <span className="rx-text-gold">Future</span>?
                                </h2>
                                <p className="mx-auto mt-4 max-w-lg text-sm text-slate-400 sm:text-base">
                                    Join the premium AI and blockchain ecosystem designed for enterprise clients and global communities.
                                </p>
                                <BtnPrimary onClick={() => setAuthOpen(true)} className="mt-10">Get Started →</BtnPrimary>
                            </SectionShell>
                        </motion.div>
                    </section>
                </main>

                {/* 14. FOOTER */}
                <footer className="relative z-10 border-t border-[#00BFFF]/15 py-14 sm:py-16" style={{ backgroundColor: 'rgba(6,17,31,0.92)' }}>
                    <div className="mx-auto max-w-7xl px-4 sm:px-6">
                        <GlassCard hover={false} className="p-8 sm:p-10">
                            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="sm:col-span-2 lg:col-span-1">
                                    <div className="flex items-center gap-3">
                                        <img src={RACE_LOGO_SRC} alt="RACE Network" className="h-10 w-10 object-contain" />
                                        <div>
                                            <p className="font-space font-bold" style={{ color: TEXT }}>RACE Network</p>
                                            <p className="text-xs text-slate-500">AI · Blockchain · Web3</p>
                                        </div>
                                    </div>
                                    <p className="mt-4 max-w-xs text-sm text-slate-500">Cinematic-grade digital infrastructure for the next generation.</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: GOLD }}>Links</p>
                                    <ul className="mt-4 space-y-2">
                                        {FOOTER_LINKS.map((l) => (
                                            <li key={l.href}>
                                                <a href={l.href} className="text-sm text-slate-400 transition hover:text-[#00E5FF]">{l.label}</a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: GOLD }}>Social</p>
                                    <ul className="mt-4 flex flex-wrap gap-2">
                                        {SOCIAL.map((s) => (
                                            <li key={s.label}>
                                                <a
                                                    href={s.href}
                                                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#00BFFF]/25 bg-white/[0.03] text-xs font-bold transition hover:border-[#FFC72C]/50 hover:text-[#FFC72C]"
                                                    style={{ color: ELECTRIC }}
                                                >
                                                    {s.label.slice(0, 2)}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: GOLD }}>Network</p>
                                    <p className="mt-4 text-sm text-slate-400">BNB Smart Chain</p>
                                    <p className="mt-1 text-xs text-slate-600">© {new Date().getFullYear()} RACE Network</p>
                                </div>
                            </div>
                        </GlassCard>
                    </div>
                </footer>
            </div>
        </>
    );
}
