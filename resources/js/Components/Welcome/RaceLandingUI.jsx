import { RACE_LOGO_SRC } from '@/lib/brandAssets';
import { motion, useReducedMotion } from 'framer-motion';
import { useId } from 'react';

export const GLASS =
    'relative overflow-hidden rounded-2xl border border-white/15 bg-[#0F172A]/55 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.45),0_0_32px_rgba(37,99,235,0.06)] backdrop-blur-xl';

export const BTN_PRIMARY =
    'inline-flex w-full sm:w-auto items-center justify-center rounded-[14px] bg-gradient-to-r from-[#2563EB] to-[#38BDF8] px-5 py-3 font-poppins text-sm font-bold text-white shadow-[0_8px_28px_-8px_rgba(37,99,235,0.5)] transition hover:brightness-110';

export const BTN_GOLD =
    'inline-flex w-full sm:w-auto items-center justify-center rounded-[14px] border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-5 py-3 font-poppins text-sm font-bold text-[#FCD34D] shadow-[0_8px_28px_-8px_rgba(245,158,11,0.25)] transition hover:bg-[#F59E0B]/20';

export const BTN_GHOST =
    'inline-flex w-full sm:w-auto items-center justify-center rounded-[14px] border border-white/15 bg-[#0F172A]/50 px-5 py-3 font-poppins text-sm font-bold text-sky-300 transition hover:border-sky-400/35 hover:bg-[#0F172A]/70';

export function SectionTitle({ eyebrow, title, subtitle, center = false, className = '' }) {
    const align = center
        ? 'mx-auto max-w-3xl text-center'
        : 'max-w-3xl max-lg:mx-auto max-lg:text-center lg:text-left';

    return (
        <div className={`${align} ${className}`}>
            {eyebrow ? (
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#F59E0B]">{eyebrow}</p>
            ) : null}
            <h2 className="font-poppins mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl">{title}</h2>
            {subtitle ? (
                <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:mt-4 sm:text-base">{subtitle}</p>
            ) : null}
        </div>
    );
}

export function GlassCard({ children, className = '', hover = true }) {
    return (
        <div
            className={`${GLASS} p-4 sm:p-6 ${hover ? 'transition duration-300 hover:-translate-y-1 hover:border-sky-400/25 hover:shadow-[0_16px_48px_-12px_rgba(37,99,235,0.2)] motion-reduce:transform-none' : ''} ${className}`}
        >
            <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#2563EB]/10 blur-2xl" aria-hidden />
            <div className="relative">{children}</div>
        </div>
    );
}

const SHOWCASE_FRAMES = {
    hero: 'race-welcome-showcase--banner',
    card: 'race-welcome-showcase--banner',
    wide: 'race-welcome-showcase--banner',
};

export function WelcomeShowcaseImage({
    src,
    alt,
    frame = 'card',
    className = '',
    priority = false,
    fullBleedMobile = false,
}) {
    const bleed = fullBleedMobile ? 'race-welcome-showcase--bleed' : '';

    return (
        <div
            className={`race-welcome-showcase group relative mx-auto w-full max-w-full overflow-hidden rounded-2xl border border-white/15 bg-[#0B0B0B]/60 shadow-[0_16px_48px_-14px_rgba(0,0,0,0.65),0_0_40px_-12px_rgba(37,99,235,0.2)] sm:rounded-3xl ${SHOWCASE_FRAMES[frame] ?? ''} ${bleed} ${className}`}
        >
            <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#2563EB]/12 via-transparent to-[#F59E0B]/10 max-sm:hidden"
                aria-hidden
            />
            <div className="pointer-events-none absolute -right-8 -top-8 hidden h-32 w-32 rounded-full bg-[#38BDF8]/15 blur-3xl sm:block" aria-hidden />
            <div className="pointer-events-none absolute -bottom-10 -left-8 hidden h-28 w-28 rounded-full bg-[#F59E0B]/10 blur-3xl sm:block" aria-hidden />
            <div
                className="pointer-events-none absolute inset-x-6 top-0 z-[2] hidden h-px bg-gradient-to-r from-transparent via-sky-400/30 to-transparent sm:block"
                aria-hidden
            />
            <img
                src={src}
                alt={alt}
                loading={priority ? 'eager' : 'lazy'}
                decoding="async"
                className="relative z-[1] block h-auto w-full object-contain object-center"
            />
        </div>
    );
}

export function HeroCoinVisual() {
    const uid = useId().replace(/:/g, '');
    const reduce = useReducedMotion();

    return (
        <div className="relative mx-auto aspect-square w-full max-w-[min(100%,240px)] sm:max-w-[320px] lg:max-w-[400px]">
            <div
                className="pointer-events-none absolute inset-0 rounded-full opacity-80 blur-3xl"
                style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.35), rgba(245,158,11,0.08), transparent 70%)' }}
                aria-hidden
            />
            <motion.div
                className="relative z-[1] h-full w-full"
                animate={reduce ? undefined : { rotate: 360 }}
                transition={{ duration: 28, ease: 'linear', repeat: Infinity }}
            >
                <svg viewBox="0 0 400 400" className="h-full w-full drop-shadow-[0_0_40px_rgba(56,189,248,0.35)]" aria-hidden>
                    <defs>
                        <linearGradient id={`${uid}-coin`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#2563EB" />
                            <stop offset="50%" stopColor="#38BDF8" />
                            <stop offset="100%" stopColor="#F59E0B" />
                        </linearGradient>
                    </defs>
                    <circle cx="200" cy="200" r="155" fill={`url(#${uid}-coin)`} opacity="0.9" />
                    <circle cx="200" cy="200" r="155" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
                    <circle cx="200" cy="200" r="130" fill="none" stroke="rgba(245,158,11,0.35)" strokeWidth="1" strokeDasharray="8 6" />
                    {[0, 60, 120, 180, 240, 300].map((deg) => (
                        <line
                            key={deg}
                            x1="200"
                            y1="200"
                            x2={200 + 140 * Math.cos((deg * Math.PI) / 180)}
                            y2={200 + 140 * Math.sin((deg * Math.PI) / 180)}
                            stroke="rgba(56,189,248,0.35)"
                            strokeWidth="1"
                        />
                    ))}
                </svg>
            </motion.div>
            <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center">
                <motion.div
                    className="flex h-28 w-28 items-center justify-center rounded-2xl border border-white/20 bg-[#0F172A]/80 p-3 shadow-[0_0_32px_rgba(245,158,11,0.25)] backdrop-blur-md sm:h-32 sm:w-32 sm:p-3.5"
                    animate={reduce ? undefined : { scale: [1, 1.04, 1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                    <img src={RACE_LOGO_SRC} alt="" className="h-full w-full object-contain object-center" />
                </motion.div>
            </div>
        </div>
    );
}

export function TokenomicsChart({ items }) {
    const total = items.reduce((s, i) => s + i.pct, 0);
    let offset = 0;
    const segments = items.map((item) => {
        const start = offset;
        offset += (item.pct / total) * 100;
        return { ...item, start, end: offset };
    });

    return (
        <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start">
            <div className="relative h-52 w-52 shrink-0 sm:h-60 sm:w-60">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    {segments.map((seg) => {
                        const circumference = 2 * Math.PI * 38;
                        const dash = ((seg.end - seg.start) / 100) * circumference;
                        const gap = circumference - dash;
                        const rotate = (seg.start / 100) * 360;
                        return (
                            <circle
                                key={seg.label}
                                cx="50"
                                cy="50"
                                r="38"
                                fill="none"
                                stroke={seg.color}
                                strokeWidth="14"
                                strokeDasharray={`${dash} ${gap}`}
                                transform={`rotate(${rotate} 50 50)`}
                                className="transition-opacity hover:opacity-100 opacity-90"
                            />
                        );
                    })}
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</span>
                    <span className="font-poppins text-2xl font-extrabold text-white">50M</span>
                    <span className="text-xs text-[#F59E0B]">RACE</span>
                </div>
            </div>
            <div className="w-full min-w-0 flex-1 space-y-3">
                {items.map((item) => (
                    <div key={item.label} className="group min-w-0">
                        <div className="mb-1 flex flex-col gap-1 min-[400px]:flex-row min-[400px]:items-center min-[400px]:justify-between sm:flex-row sm:items-center sm:justify-between">
                            <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-200 sm:text-sm">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                                <span className="truncate">{item.label}</span>
                            </span>
                            <span className="shrink-0 font-mono text-[11px] text-slate-400 sm:text-sm">
                                {item.pct}% · {item.amount}
                            </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                            <div
                                className="h-full rounded-full transition-all group-hover:brightness-125"
                                style={{ width: `${item.pct}%`, background: item.color }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function FlowSteps({ steps, className = '' }) {
    return (
        <div className={`flex w-full flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-3 ${className}`}>
            {steps.map((step, i) => (
                <div key={step} className="flex w-full flex-col items-center gap-1 sm:w-auto sm:flex-row sm:gap-3">
                    <div className="w-full rounded-xl border border-white/10 bg-[#0F172A]/60 px-4 py-2.5 text-center text-xs font-semibold text-slate-200 shadow-inner sm:w-auto sm:text-sm">
                        {step}
                    </div>
                    {i < steps.length - 1 ? (
                        <span className="hidden text-sky-500 sm:inline" aria-hidden>
                            →
                        </span>
                    ) : null}
                    {i < steps.length - 1 ? (
                        <span className="text-sky-500 sm:hidden" aria-hidden>
                            ↓
                        </span>
                    ) : null}
                </div>
            ))}
        </div>
    );
}

export function RoadmapTimeline({ phases }) {
    return (
        <div className="relative pl-6 sm:pl-8 lg:pl-0">
            <div
                className="pointer-events-none absolute left-2 top-0 h-full w-px bg-gradient-to-b from-[#2563EB] via-[#F59E0B] to-transparent sm:left-3 lg:left-1/2"
                aria-hidden
            />
            <div className="space-y-5 sm:space-y-6 lg:space-y-8">
                {phases.map((phase, i) => (
                    <div
                        key={phase.phase}
                        className={`relative flex flex-col gap-4 lg:flex-row ${i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'}`}
                    >
                        <div className="pointer-events-none absolute -left-6 top-6 h-2.5 w-2.5 rounded-full border-2 border-[#F59E0B] bg-[#0B0B0B] sm:-left-8 sm:top-7 lg:hidden" aria-hidden />
                        <div className="hidden lg:block lg:w-1/2" />
                        <div className="min-w-0 lg:w-1/2">
                            <GlassCard>
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F59E0B]">{phase.phase}</p>
                                <h3 className="font-poppins mt-2 text-lg font-bold text-white">{phase.title}</h3>
                                <ul className="mt-3 space-y-1.5 text-sm text-slate-400">
                                    {phase.items.map((item) => (
                                        <li key={item} className="flex items-start gap-2">
                                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sky-400" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </GlassCard>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function TreasuryVault() {
    const branches = ['Development', 'Security', 'Growth', 'Partnerships', 'Infrastructure'];
    return (
        <div className="relative mx-auto flex max-w-lg flex-col items-center py-8">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-2xl border border-[#F59E0B]/30 bg-gradient-to-br from-[#2563EB]/20 to-[#F59E0B]/10 shadow-[0_0_48px_rgba(245,158,11,0.15)]">
                <span className="text-3xl" aria-hidden>
                    🏦
                </span>
                <p className="absolute -bottom-8 max-w-[7rem] text-center text-[10px] font-bold uppercase leading-tight tracking-wider text-[#FCD34D] sm:max-w-none sm:whitespace-nowrap sm:text-xs">
                    Treasury Core
                </p>
            </div>
            <div className="mt-14 grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
                {branches.map((b) => (
                    <div
                        key={b}
                        className="rounded-xl border border-white/10 bg-[#0F172A]/50 px-3 py-2.5 text-center text-[11px] font-semibold text-slate-300 sm:text-xs"
                    >
                        {b}
                    </div>
                ))}
            </div>
        </div>
    );
}
