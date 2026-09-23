import PanelCard from '@/Components/PanelCard';
import MemberPageHero, { MemberHeroLink } from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

const NAVY = '#020B2D';
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

const defaultProps = {
    self_hold_usd: '0.00',
    team_volume_usd: '0.00',
    current_rank_code: null,
    ranks: [],
};

export default function Rank(props) {
    const p = { ...defaultProps, ...props };
    const list = p.ranks || [];

    return (
        <AuthenticatedLayout
            pageTitle="R10 Ranks"
            memberSurface="race"
            showMobileFintechNav
            mobileFintechPageTitle="R10 Ranks"
        >
            <Head title="R10 Ranks" />

            <MemberPageShell contentClassName="space-y-5 sm:space-y-6">
                <MemberPageHero
                    kicker="Qualification ladder"
                    title="R10 Ranks (R1–R10)"
                    variant="blue"
                    icon="rank"
                    actions={<MemberHeroLink href={route('leadership')}>Affiliate R10 Leadership →</MemberHeroLink>}
                >
                    <strong className="text-white">No fixed cash bonus</strong> on ranks. Reward is only{' '}
                    <strong className="text-white">team volume × %</strong> at your qualified level (paid monthly on
                    schedule).
                </MemberPageHero>


            <div className="mb-5 grid gap-3 sm:grid-cols-3">
                <PanelCard className="border-fintech-line !p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">Self hold</p>
                    <p className="mt-1 text-2xl font-bold text-fintech-ink">{formatUsd2(p.self_hold_usd)}</p>
                </PanelCard>
                <PanelCard className="border-fintech-line !p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">Team volume</p>
                    <p className="mt-1 text-2xl font-bold text-brand">{formatUsd2(p.team_volume_usd)}</p>
                    <p className="mt-1 text-[11px] text-fintech-muted">Downline investments</p>
                </PanelCard>
                <PanelCard className="border-fintech-line !p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">Current rank</p>
                    <p className="mt-1 font-poppins text-2xl font-bold text-fintech-ink">{p.current_rank_code ?? '—'}</p>
                </PanelCard>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200/90 shadow-sm">
                <div
                    className="flex items-center justify-between px-4 py-3 sm:px-5"
                    style={{ backgroundColor: NAVY }}
                >
                    <div>
                        <h2 className="font-poppins text-sm font-bold text-white sm:text-base">Rank requirements</h2>
                        <p className="text-[11px] text-sky-200/85">Cumulative self + team · reward = team × % only</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs sm:text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-100/90 text-fintech-muted">
                                <th className="px-3 py-2.5 font-semibold sm:px-4">Rank</th>
                                <th className="px-3 py-2.5 font-semibold sm:px-4">Level</th>
                                <th className="px-3 py-2.5 font-semibold sm:px-4">Self (total)</th>
                                <th className="px-3 py-2.5 font-semibold sm:px-4">Team (total)</th>
                                <th className="px-3 py-2.5 font-semibold sm:px-4">Team %</th>
                                <th className="hidden px-3 py-2.5 font-semibold sm:table-cell sm:px-4">
                                    Est. monthly*
                                </th>
                                <th className="hidden px-3 py-2.5 font-semibold sm:table-cell sm:px-4">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.map((row, i) => (
                                <tr
                                    key={row.code}
                                    className="border-b border-slate-100/80"
                                    style={{ backgroundColor: i % 2 === 0 ? ROW_A : ROW_B }}
                                >
                                    <td className="px-3 py-2.5 sm:px-4">
                                        <span className="rounded-md bg-slate-800 px-2.5 py-0.5 font-poppins text-xs font-bold text-white">
                                            {row.code}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 font-medium text-brand sm:px-4">L{row.level}</td>
                                    <td className="px-3 py-2.5 text-fintech-ink sm:px-4">{formatUsd(row.self_hold_usd)}</td>
                                    <td className="px-3 py-2.5 text-fintech-ink sm:px-4">{formatUsd(row.team_volume_usd)}</td>
                                    <td className="px-3 py-2.5 font-semibold text-brand sm:px-4">
                                        {formatPct(row.team_volume_percent)}
                                    </td>
                                    <td className="hidden px-3 py-2.5 text-fintech-ink sm:table-cell sm:px-4">
                                        {formatUsd2(row.example_monthly_usd)}
                                    </td>
                                    <td className="hidden px-3 py-2.5 sm:table-cell sm:px-4">
                                        {row.qualified ? (
                                            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                                                Qualified
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-400">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <p className="mt-4 max-w-2xl text-[11px] leading-relaxed text-fintech-muted sm:text-xs">
                *Estimated monthly = your current downline team volume × that rank&apos;s % if you qualified at that
                level. Actual pay uses your highest qualified rank only, once per month.
            </p>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
