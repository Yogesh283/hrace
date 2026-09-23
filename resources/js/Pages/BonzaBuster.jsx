import MemberPageHero, { MemberHeroLink } from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import MemberStatCard from '@/Components/Member/MemberStatCard';
import MemberTableScroll from '@/Components/Member/MemberTableScroll';
import PanelCard from '@/Components/PanelCard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

function formatUsd(value, withSign = false) {
    const n = Number(value);
    if (Number.isNaN(n)) return '—';
    const abs = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Math.abs(n));
    if (!withSign) return abs;
    if (n > 0) return `+ ${abs}`;
    if (n < 0) return `− ${abs}`;
    return abs;
}

function formatRowDate(createdAt) {
    if (!createdAt) return '—';
    return new Date(createdAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

const defaultProgram = {
    name: 'Bonanza',
    enabled: true,
    direct_percent: 3,
    earned_usd: '0.00',
    payout_count: 0,
    trigger: '',
};

function BonanzaTransactionRow({ row }) {
    return (
        <div className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {formatRowDate(row.created_at)}
                    </p>
                    <p className="mt-1 text-[13px] font-semibold leading-snug text-fintech-ink">
                        {row.detail ?? row.income_name ?? 'Bonanza payout'}
                    </p>
                    {row.level_label ? (
                        <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800">
                            {row.level_label}
                        </span>
                    ) : null}
                </div>
                <p className="shrink-0 font-mono text-sm font-bold tabular-nums text-emerald-600">
                    {formatUsd(row.amount_usd, true)}
                </p>
            </div>
        </div>
    );
}

export default function BonzaBuster({ program: programProp = {}, transactions = [] }) {
    const p = { ...defaultProgram, ...programProp };

    return (
        <AuthenticatedLayout
            pageTitle="Bonanza"
            memberSurface="race"
            showMobileFintechNav
            mobileFintechPageTitle="Bonanza"
        >
            <Head title="Bonanza" />

            <MemberPageShell contentClassName="space-y-5 sm:space-y-6">
                <MemberPageHero
                    kicker="Direct sponsor · 3% on invest"
                    title="Bonanza"
                    variant="emerald"
                    icon="bonza_buster"
                    actions={
                        <MemberHeroLink href={route('direct-team')}>Direct Team →</MemberHeroLink>
                    }
                >
                    When someone you personally referred invests, you earn {p.direct_percent}% of their package
                    principal — level 1 only. Separate from{' '}
                    <Link href={route('bonza')} className="font-semibold underline">
                        Affiliate Booster
                    </Link>{' '}
                    (+2% ROI) and from Affiliate Referral L1 / Sponsor L2–L5 (separate ledgers).
                </MemberPageHero>

                <div className="member-stat-grid grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
                    <MemberStatCard
                        label="Total earned"
                        value={formatUsd(p.earned_usd)}
                        hint={`${p.payout_count} payout${p.payout_count === 1 ? '' : 's'}`}
                        icon="bonza_buster"
                    />
                    <MemberStatCard
                        label="Direct rate"
                        value={`${p.direct_percent}%`}
                        hint="Of referral investment principal"
                        icon="affiliate_referral"
                    />
                </div>

                <PanelCard title="Bonanza transactions" icon="bonza_buster">
                    <p className="text-xs text-fintech-muted sm:text-sm">
                        Only credits from Bonanza (3% direct sponsor bonus on referral investments).
                    </p>

                    {transactions.length === 0 ? (
                        <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-fintech-muted">
                            No Bonanza payouts yet. You earn when a direct referral invests.
                        </p>
                    ) : (
                        <div className="mt-4 overflow-hidden rounded-xl border border-fintech-line bg-white">
                            <div className="divide-y divide-fintech-line md:hidden">
                                {transactions.map((row) => (
                                    <BonanzaTransactionRow key={row.id} row={row} />
                                ))}
                            </div>

                            <div className="hidden md:block">
                                <MemberTableScroll>
                                    <table className="w-full min-w-0 divide-y divide-fintech-line text-left text-xs text-fintech-muted md:text-sm">
                                        <thead className="bg-fintech-soft text-[0.65rem] font-semibold uppercase tracking-wide text-fintech-muted">
                                            <tr>
                                                <th className="px-4 py-3">Date</th>
                                                <th className="px-4 py-3">Details</th>
                                                <th className="px-4 py-3 text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-fintech-line">
                                            {transactions.map((row) => (
                                                <tr key={row.id} className="hover:bg-fintech-soft/80">
                                                    <td className="whitespace-nowrap px-4 py-3 text-fintech-muted">
                                                        {formatRowDate(row.created_at)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-fintech-ink">
                                                            {row.detail ?? 'Bonanza payout'}
                                                        </p>
                                                        {row.level_label ? (
                                                            <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                                                                {row.level_label}
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold text-emerald-600">
                                                        {formatUsd(row.amount_usd, true)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </MemberTableScroll>
                            </div>
                        </div>
                    )}

                    {transactions.length > 0 ? (
                        <p className="mt-3 text-xs text-fintech-muted">
                            {transactions.length} transaction{transactions.length === 1 ? '' : 's'} shown
                            {transactions.length >= 100 ? ' (latest 100)' : ''}
                        </p>
                    ) : null}
                </PanelCard>

                <PanelCard title="How it works" icon="bonza_buster">
                    <ul className="list-inside list-disc space-y-2 text-sm text-fintech-muted">
                        <li>Applies when your direct referral (level 1) records a Built for Growth investment.</li>
                        <li>
                            You receive <strong className="text-fintech-ink">{p.direct_percent}%</strong> of their
                            invested amount once per investment.
                        </li>
                        <li>Only your direct sponsor line — not deeper team levels.</li>
                        <li>
                            Your direct also triggers{' '}
                            <Link href={route('investment')} className="font-medium text-[#2563EB] hover:underline">
                                Affiliate Referral L1
                            </Link>{' '}
                            — a separate reward; L1 gets both Bonanza 3% and their L1 invest-referral %.
                        </li>
                    </ul>
                    {!p.enabled ? (
                        <p className="mt-3 text-sm font-medium text-amber-700">This program is currently disabled.</p>
                    ) : null}
                </PanelCard>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
