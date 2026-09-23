import MemberIcon, { iconForIncomeKey } from '@/Components/Member/MemberIcon';
import { motion } from 'framer-motion';
import { Link, usePage } from '@inertiajs/react';
import { useMemo } from 'react';

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

const SECTION_ACCENTS = [
    'from-blue-500/10 to-sky-400/5 border-sky-200/80',
    'from-violet-500/10 to-purple-400/5 border-violet-200/80',
    'from-emerald-500/10 to-teal-400/5 border-emerald-200/80',
    'from-amber-500/10 to-orange-400/5 border-amber-200/80',
    'from-rose-500/10 to-pink-400/5 border-rose-200/80',
    'from-cyan-500/10 to-sky-400/5 border-cyan-200/80',
    'from-indigo-500/10 to-blue-400/5 border-indigo-200/80',
    'from-lime-500/10 to-green-400/5 border-lime-200/80',
    'from-fuchsia-500/10 to-purple-400/5 border-fuchsia-200/80',
    'from-slate-500/10 to-slate-400/5 border-slate-200/80',
];

function LeadershipSnapshot({ snapshot }) {
    return null;
}

function IncomeTypeSection({ row, payouts, index, hubRow, totalSections, animate = true }) {
    const accent = SECTION_ACCENTS[index % SECTION_ACCENTS.length];
    const recent = payouts.slice(0, 5);
    const motionProps = animate
        ? { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay: index * 0.05 } }
        : {};

    return (
        <motion.section
            {...motionProps}
            className={`relative overflow-hidden rounded-[1.25rem] border bg-gradient-to-br ${accent} bg-white/80 p-4 shadow-[0_8px_32px_-12px_rgba(37,99,235,0.12)] backdrop-blur-sm sm:p-5`}
        >
            <motion.div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-sky-300/20 blur-2xl" />

            <motion.div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <motion.div className="min-w-0 flex flex-1 gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-100 bg-sky-50/90 text-[#2563EB] shadow-sm">
                        <MemberIcon name={iconForIncomeKey(row.key)} className="h-5 w-5" />
                    </span>
                    <motion.div className="min-w-0 flex-1">
                        <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[#2563EB]">
                            Section {index + 1} of {totalSections}
                        </p>
                        <h3 className="mt-1 font-poppins text-base font-extrabold leading-snug text-[#0F172A] sm:text-lg">
                            {row.label}
                        </h3>
                        {row.has_earned ? (
                            <p className="mt-1 text-xs text-slate-500">
                                {row.count} payment{row.count === 1 ? '' : 's'} received
                            </p>
                        ) : (
                            <p className="mt-1 text-xs text-slate-400">No earnings yet — credits appear here when paid</p>
                        )}
                        {hubRow?.trigger && row.key !== 'community_leadership' ? (
                            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{hubRow.trigger}</p>
                        ) : null}
                        <LeadershipSnapshot snapshot={hubRow?.leadership_snapshot} />
                    </motion.div>
                </motion.div>
                <motion.div className="shrink-0 rounded-xl border border-white/90 bg-white/90 px-4 py-2.5 text-right shadow-sm">
                    <p className="text-[0.6rem] font-bold uppercase tracking-wider text-slate-500">Total</p>
                    <p
                        className={`font-mono text-xl font-bold sm:text-2xl ${
                            row.has_earned ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                    >
                        {formatUsd(row.amount_usd)}
                    </p>
                </motion.div>
            </motion.div>

            {recent.length > 0 ? (
                <motion.div className="relative mt-4 border-t border-white/80 pt-4">
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Recent credits</p>
                    <ul className="mt-2 space-y-2">
                        {recent.map((p) => {
                            const dateStr = p.created_at
                                ? new Date(p.created_at).toLocaleString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                  })
                                : '—';
                            return (
                                <li
                                    key={p.id}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-sky-100/60 bg-white/70 px-3 py-2"
                                >
                                    <span className="text-xs text-slate-500">{dateStr}</span>
                                    <span className="font-mono text-sm font-bold text-emerald-600">
                                        +{formatUsd(p.amount_usd)}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                    {payouts.length > 5 ? (
                        <p className="mt-2 text-center text-[0.65rem] text-slate-400">
                            +{payouts.length - 5} more in this category
                        </p>
                    ) : null}
                </motion.div>
            ) : null}

            {hubRow?.href ? (
                <motion.div className="relative mt-4 flex flex-wrap gap-3 border-t border-white/80 pt-3 text-xs font-semibold">
                    <Link href={hubRow.href} className="text-[#2563EB] hover:underline">
                        Program details →
                    </Link>
                    <Link href={hubRow.ledger_href} className="text-slate-600 hover:underline">
                        View ledger →
                    </Link>
                </motion.div>
            ) : null}
        </motion.section>
    );
}

export default function PlanIncomeSection({ planIncome = [], totalIncomeUsd = '0.00', incomeEntries = [], children = null, animate = true }) {
    const { incomeHub } = usePage().props;
    const rows = planIncome?.length ? planIncome : incomeHub?.programs ?? [];
    const total = totalIncomeUsd || incomeHub?.total_income_usd || '0.00';
    const earnedCount = rows.filter((r) => r.has_earned).length;

    const payoutsByLabel = useMemo(() => {
        const map = {};
        (incomeEntries ?? []).forEach((p) => {
            const label = p.income_name ?? p.entry_type ?? 'Other';
            if (!map[label]) map[label] = [];
            map[label].push(p);
        });
        return map;
    }, [incomeEntries]);

    return (
        <motion.div className="space-y-5 sm:space-y-6">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-[1.25rem] border border-sky-200/80 bg-gradient-to-r from-[#2563EB] via-[#1d4ed8] to-[#38BDF8] p-5 shadow-[0_16px_48px_-12px_rgba(37,99,235,0.45)] sm:p-6"
            >
                <motion.div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <motion.div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/85">RACE NETWORK · Live</p>
                        <h2 className="mt-1 font-poppins text-xl font-extrabold text-white sm:text-2xl">Your rewards</h2>
                        <p className="mt-1 text-xs text-white/90 sm:text-sm">
                            {earnedCount} of {rows.length} programs earning · each section below is one reward type
                        </p>
                    </motion.div>
                    <motion.div className="rounded-2xl bg-white/15 px-5 py-3 backdrop-blur-sm">
                        <p className="text-[0.65rem] font-bold uppercase tracking-wider text-white/80">Total received</p>
                        <p className="font-mono text-2xl font-bold text-white sm:text-3xl">{formatUsd(total)}</p>
                    </motion.div>
                </motion.div>
            </motion.div>

            <motion.div className="grid grid-cols-1 gap-4 sm:gap-5">
                {rows.map((row, i) => {
                    const hubRow = incomeHub?.programs?.find((p) => p.key === row.key) ?? row;
                    return (
                        <IncomeTypeSection
                            key={row.key}
                            row={row}
                            hubRow={hubRow}
                            payouts={payoutsByLabel[row.label] ?? []}
                            index={i}
                            totalSections={rows.length}
                            animate={animate}
                        />
                    );
                })}
            </motion.div>

            {children}
        </motion.div>
    );
}
