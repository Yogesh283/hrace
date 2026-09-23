import MemberPageHero, { MemberHeroLink } from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import MemberTableScroll from '@/Components/Member/MemberTableScroll';
import PanelCard from '@/Components/PanelCard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

const NAVY = '#020B2D';
const ROW_A = 'rgba(37, 99, 235, 0.1)';
const ROW_B = 'rgba(15, 23, 42, 0.05)';

function formatUsd2(value) {
    const n = Number(value);
    if (Number.isNaN(n)) return '—';
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(n);
}

function formatPct(p) {
    const n = Number(p);
    if (Number.isNaN(n)) return '—';
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n)}%`;
}

export default function LeadershipLiveData(props) {
    const live = props.live && typeof props.live === 'object' ? props.live : props;
    const rows = live.rows ?? live.ladder ?? [];
    const closing = live.closing ?? {};
    const selfHold = live.live_self_hold_usd ?? live.self_hold_usd;

    return (
        <AuthenticatedLayout
            pageTitle="Leadership Live Data"
            memberSurface="race"
            showMobileFintechNav
            mobileFintechPageTitle="Leadership Live Data"
        >
            <Head title="Community Leadership — Live Data" />

            <MemberPageShell contentClassName="space-y-5 sm:space-y-6">
                <MemberPageHero
                    kicker="Live ledger"
                    title="Community Leadership live data"
                    variant="blue"
                    icon="leadership"
                    actions={
                        <>
                            <MemberHeroLink href={route('leadership')}>← Leadership table</MemberHeroLink>
                            <MemberHeroLink href={route('self-hold')}>Self hold →</MemberHeroLink>
                        </>
                    }
                >
                    Your live <strong className="text-white">self hold</strong>,{' '}
                    <strong className="text-white">team volume</strong> and{' '}
                    <strong className="text-white">directs</strong> at each rank (L1 – L11).
                </MemberPageHero>

                <PanelCard className="border-fintech-line !p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">Your active self hold</p>
                    <p className="mt-1 text-2xl font-bold text-fintech-ink">{formatUsd2(selfHold)}</p>
                    {closing.current_period && (
                        <p className="mt-2 text-xs text-fintech-muted">
                            Current month: <span className="font-semibold text-fintech-ink">{closing.current_period}</span>
                            {closing.payout_period && (
                                <>
                                    {' '}
                                    · Last payout period:{' '}
                                    <span className="font-semibold text-fintech-ink">{closing.payout_period}</span>
                                </>
                            )}
                        </p>
                    )}
                </PanelCard>

                {closing.self_hold_lapsed && closing.lapse_message && (
                    <div className="rounded-xl border border-amber-300/90 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                        <p className="font-semibold">Self hold lapse warning</p>
                        <p className="mt-1 text-xs leading-relaxed">{closing.lapse_message}</p>
                    </div>
                )}

                {closing.closing_note && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-xs leading-relaxed text-fintech-ink">
                        <p className="font-semibold text-fintech-ink">Monthly closing rule</p>
                        <p className="mt-1 text-fintech-muted">{closing.closing_note}</p>
                    </div>
                )}

                <div className="overflow-hidden rounded-xl border border-slate-200/90 shadow-sm">
                    <div
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5"
                        style={{ backgroundColor: NAVY }}
                    >
                        <div>
                            <h2 className="font-poppins text-sm font-bold text-white sm:text-base">Live data ledger</h2>
                            <p className="text-[11px] text-sky-200/85">L1 – L11 · self hold, team volume & directs</p>
                        </div>
                        <Link
                            href={route('leadership')}
                            className="rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/20"
                        >
                            Plan table
                        </Link>
                    </div>

                    <MemberTableScroll>
                        <table className="w-full min-w-[860px] text-left text-xs lg:text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-100/90 text-fintech-muted">
                                    <th className="px-3 py-2.5 font-semibold">Rank</th>
                                    <th className="px-3 py-2.5 font-semibold">Level</th>
                                    <th className="px-3 py-2.5 font-semibold">Req. self hold</th>
                                    <th className="px-3 py-2.5 font-semibold">Live self hold</th>
                                    <th className="px-3 py-2.5 font-semibold">Req. team vol.</th>
                                    <th className="px-3 py-2.5 font-semibold">Live team vol.</th>
                                    <th className="px-3 py-2.5 font-semibold">Req. directs</th>
                                    <th className="px-3 py-2.5 font-semibold">Live directs</th>
                                    <th className="px-3 py-2.5 font-semibold">Reward %</th>
                                    <th className="px-3 py-2.5 font-semibold">Est. daily</th>
                                    <th className="px-3 py-2.5 font-semibold">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="px-3 py-8 text-center text-sm text-fintech-muted">
                                            No leadership ranks to show.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((row, i) => (
                                    <tr
                                        key={row.rank_code ?? row.level ?? i}
                                        style={{ backgroundColor: i % 2 === 0 ? ROW_A : ROW_B }}
                                        className="border-b border-slate-100/80"
                                    >
                                        <td className="px-3 py-2.5 font-bold text-brand">{row.rank_code ?? `L${row.network_level ?? row.level}`}</td>
                                        <td className="px-3 py-2.5 text-fintech-ink">{row.network_level ?? row.level}</td>
                                        <td className="px-3 py-2.5 font-semibold text-fintech-ink">
                                            {formatUsd2(row.required_self_hold_usd)}
                                        </td>
                                        <td
                                            className={`px-3 py-2.5 font-mono font-semibold ${
                                                row.self_hold_met ? 'text-emerald-700' : 'text-rose-700'
                                            }`}
                                        >
                                            {formatUsd2(row.live_self_hold_usd)}
                                        </td>
                                        <td className="px-3 py-2.5 font-semibold text-fintech-ink">
                                            {formatUsd2(row.required_team_volume_usd)}
                                        </td>
                                        <td
                                            className={`px-3 py-2.5 font-mono font-semibold ${
                                                row.team_volume_met ? 'text-emerald-700' : 'text-fintech-ink'
                                            }`}
                                        >
                                            {formatUsd2(row.live_team_volume_usd)}
                                        </td>
                                        <td className="px-3 py-2.5 font-semibold text-fintech-ink">
                                            {row.required_directs ?? '—'}
                                        </td>
                                        <td
                                            className={`px-3 py-2.5 font-mono font-semibold ${
                                                row.directs_met ? 'text-emerald-700' : 'text-fintech-ink'
                                            }`}
                                        >
                                            {row.live_directs ?? 0}
                                        </td>
                                        <td className="px-3 py-2.5 font-semibold text-brand">
                                            {formatPct(row.team_volume_percent ?? row.reward_percent)}
                                        </td>
                                        <td className="px-3 py-2.5 font-bold text-fintech-ink">
                                            {formatUsd2(row.estimated_earned_usd ?? row.estimated_daily_pay_usd)}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {row.qualified ? (
                                                <span className="text-[10px] font-bold text-emerald-700">Qualified</span>
                                            ) : (
                                                <span className="text-[10px] text-slate-500">—</span>
                                            )}
                                        </td>
                                    </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </MemberTableScroll>
                </div>

                <p className="text-[11px] leading-relaxed text-fintech-muted">
                    Team volume is full downline participation. Daily pay = team daily ROI × rank reward % when you
                    qualify (self hold + team volume + directs).
                </p>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
