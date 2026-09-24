import MemberIcon from '@/Components/Member/MemberIcon';
import { Link } from '@inertiajs/react';

const VARIANTS = {
    pdf: {
        border: 'border-sky-400/40',
        background:
            'linear-gradient(135deg, rgba(2,11,45,0.98) 0%, rgba(12,30,74,0.95) 45%, rgba(30,58,138,0.92) 100%)',
        kicker: 'text-sky-200/90',
        description: 'text-white/85',
        glow: 'bg-sky-400/30',
        titleClass: 'race-pdf-hero-title',
    },
    blue: {
        border: 'border-slate-200/90',
        background: 'linear-gradient(135deg, #020B2D 0%, #1e3a8a 55%, #2563EB 100%)',
        kicker: 'text-sky-200/90',
        description: 'text-white/80',
        glow: 'bg-sky-400/25',
        titleClass: '',
    },
    emerald: {
        border: 'border-emerald-200/50',
        background: 'linear-gradient(135deg, #064e3b 0%, #059669 45%, #10b981 100%)',
        kicker: 'text-emerald-100/90',
        description: 'text-white/90',
        glow: 'bg-emerald-300/20',
        titleClass: '',
    },
    violet: {
        border: 'border-violet-200/90',
        background: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 45%, #8b5cf6 100%)',
        kicker: 'text-violet-200/90',
        description: 'text-white/90',
        glow: 'bg-violet-300/25',
        titleClass: '',
    },
    sky: {
        border: 'border-sky-200/80',
        background: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 42%, #2563EB 100%)',
        kicker: 'text-sky-100/90',
        description: 'text-white/85',
        glow: 'bg-sky-300/30',
        titleClass: '',
    },
};

export function MemberHeroLink({ href, children, ...props }) {
    return (
        <Link
            href={href}
            className="inline-flex items-center rounded-lg border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/25"
            {...props}
        >
            {children}
        </Link>
    );
}

export default function MemberPageHero({
    kicker,
    title,
    subtitle = null,
    children,
    actions = null,
    variant = 'pdf',
    icon = null,
    logoSrc = null,
    className = '',
}) {
    const v = VARIANTS[variant] ?? VARIANTS.sky;
    const description = children || subtitle;

    return (
        <div
            className={`member-page-hero member-page-hero--pdf overflow-hidden rounded-2xl border shadow-sm ${v.border} ${className}`}
            style={{ background: v.background }}
        >
            <div className="relative px-4 py-5 sm:px-8 sm:py-8">
                <div
                    className={`pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full blur-3xl ${v.glow}`}
                    aria-hidden
                />
                {kicker || title ? (
                    <div className="flex items-start gap-3 sm:gap-4">
                        {icon ? (
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/30 bg-white/15 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25)] backdrop-blur-sm sm:h-14 sm:w-14 sm:rounded-[18px]">
                                <MemberIcon name={icon} className="h-6 w-6 text-white sm:h-7 sm:w-7" />
                            </span>
                        ) : logoSrc ? (
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/30 bg-white/15 sm:h-14 sm:w-14">
                                <img src={logoSrc} alt="" className="h-8 w-8 object-contain sm:h-9 sm:w-9" />
                            </span>
                        ) : null}
                        <div className="min-w-0 flex-1">
                            {kicker ? (
                                <p
                                    className={`text-[0.65rem] font-bold uppercase tracking-[0.2em] sm:text-xs ${v.kicker}`}
                                >
                                    {kicker}
                                </p>
                            ) : null}
                            {title ? (
                                <h1
                                    className={`mt-1 break-words font-poppins text-xl font-bold tracking-tight sm:text-2xl md:text-3xl ${
                                        v.titleClass || 'text-white'
                                    }`}
                                >
                                    {title}
                                </h1>
                            ) : null}
                        </div>
                    </div>
                ) : null}
                {description ? (
                    <div className={`mt-2 max-w-2xl text-sm leading-relaxed ${v.description}`}>
                        {description}
                    </div>
                ) : null}
                {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
            </div>
        </div>
    );
}
