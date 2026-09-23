/** Inline SVG icons for the RACE token utility page — matches existing member portal style. */

function IconWrap({ children, className = 'h-10 w-10' }) {
    return (
        <div
            className={`flex shrink-0 items-center justify-center rounded-xl border border-sky-500/25 bg-slate-900/50 text-sky-300 ${className}`}
        >
            {children}
        </div>
    );
}

export function EcosystemFeatureCard({ icon: Icon, title, description, children, className = '' }) {
    return (
        <div
            className={`flex min-h-[9.5rem] flex-col rounded-xl border border-sky-500/20 bg-slate-900/45 p-3 sm:p-4 ${className}`}
        >
            <div className="flex items-start gap-3">
                <Icon className="h-10 w-10 shrink-0" />
                <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-white">{title}</h4>
                    {description ? <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{description}</p> : null}
                </div>
            </div>
            {children ? <div className="mt-3 space-y-1 border-t border-sky-500/10 pt-3 text-xs">{children}</div> : null}
        </div>
    );
}

export function FeatureDataRow({ label, value, mono = false, href = null }) {
    const content = (
        <span className={`font-semibold text-slate-100 ${mono ? 'break-all font-mono text-[10px]' : ''}`}>
            {value}
        </span>
    );

    return (
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
            {href ? (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-300 underline hover:text-sky-200"
                >
                    {content}
                </a>
            ) : (
                content
            )}
        </div>
    );
}

export function IconRaceToken({ className }) {
    return (
        <IconWrap className={className}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </svg>
        </IconWrap>
    );
}

export function IconBsc({ className }) {
    return (
        <IconWrap className={className}>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L6.5 5.5v7L12 16l5.5-3.5v-7L12 2zm0 2.2l3.3 2.1v4.2L12 12.6 8.7 10.5V6.3L12 4.2zM4 8.5v7L9.5 19v-7L4 8.5zm16 0v7L14.5 19v-7l5.5-3.5z" />
            </svg>
        </IconWrap>
    );
}

export function IconUsdt({ className }) {
    return (
        <IconWrap className={className}>
            <span className="text-xs font-bold tracking-tight">USDT</span>
        </IconWrap>
    );
}

export function IconMetaMask({ className }) {
    return (
        <IconWrap className={className}>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.5 4L13 12.2l1.5-3.6L20.5 4zM3.5 4l6 4.6L11 8.6 3.5 4zm7 8.4L4 6.2v11.6l3.5-2 3-1.4zm1 0l3 1.4 3.5 2V6.2L11.5 12.4zM12 14.8l-3.2 1.5L12 21l3.2-4.7L12 14.8z" />
            </svg>
        </IconWrap>
    );
}

export function IconWalletConnect({ className }) {
    return (
        <IconWrap className={className}>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </svg>
        </IconWrap>
    );
}

export function IconPancake({ className }) {
    return (
        <IconWrap className={className}>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="14" r="6" opacity="0.35" />
                <ellipse cx="12" cy="10" rx="7" ry="4" />
            </svg>
        </IconWrap>
    );
}

export function IconSwap({ className }) {
    return (
        <IconWrap className={className}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                />
            </svg>
        </IconWrap>
    );
}

export function IconStake({ className }) {
    return (
        <IconWrap className={className}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M15.75 4.969V3.375A1.125 1.125 0 0014.625 2.25h-5.25A1.125 1.125 0 008.25 3.375v1.594m7.5 0V6a2.25 2.25 0 01-2.25 2.25h-4.5A2.25 2.25 0 016 4.969V4.969"
                />
            </svg>
        </IconWrap>
    );
}

export function IconLiquidity({ className }) {
    return (
        <IconWrap className={className}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v18m6-15H9m12 6H6m15 6H3"
                />
            </svg>
        </IconWrap>
    );
}

export function IconSecureWallet({ className }) {
    return (
        <IconWrap className={className}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
            </svg>
        </IconWrap>
    );
}

export function IconOnChainRewards({ className }) {
    return (
        <IconWrap className={className}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                />
            </svg>
        </IconWrap>
    );
}
