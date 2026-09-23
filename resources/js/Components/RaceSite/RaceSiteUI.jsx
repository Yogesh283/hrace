import { RACE_LOGO_SRC, RACE_SPLASH_LOGO_SRC, RACE_NETWORK_HERO_BANNER } from '@/lib/brandAssets';
import { FOOTER, SITE_NAV } from '@/data/raceSiteContent';
import { motion, useInView, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

export const COLORS = {
    bg: '#0B0F19',
    surface: '#121A2F',
    card: '#121A2F',
    glow: '#3B82F6',
    electric: '#3B82F6',
    blue: '#3B82F6',
    gold: '#D4AF37',
    goldDark: '#B8962E',
    text: '#FFFFFF',
    muted: '#9CA3AF',
};

export const fadeUp = {
    hidden: { opacity: 0, y: 36 },
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.7, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] },
    }),
};

const ICON_PATHS = {
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

export function RaceIcon({ name, className = 'h-5 w-5' }) {
    const d = ICON_PATHS[name];
    if (!d) return null;
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            {d.split(' M').map((seg, i) => (
                <path key={i} strokeLinecap="round" strokeLinejoin="round" d={i === 0 ? seg : `M${seg}`} />
            ))}
        </svg>
    );
}

export function RaceBackground({ reduce }) {
    const particles = Array.from({ length: 60 }, (_, i) => ({
        id: i,
        left: `${(i * 19 + 2) % 100}%`,
        top: `${(i * 27 + 5) % 100}%`,
        size: 1 + (i % 3),
        delay: (i % 10) * 0.3,
        gold: i % 6 === 0,
    }));

    return (
        <div className="rx-site-bg" aria-hidden>
            <div className="rx-site-bg__noise" />
            <div className="rx-site-bg__grid" />
            <div className="rx-site-bg__circuit" />
            <div className="rx-site-bg__fog" />
            <div className="rx-site-bg__beam rx-site-bg__beam--1" />
            <div className="rx-site-bg__beam rx-site-bg__beam--2" />
            <div className="rx-site-bg__beam rx-site-bg__beam--3" />
            <svg className="rx-site-skyline" viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice">
                <path fill="#071827" d="M0,320 L0,220 L60,200 L100,240 L150,190 L200,250 L260,180 L320,230 L380,170 L440,220 L500,160 L560,210 L620,150 L680,200 L740,140 L800,190 L860,130 L920,180 L980,120 L1040,170 L1100,110 L1160,160 L1220,100 L1280,150 L1340,90 L1400,140 L1440,120 L1440,320 Z" opacity="0.9" />
                {Array.from({ length: 40 }, (_, i) => (
                    <circle key={i} cx={40 + i * 35} cy={200 - (i % 3) * 5} r="1.5" fill={i % 5 === 0 ? COLORS.gold : COLORS.electric} opacity={0.15 + (i % 4) * 0.05} />
                ))}
            </svg>
            {particles.map((p) => (
                <motion.span
                    key={p.id}
                    className="absolute rounded-full"
                    style={{ left: p.left, top: p.top, width: p.size, height: p.size, backgroundColor: p.gold ? COLORS.gold : COLORS.electric }}
                    animate={reduce ? undefined : { opacity: [0.06, 0.7, 0.06], y: [0, -20, 0] }}
                    transition={{ duration: 4 + (p.id % 4), repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

export function RaceGlassCard({ children, className = '', hover = true }) {
    return (
        <div className={`rx-site-card ${hover ? 'rx-site-card--hover' : ''} ${className}`}>
            <div className="relative z-[1]">{children}</div>
        </div>
    );
}

export function RaceIcon3D({ name, size = 'h-12 w-12', className = '' }) {
    return (
        <div className={`rx-site-icon-3d ${size} ${className}`}>
            <RaceIcon name={name} className="h-5 w-5" />
        </div>
    );
}

export function RaceSectionHead({ label, title, highlight, subtitle, center = true }) {
    return (
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className={`mb-8 max-w-3xl sm:mb-12 ${center ? 'mx-auto text-center' : ''}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#D4AF37] sm:text-[11px] sm:tracking-[0.32em]">{label}</p>
            <div className={`rx-site-gold-line mt-3 sm:mt-4 ${center ? 'mx-auto max-w-[8rem] sm:max-w-xs' : 'max-w-[8rem] sm:max-w-xs'}`} />
            <h2 className="font-space mt-4 text-[1.65rem] font-bold leading-tight tracking-tight text-white sm:mt-6 sm:text-4xl lg:text-[2.75rem]">
                {title} {highlight && <span className="rx-site-text-gold">{highlight}</span>}
            </h2>
            {subtitle && <p className={`mt-4 text-sm leading-relaxed text-[#9CA3AF] sm:mt-5 sm:text-base ${center ? 'mx-auto' : ''}`}>{subtitle}</p>}
        </motion.div>
    );
}

/** Wide section banner shown above content */
export function RaceSectionBanner({ src, alt = '' }) {
    if (!src) return null;
    return (
        <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-10 overflow-hidden rounded-2xl border border-[#D4AF37]/25 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.8)]"
        >
            <div className="relative">
                <img src={src} alt={alt} className="h-[140px] w-full object-cover object-center sm:h-[180px] lg:h-[220px]" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B0F19]/75 via-transparent to-[#0B0F19]/25" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0B0F19]/45 via-transparent to-[#0B0F19]/2" />
            </div>
        </motion.div>
    );
}

/** Content block with side image (alternating) */
export function RaceContentWithImage({
    src,
    alt = '',
    reverse = false,
    children,
}) {
    if (!src) {
        return <div>{children}</div>;
    }

    return (
        <div className="grid items-center gap-6 sm:gap-8 lg:grid-cols-2 lg:gap-12">
            <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={1}
                className={`${reverse ? 'lg:order-1' : 'lg:order-2'} order-1`}
            >
                {children}
            </motion.div>
            <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className={`${reverse ? 'lg:order-2' : 'lg:order-1'} order-2`}
            >
                <div className="overflow-hidden rounded-xl border border-[#D4AF37]/30 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)] sm:rounded-2xl">
                    <img
                        src={src}
                        alt={alt}
                        className="aspect-[16/10] w-full object-cover sm:aspect-[16/11]"
                        loading="lazy"
                        decoding="async"
                    />
                </div>
            </motion.div>
        </div>
    );
}

export function RaceBtn({ children, href, onClick, variant = 'primary', className = '' }) {
    const base = variant === 'primary' ? 'rx-site-btn' : 'rx-site-btn-ghost';
    const shine = variant === 'primary' ? <span className="rx-site-btn__shine" aria-hidden /> : null;
    const arrow = <span className="ml-2 inline-block transition group-hover:translate-x-1">→</span>;
    if (href) {
        return <a href={href} className={`${base} group ${className}`}>{shine}{children}{arrow}</a>;
    }
    return <button type="button" onClick={onClick} className={`${base} group ${className}`}>{shine}{children}{arrow}</button>;
}

export function RaceCounter({ value, suffix = '' }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true });
    const mv = useMotionValue(0);
    const spring = useSpring(mv, { stiffness: 55, damping: 18 });
    const [n, setN] = useState(0);
    useEffect(() => { if (inView) mv.set(value); }, [inView, mv, value]);
    useEffect(() => { const u = spring.on('change', (v) => setN(Math.round(v))); return u; }, [spring]);
    return <span ref={ref}>{n}{suffix}</span>;
}

export function RaceNavbar({ onAuth }) {
    // onAuth kept for backward compatibility; Sign in / Register use live routes.
    void onAuth;
    const [scrolled, setScrolled] = useState(false);
    const [openMenu, setOpenMenu] = useState(null);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 20);
        fn();
        window.addEventListener('scroll', fn, { passive: true });
        return () => window.removeEventListener('scroll', fn);
    }, []);

    useEffect(() => {
        document.body.classList.toggle('rx-site-menu-open', mobileOpen);
        return () => document.body.classList.remove('rx-site-menu-open');
    }, [mobileOpen]);

    return (
        <header className={`rx-site-nav fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? 'rx-site-nav--scrolled' : ''}`}>
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6 sm:py-3.5">
                <a href="#hero" className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <motion.img
                        src={RACE_LOGO_SRC}
                        alt="RACE Network"
                        className="h-8 w-8 shrink-0 object-contain sm:h-9 sm:w-9"
                        animate={{ filter: ['drop-shadow(0 0 8px rgba(0,198,255,0.4))', 'drop-shadow(0 0 16px rgba(255,199,44,0.5))', 'drop-shadow(0 0 8px rgba(0,198,255,0.4))'] }}
                        transition={{ duration: 4, repeat: Infinity }}
                    />
                    <span className="font-space truncate text-xs font-bold text-white sm:text-sm">RACE Network</span>
                </a>

                <nav className="hidden items-center gap-1 lg:flex">
                    {SITE_NAV.map((group) => (
                        <div key={group.label} className="relative" onMouseEnter={() => setOpenMenu(group.label)} onMouseLeave={() => setOpenMenu(null)}>
                            <button type="button" className="rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#9CA3AF] transition hover:text-[#3B82F6]">
                                {group.label}
                            </button>
                            {openMenu === group.label && (
                                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rx-site-mega absolute left-0 top-full z-50 mt-1 min-w-[200px] p-3">
                                    {group.items.map((item) => (
                                        <a key={item.href} href={item.href} className="block rounded-lg px-3 py-2 text-sm text-[#9CA3AF] transition hover:bg-[#3B82F6]/10 hover:text-[#3B82F6]">
                                            {item.label}
                                        </a>
                                    ))}
                                </motion.div>
                            )}
                        </div>
                    ))}
                </nav>

                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    <a
                        href={typeof route === 'function' ? route('login') : '/login'}
                        className="rx-site-btn-ghost !px-2.5 !py-2 !text-[10px] sm:!px-3 sm:!py-2.5 sm:!text-xs"
                    >
                        Sign in
                    </a>
                    <a
                        href={typeof route === 'function' ? route('register') : '/register'}
                        className="rx-site-btn !px-3 !py-2 !text-[10px] sm:!px-4 sm:!py-2.5 sm:!text-xs md:!text-sm"
                    >
                        <span className="sm:hidden">Join</span>
                        <span className="hidden sm:inline">Register</span>
                    </a>
                    <button
                        type="button"
                        className="rounded-lg border border-[#D4AF37]/35 p-2 text-[#D4AF37] lg:hidden"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label="Menu"
                        aria-expanded={mobileOpen}
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d={mobileOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} /></svg>
                    </button>
                </div>
            </div>
            {mobileOpen && (
                <div className="rx-site-mobile-drawer border-t border-[#D4AF37]/15 bg-[#0B0F19]/98 px-4 py-3 backdrop-blur-xl lg:hidden">
                    {SITE_NAV.map((group) => (
                        <div key={group.label} className="mb-3 last:mb-0">
                            <p className="px-1 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#D4AF37]">{group.label}</p>
                            {group.items.map((item) => (
                                <a
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setMobileOpen(false)}
                                    className="block rounded-lg px-2 py-2.5 text-sm text-[#9CA3AF] active:bg-white/5 active:text-white"
                                >
                                    {item.label}
                                </a>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </header>
    );
}

export function RaceHeroVisual({ reduce }) {
    const mx = useMotionValue(0);
    const my = useMotionValue(0);
    const px = useSpring(mx, { stiffness: 65, damping: 20 });
    const py = useSpring(my, { stiffness: 65, damping: 20 });

    return (
        <motion.div
            className="relative mx-auto w-full max-w-[560px]"
            style={{ x: px, y: py }}
            onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                mx.set(((e.clientX - r.left) / r.width - 0.5) * 12);
                my.set(((e.clientY - r.top) / r.height - 0.5) * 10);
            }}
            onMouseLeave={() => { mx.set(0); my.set(0); }}
        >
            <div className="rx-site-hero-floor" />
            <div className="relative overflow-hidden rounded-[1.35rem] border border-[#D4AF37]/30 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.85),0_0_48px_-12px_rgba(212,175,55,0.35)]">
                <div className="rx-site-hero-glow !inset-[-20%]" />
                <motion.img
                    src={RACE_NETWORK_HERO_BANNER}
                    alt="RACE Network — community-owned digital economies"
                    className="relative z-[1] aspect-[16/10] w-full object-cover"
                    animate={reduce ? undefined : { scale: [1, 1.03, 1] }}
                    transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-[#0B0F19]/75 via-transparent to-[#0B0F19]/15" />
                <img
                    src={RACE_SPLASH_LOGO_SRC}
                    alt=""
                    className="absolute bottom-4 right-4 z-[3] h-12 w-12 object-contain drop-shadow-[0_0_20px_rgba(212,175,55,0.55)] sm:h-14 sm:w-14"
                />
            </div>
        </motion.div>
    );
}

export function RaceHeroBannerStrip() {
    return (
        <div className="relative mb-10 overflow-hidden rounded-2xl border border-[#D4AF37]/25 sm:mb-12">
            <img
                src={RACE_NETWORK_HERO_BANNER}
                alt="RACE Network banner"
                className="h-[160px] w-full object-cover object-center sm:h-[220px] lg:h-[280px]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0B0F19]/80 via-[#0B0F19]/25 to-transparent" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B0F19]/55 via-transparent to-[#0B0F19]/2" />
        </div>
    );
}

export function RaceFooter({ footer }) {
    return (
        <footer className="relative z-10 border-t border-[#D4AF37]/15 py-10 sm:py-14" style={{ background: '#0B0F19' }}>
            <div className="mx-auto max-w-7xl px-3 sm:px-6">
                <div className="grid gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <img src={RACE_LOGO_SRC} alt="" className="h-9 w-9 sm:h-10 sm:w-10" />
                            <div>
                                <p className="font-space font-bold text-white">{footer.brand}</p>
                                <p className="text-xs text-[#D4AF37]">{footer.powered}</p>
                            </div>
                        </div>
                        <p className="mt-4 max-w-xs text-sm text-[#9CA3AF]">{footer.tagline}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">Explore</p>
                        <ul className="mt-4 space-y-2">
                            {(footer.explore || []).map((l) => (
                                <li key={l.href + l.label}>
                                    <a href={l.href} className="text-sm text-[#9CA3AF] transition hover:text-[#D4AF37]">{l.label}</a>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">Legal</p>
                        <ul className="mt-4 space-y-2">
                            {(footer.legal || []).map((l) => (
                                <li key={l.label}>
                                    <a href={l.href} className="text-sm text-[#9CA3AF] transition hover:text-[#D4AF37]">{l.label}</a>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">Community</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {(footer.social || []).map((s) => (
                                <a
                                    key={s.label}
                                    href={s.href}
                                    className="rounded-xl border border-[#D4AF37]/35 px-3 py-2 text-xs font-semibold text-[#D4AF37] transition hover:border-[#D4AF37] hover:bg-[#D4AF37]/10"
                                >
                                    {s.label}
                                </a>
                            ))}
                        </div>
                        <p className="mt-6 text-xs text-[#9CA3AF]">{footer.copyright}</p>
                        <p className="mt-2 text-xs text-[#9CA3AF]">{footer.closing}</p>
                    </div>
                </div>
            </div>
        </footer>
    );
}

export function RacePieChart({ data, activeIndex, onHover }) {
    let cumulative = 0;
    const slices = data.map((item, i) => {
        const start = cumulative;
        cumulative += item.pct;
        return { ...item, start, end: cumulative, i };
    });
    return (
        <div className="relative mx-auto h-56 w-56 sm:h-64 sm:w-64">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                {slices.map((s) => {
                    const r = 40;
                    const a0 = (s.start / 100) * 2 * Math.PI;
                    const a1 = (s.end / 100) * 2 * Math.PI;
                    const x0 = 50 + r * Math.cos(a0);
                    const y0 = 50 + r * Math.sin(a0);
                    const x1 = 50 + r * Math.cos(a1);
                    const y1 = 50 + r * Math.sin(a1);
                    const d = `M 50 50 L ${x0} ${y0} A ${r} ${r} 0 ${s.pct > 50 ? 1 : 0} 1 ${x1} ${y1} Z`;
                    return (
                        <path key={s.label} d={d} fill={s.color} opacity={activeIndex === null || activeIndex === s.i ? 1 : 0.35} className="transition-opacity duration-300 cursor-pointer" onMouseEnter={() => onHover?.(s.i)} onMouseLeave={() => onHover?.(null)} />
                    );
                })}
                <circle cx="50" cy="50" r="22" fill="#0B1D33" />
            </svg>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
                <span className="text-xs font-bold text-white sm:text-sm">RACE<br /><span className="text-[#FFC72C]">Token</span></span>
            </div>
        </div>
    );
}
