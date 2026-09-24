import { useEffect, useRef, useState } from 'react';

const WEI = 10n ** 18n;
const TOTAL_ALLOCATION_WEI = 600_000n * WEI;

/** Whole-token display with thousands separators; ICO numbers stay far below Number.MAX_SAFE_INTEGER. */
function formatRace(wei, fraction = 0) {
    const value = BigInt(wei ?? 0);
    const scaled = Number((value * 100n) / WEI) / 100;
    return scaled.toLocaleString(undefined, { minimumFractionDigits: fraction, maximumFractionDigits: 2 });
}

function formatPrice(wei) {
    const value = BigInt(wei ?? 0);
    const scaled = Number((value * 10000n) / WEI) / 10000;
    return scaled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function percentOf(part, whole) {
    const w = BigInt(whole ?? 0);
    if (w === 0n) return 0;
    const bps = (BigInt(part ?? 0) * 10000n) / w;
    return Math.min(100, Number(bps) / 100);
}

/**
 * Phase status straight from RaceICO.getPhase / getCurrentPhase / icoCompleted.
 * `awaiting` = previous phase sold out on-chain but this phase has not been started on-chain yet.
 */
export function phaseStatus(phase, id, phases, currentPhaseId, icoCompleted) {
    if (!phase) return 'loading';
    if (phase.completed) return 'completed';
    if (phase.started && currentPhaseId === id) return 'active';
    if (icoCompleted) return 'locked';
    const prev = phases.find((p) => p.id === id - 1);
    const prevDone = id === 1 || Boolean(prev?.completed);
    if (!phase.started && prevDone) return 'awaiting';
    return 'locked';
}

const STATUS_BADGE = {
    active: { label: 'Active', className: 'bg-brand/15 text-brand ring-1 ring-brand/40' },
    completed: { label: 'Completed', className: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/40' },
    awaiting: { label: 'Opening', className: 'bg-amber-500/10 text-amber-200 ring-1 ring-amber-300/30' },
    locked: { label: 'Locked', className: 'bg-white/5 text-slate-400 ring-1 ring-white/10' },
    loading: { label: '…', className: 'bg-white/5 text-slate-400 ring-1 ring-white/10' },
};

function LockIcon({ open = false, className = '' }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
            <rect x="4" y="11" width="16" height="10" rx="2.5" />
            {open ? <path d="M8 11V7a4 4 0 0 1 7.6-1.7" strokeLinecap="round" /> : <path d="M8 11V7a4 4 0 0 1 8 0v4" />}
        </svg>
    );
}

function CheckIcon({ className = '' }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className} aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function StatusIcon({ status }) {
    if (status === 'completed') {
        return (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 animate-ico-pop">
                <CheckIcon className="h-5 w-5" />
            </span>
        );
    }
    if (status === 'active') {
        return (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-brand animate-ico-pop">
                <LockIcon open className="h-5 w-5" />
            </span>
        );
    }
    return (
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-400">
            <LockIcon className="h-5 w-5" />
        </span>
    );
}

function ProgressBar({ percent, tone }) {
    const fill =
        tone === 'completed'
            ? 'bg-gradient-to-r from-emerald-500 to-emerald-300'
            : 'bg-gradient-to-r from-brand-dark via-brand to-brand-glow';
    return (
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
                className={`h-full rounded-full ${fill} transition-[width] duration-700 ease-out`}
                style={{ width: `${percent}%` }}
            />
        </div>
    );
}

function Connector({ done, active }) {
    const tone = done ? 'bg-emerald-400' : active ? 'bg-brand/60' : 'bg-white/10';
    return (
        <div className="flex items-center justify-center md:px-1" aria-hidden>
            <div className={`h-6 w-0.5 rounded-full transition-colors duration-500 md:h-0.5 md:w-6 lg:w-10 ${tone}`} />
        </div>
    );
}

function PhaseCard({ id, phase, status, onBuy, canBuyNow }) {
    const sold = phase?.sold ?? 0n;
    const allocation = phase?.allocation ?? 200_000n * WEI;
    const remaining = phase?.remaining ?? allocation - sold;
    const pct = percentOf(sold, allocation);
    const dim = status === 'locked' || status === 'awaiting';
    const unlockAt = formatRace(allocation * BigInt(id - 1));

    const shell = {
        active: 'border-brand/50 bg-gradient-to-b from-brand/[0.09] to-white/[0.02] shadow-[0_0_36px_rgba(245,184,0,0.14)]',
        completed: 'border-emerald-400/30 bg-gradient-to-b from-emerald-500/[0.07] to-white/[0.02]',
        awaiting: 'border-amber-300/20 bg-white/[0.03]',
        locked: 'border-white/10 bg-white/[0.02]',
        loading: 'border-white/10 bg-white/[0.02]',
    }[status];

    return (
        <article
            className={`relative flex min-w-0 flex-1 flex-col rounded-2xl border p-4 transition-all duration-500 sm:p-5 ${shell} ${
                dim ? 'opacity-70 saturate-50' : 'opacity-100'
            }`}
        >
            <div className={`flex flex-1 flex-col ${dim ? 'blur-[0.6px]' : ''} transition-[filter] duration-500`}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <StatusIcon key={status} status={status} />
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.14em] text-white">Phase {id}</p>
                            <p className="text-xs text-slate-400">200,000 RACE allocation</p>
                        </div>
                    </div>
                    <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_BADGE[status].className}`}
                    >
                        {STATUS_BADGE[status].label}
                    </span>
                </div>

                <p className="mt-4 text-2xl font-bold text-white sm:text-[1.7rem]">
                    ${phase ? formatPrice(phase.priceUsdt) : '—'}
                    <span className="ml-1 text-sm font-medium text-slate-400">/ RACE</span>
                </p>

                {status === 'active' || status === 'completed' ? (
                    <div className="mt-4 space-y-2">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="font-semibold text-white">
                                {formatRace(sold)} <span className="text-slate-400">/ {formatRace(allocation)} sold</span>
                            </span>
                            <span className={`font-mono font-bold ${status === 'completed' ? 'text-emerald-300' : 'text-brand'}`}>
                                {pct.toFixed(2)}%
                            </span>
                        </div>
                        <ProgressBar percent={pct} tone={status} />
                        <p className="text-sm text-slate-400">
                            Remaining: <span className="font-semibold text-slate-200">{formatRace(remaining)} RACE</span>
                        </p>
                    </div>
                ) : (
                    <div className="mt-4 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5 text-sm text-slate-300">
                        {status === 'awaiting'
                            ? id === 1
                                ? 'Opens when the ICO is started on-chain.'
                                : `Phase ${id - 1} sold out — opens once Phase ${id} is started on-chain.`
                            : `Unlocks after ${unlockAt} RACE sold`}
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={status === 'active' ? onBuy : undefined}
                disabled={status !== 'active' || !canBuyNow}
                className={`mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                    status === 'active'
                        ? 'bg-brand text-slate-950 hover:bg-brand-glow disabled:cursor-not-allowed disabled:opacity-60'
                        : 'cursor-not-allowed bg-white/5 text-slate-500'
                }`}
            >
                {status === 'active'
                    ? `Buy in Phase ${id}`
                    : status === 'completed'
                      ? 'Sold out'
                      : status === 'awaiting'
                        ? 'Opening soon'
                        : 'Locked'}
            </button>
        </article>
    );
}

/**
 * Read-only ICO phase view. All state comes from RaceICO reads passed in by the page.
 */
export default function IcoPhaseProgress({
    phases = [],
    currentPhaseId = 0,
    icoCompleted = false,
    totalSold = 0n,
    loading = false,
    canBuyNow = true,
    onBuy,
}) {
    const statuses = [1, 2, 3].map((id) =>
        phaseStatus(
            phases.find((p) => p.id === id),
            id,
            phases,
            currentPhaseId,
            icoCompleted,
        ),
    );
    const overallPct = percentOf(totalSold, TOTAL_ALLOCATION_WEI);
    const awaitingIndex = statuses.indexOf('awaiting');

    const currentLabel = icoCompleted
        ? 'Complete'
        : currentPhaseId > 0
          ? `Phase ${currentPhaseId}`
          : awaitingIndex >= 0
            ? `Phase ${awaitingIndex + 1} opening`
            : phases.length
              ? 'Not started'
              : '—';

    const statusKey = statuses.join('|');
    const prevStatusKey = useRef(statusKey);
    const [flash, setFlash] = useState(false);
    useEffect(() => {
        const changed = prevStatusKey.current !== statusKey;
        const wasLoading = prevStatusKey.current.includes('loading');
        prevStatusKey.current = statusKey;
        if (!changed || wasLoading || statusKey.includes('loading')) return undefined;
        setFlash(true);
        const t = setTimeout(() => setFlash(false), 900);
        return () => clearTimeout(t);
    }, [statusKey]);

    return (
        <section className="mt-6 space-y-4">
            <div
                className={`rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.01] p-4 transition-shadow duration-700 sm:p-5 ${
                    flash ? 'shadow-[0_0_40px_rgba(245,184,0,0.25)]' : ''
                }`}
            >
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">ICO progress</p>
                        <p className="mt-1 text-sm text-slate-400">600,000 RACE total · 3 phases × 200,000</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Current phase</p>
                        <p
                            className={`mt-0.5 text-lg font-bold uppercase ${
                                icoCompleted ? 'text-emerald-300' : currentPhaseId ? 'text-brand' : 'text-slate-200'
                            }`}
                        >
                            {icoCompleted ? (
                                <span className="inline-flex items-center gap-1.5">
                                    ICO complete <CheckIcon className="h-5 w-5" />
                                </span>
                            ) : (
                                currentLabel
                            )}
                        </p>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-base font-semibold text-white sm:text-lg">
                        {formatRace(totalSold)} <span className="text-slate-400">/ 600,000 RACE sold</span>
                    </p>
                    <p className="font-mono text-base font-bold text-brand">{overallPct.toFixed(2)}%</p>
                </div>
                <div className="mt-2">
                    <ProgressBar percent={overallPct} tone={icoCompleted ? 'completed' : 'active'} />
                </div>
                <div className="mt-2 grid grid-cols-3 text-[11px] text-slate-500">
                    <span>0</span>
                    <span className="text-center">200k · 400k</span>
                    <span className="text-right">600k</span>
                </div>
                {loading ? <p className="mt-2 text-xs text-slate-500">Refreshing on-chain state…</p> : null}
            </div>

            <div className="flex flex-col md:flex-row md:items-stretch">
                {[1, 2, 3].map((id, i) => (
                    <div key={id} className="contents">
                        <PhaseCard
                            id={id}
                            phase={phases.find((p) => p.id === id)}
                            status={statuses[i]}
                            onBuy={onBuy}
                            canBuyNow={canBuyNow}
                        />
                        {id < 3 ? (
                            <Connector done={statuses[i] === 'completed'} active={statuses[i] === 'active'} />
                        ) : null}
                    </div>
                ))}
            </div>

            <p className="text-xs text-slate-500">
                Phase state is read live from the RaceICO contract. A phase opens only when the previous phase&apos;s
                200,000 RACE allocation is sold on-chain.
            </p>
        </section>
    );
}
