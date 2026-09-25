import MemberAlert from '@/Components/Member/MemberAlert';
import MemberPageHero, { MemberHeroLink } from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import MemberTableScroll from '@/Components/Member/MemberTableScroll';
import PanelCard from '@/Components/PanelCard';
import RacePdfPanel from '@/Components/Member/RacePdfPanel';
import RacePdfSectionHeader from '@/Components/Member/RacePdfSectionHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage } from '@inertiajs/react';

const ROW_A = 'rgba(37, 99, 235, 0.1)';
const ROW_B = 'rgba(15, 23, 42, 0.05)';

function formatUsd(value) {
    const n = Number(value);
    if (Number.isNaN(n)) return '—';
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(n);
}

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

function ProgressBar({ label, pct }) {
    const w = Math.min(100, Math.max(0, Number(pct) || 0));
    return (
        <div className="mb-3">
            <div className="mb-1 flex justify-between text-xs text-fintech-muted">
                <span>{label}</span>
                <span>{w.toFixed(0)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] transition-all duration-500"
                    style={{ width: `${w}%` }}
                />
            </div>
        </div>
    );
}

const defaultProps = {
    program_name: 'Community Leadership',
    self_hold_usd: '0.00',
    team_volume_usd: '0.00',
    team_daily_roi_usd: '0.00',
    qualified_directs: 0,
    leadership_activated: false,
    min_directs_required: 2,
    distribution_cycle_hours: 24,
    current_rank: null,
    estimated_daily_pay_usd: '0.00',
    ladder: [],
    last_payout: null,
    payout_note: '',
    rank_11_monthly_bonus: null,
};

export default function Leadership(props) {
    const p = { ...defaultProps, ...props };
    const { blockchain } = usePage().props;
    const lead = p.current_rank;

    return (
        <AuthenticatedLayout
            pageTitle="Community Leadership"
            memberSurface="race"
            showMobileFintechNav
            mobileFintechPageTitle="Community Leadership"
        >
            <Head title="Community Leadership" />

            <MemberPageShell contentClassName="space-y-5 sm:space-y-6">
                <MemberPageHero
                    kicker="24-hour program"
                    title={p.program_name}
                    variant="pdf"
                    icon="leadership"
                    actions={
                        <>
                            <MemberHeroLink href={route('leadership.live-data')}>View live data →</MemberHeroLink>
                            <MemberHeroLink href={route('rewards')}>Team Rewards →</MemberHeroLink>
                        </>
                    }
                >
                    {blockchain?.blockchain_only ? (
                        <span className="mt-2 block text-xs text-sky-200/90">
                            On-chain: ranks and RACE payouts are handled by RaceCommunityEngine. This page is read-only.
                        </span>
                    ) : null}
                </MemberPageHero>

                <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-12 lg:gap-4">
                    <PanelCard className="border-fintech-line !p-5 lg:col-span-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">Your leadership</p>
                        {lead && p.leadership_activated ? (
                            <>
                                <p className="mt-2 font-poppins text-2xl font-bold tracking-tight text-fintech-ink sm:text-4xl">
                                    Level {lead.level}
                                </p>
                                <p className="mt-1 text-sm text-fintech-muted">{p.program_name}</p>
                                <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-fintech-muted">
                                        Reward
                                    </span>
                                    <span className="rounded-lg bg-[#2563EB] px-2.5 py-0.5 font-poppins text-sm font-bold text-white">
                                        {formatPct(lead.reward_percent)}
                                    </span>
                                </div>
                                <p className="mt-4 text-xs leading-relaxed text-fintech-ink sm:text-sm">
                                    Est. daily pay{' '}
                                    <span className="font-semibold">{formatUsd2(p.estimated_daily_pay_usd)}</span>
                                    <span className="block text-[10px] text-fintech-muted">
                                        {formatPct(lead.reward_percent)} of team daily ROI (
                                        {formatUsd2(p.team_daily_roi_usd)})
                                    </span>
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="mt-2 font-poppins text-2xl font-bold text-fintech-muted">Not qualified</p>
                                <p className="mt-2 text-sm text-fintech-muted">
                                    Meet <strong className="text-fintech-ink">self hold + team volume + directs</strong> and
                                    have at least {p.min_directs_required} qualified directs. Each rank needs its own
                                    self-hold amount (T&amp;C).
                                </p>
                                <p className="mt-2 text-xs text-fintech-muted">
                                    Qualified directs: {p.qualified_directs} / {p.min_directs_required}
                                </p>
                            </>
                        )}
                    </PanelCard>

                    <div className="grid gap-3 sm:grid-cols-2 lg:col-span-7">
                        <PanelCard className="border-fintech-line !p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">Self hold</p>
                            <p className="mt-1 text-2xl font-bold text-fintech-ink">{formatUsd2(p.self_hold_usd)}</p>
                            <p className="mt-1 text-[11px] text-fintech-muted">Active participation · required for ranks</p>
                        </PanelCard>
                        <PanelCard className="border-fintech-line !p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">Team volume</p>
                            <p className="mt-1 text-2xl font-bold text-brand">{formatUsd2(p.team_volume_usd)}</p>
                            <p className="mt-1 text-[11px] text-fintech-muted">Total downline investment (rank qualify)</p>
                        </PanelCard>
                        <PanelCard className="border-fintech-line !p-4 sm:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">Team daily ROI</p>
                            <p className="mt-1 text-2xl font-bold text-emerald-700">{formatUsd2(p.team_daily_roi_usd)}</p>
                            <p className="mt-1 text-[11px] text-fintech-muted">
                                Sum of downline daily earnings · leadership % applies here
                            </p>
                        </PanelCard>
                    </div>
                </div>

                {p.last_payout && (
                    <MemberAlert variant="success" className="mb-5">
                        <span className="font-semibold">Last credit:</span> {formatUsd2(p.last_payout.amount_usd)}
                        {p.last_payout.rank_code && <span> · {p.last_payout.rank_code}</span>}
                        {p.last_payout.period && <span> · {p.last_payout.period}</span>}
                    </MemberAlert>
                )}

                <RacePdfPanel>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <RacePdfSectionHeader
                            className="flex-1 rounded-none border-0"
                            title="Community Leadership"
                            subtitle="11 ranks · PDF program rules"
                        />
                        <Link
                            href={route('leadership.live-data')}
                            className="mx-4 mb-3 shrink-0 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-200 hover:bg-amber-500/20 sm:mb-0 sm:mr-5"
                        >
                            View live data
                        </Link>
                    </div>

                    <MemberTableScroll>
                        <table className="w-full min-w-[520px] text-left text-xs sm:text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-100/90 text-fintech-muted">
                                    <th className="px-3 py-2.5 font-semibold sm:px-4">Level</th>
                                    <th className="px-3 py-2.5 font-semibold sm:px-4">Self hold</th>
                                    <th className="px-3 py-2.5 font-semibold sm:px-4">Team volume</th>
                                    <th className="px-3 py-2.5 font-semibold sm:px-4">Directs</th>
                                    <th className="px-3 py-2.5 font-semibold sm:px-4">Reward % / est. daily</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(p.ladder || []).map((row, i) => {
                                    const reqSelf = row.required_self_hold_usd;
                                    const reqTeam = row.required_team_volume_usd;
                                    const earned = row.estimated_daily_pay_usd ?? 0;
                                    const pct = row.reward_percent;
                                    return (
                                        <tr
                                            key={row.level}
                                            className={`border-b border-slate-100/80 ${
                                                row.is_current ? 'ring-1 ring-inset ring-[#2563EB]/35' : ''
                                            }`}
                                            style={{ backgroundColor: i % 2 === 0 ? ROW_A : ROW_B }}
                                        >
                                            <td className="px-3 py-3 sm:px-4">
                                                <span className="font-poppins text-base font-bold text-brand">L{row.level}</span>
                                                {row.is_current && (
                                                    <span className="mt-1 inline-block rounded-full bg-[#2563EB] px-2 py-0.5 text-[9px] font-bold uppercase text-white">
                                                        Current
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 font-semibold text-fintech-ink sm:px-4">
                                                {formatUsd2(reqSelf)}
                                            </td>
                                            <td className="px-3 py-3 font-semibold text-fintech-ink sm:px-4">
                                                {formatUsd(reqTeam)}
                                            </td>
                                            <td className="px-3 py-3 font-semibold text-fintech-ink sm:px-4">
                                                {row.required_directs}
                                            </td>
                                            <td className="px-3 py-3 sm:px-4">
                                                <p className="font-bold text-fintech-ink">{formatUsd2(earned)}</p>
                                                <p className="text-[10px] text-slate-600">{formatPct(pct)} of team daily ROI</p>
                                                {row.qualified && (
                                                    <p className="mt-0.5 text-[10px] font-semibold text-emerald-700">
                                                        Qualified
                                                    </p>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </MemberTableScroll>
                </RacePdfPanel>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
