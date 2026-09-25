import PanelCard from '@/Components/PanelCard';
import MemberPageHero, { MemberHeroLink } from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

const NAVY = '#020B2D';
const HEADER_BG = 'linear-gradient(180deg, #1e3a8a 0%, #2563eb 55%, #38bdf8 100%)';
const ROW_A = 'rgba(186, 230, 253, 0.35)';
const ROW_B = 'rgba(255, 255, 255, 0.95)';

function formatUsd2(value) {
    const n = Number(value);
    if (Number.isNaN(n)) return '�';
    // Use up to 4 decimal places so small amounts like $0.0033 show correctly.
    // Trailing zeros beyond 2dp are trimmed (e.g. $1.50 not $1.5000).
    const decimals = n !== 0 && Math.abs(n) < 0.01 ? 4 : 2;
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: 4,
    }).format(n);
}

function formatPct(p) {
    const n = Number(p);
    if (Number.isNaN(n)) return '�';
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n)}%`;
}

const defaultProps = {
    program_name: 'Affiliate Network of ROI',
    direct_active_count: 0,
    lifetime_earned_usd: '0.00',
    trigger_note: '',
    levels: [],
    recent_payouts: [],
};

export default function NetworkRoi(props) {
    const p = { ...defaultProps, ...props };

    return (
        <AuthenticatedLayout
            pageTitle="Network ROI"
            memberSurface="race"
            showMobileFintechNav
            mobileFintechPageTitle="Network ROI"
        >
            <Head title="Affiliate Network of ROI" />

            <MemberPageShell contentClassName="space-y-5 sm:space-y-6">
                <MemberPageHero
                    kicker="Downline ROI share"
                    title={p.program_name}
                    variant="sky"
                    icon="affiliate_network_roi"
                    actions={
                        <>
                            <MemberHeroLink href={route('investment')}>Invest →</MemberHeroLink>
                            <MemberHeroLink href={route('team')}>Team →</MemberHeroLink>
                            <MemberHeroLink href={route('dashboard')}>Dashboard →</MemberHeroLink>
                        </>
                    }
                >
                    When your downline earns trading ROI, you receive a percentage of that ROI per network level (1�10).
                    Each level unlocks only when you have enough <strong className="text-white">direct active</strong> referrals
                    (members who completed their first investment).
                </MemberPageHero>

                <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:grid-cols-3">
                    <PanelCard title="Lifetime earned" icon="affiliate_network_roi" className="border-fintech-line !p-4">
                        <p className="mt-1 text-2xl font-bold text-[#2563EB]">{formatUsd2(p.lifetime_earned_usd)}</p>
                    </PanelCard>
                    <PanelCard title="Your direct actives" icon="team" className="border-fintech-line !p-4">
                        <p className="mt-1 text-2xl font-bold text-fintech-ink">{p.direct_active_count}</p>
                        <p className="mt-1 text-[11px] text-fintech-muted">Direct referrals with active ID</p>
                    </PanelCard>
                    <PanelCard title="Max network level" icon="rewards" className="border-fintech-line !p-4">
                        <p className="mt-1 text-2xl font-bold text-fintech-ink">
                            {p.direct_active_count >= 10
                                ? 'Level 10'
                                : p.direct_active_count > 0
                                  ? `Level ${p.direct_active_count}`
                                  : 'Locked'}
                        </p>
                        <p className="mt-1 text-[11px] text-fintech-muted">Level N needs N direct actives</p>
                    </PanelCard>
                </div>

                <div className="overflow-hidden rounded-2xl border border-sky-200/90 shadow-[0_12px_40px_-12px_rgba(37,99,235,0.25)]">
                    <div className="px-4 py-4 text-center sm:px-6 sm:py-5" style={{ background: HEADER_BG }}>
                        <h2 className="font-poppins text-lg font-extrabold uppercase tracking-wide text-white sm:text-xl">
                            Affiliate Network of ROI
                        </h2>
                        <p className="mt-1 text-[11px] font-medium text-sky-100/90 sm:text-xs">{p.trigger_note}</p>
                    </div>

                    <div className="overflow-x-auto bg-white">
                        <table className="min-w-full border-collapse text-left text-xs sm:text-sm">
                            <thead>
                                <tr style={{ backgroundColor: NAVY }} className="text-white">
                                    <th className="border border-sky-400/40 px-3 py-3 font-poppins text-[11px] font-bold uppercase tracking-wider sm:px-4 sm:text-xs">
                                        Network level
                                    </th>
                                    <th className="border border-sky-400/40 px-3 py-3 text-center font-poppins text-[11px] font-bold uppercase tracking-wider sm:px-4 sm:text-xs">
                                        ROI of ROI
                                    </th>
                                    <th className="border border-sky-400/40 px-3 py-3 text-center font-poppins text-[11px] font-bold uppercase tracking-wider sm:px-4 sm:text-xs">
                                        Referral
                                    </th>
                                    <th className="border border-sky-400/40 px-3 py-3 text-center font-poppins text-[11px] font-bold uppercase tracking-wider sm:px-4 sm:text-xs">
                                        Status
                                    </th>
                                    <th className="border border-sky-400/40 px-3 py-3 text-right font-poppins text-[11px] font-bold uppercase tracking-wider sm:px-4 sm:text-xs">
                                        Earned
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {(p.levels || []).map((row, i) => (
                                    <tr
                                        key={row.level}
                                        style={{ backgroundColor: i % 2 === 0 ? ROW_A : ROW_B }}
                                    >
                                        <td className="border border-sky-200/80 px-3 py-2.5 font-poppins font-bold text-[#1e40af] sm:px-4">
                                            Level {row.level}
                                        </td>
                                        <td className="border border-sky-200/80 px-3 py-2.5 text-center font-semibold text-[#1e3a8a] sm:px-4">
                                            {formatPct(row.roi_of_roi_percent)}
                                        </td>
                                        <td className="border border-sky-200/80 px-3 py-2.5 text-center font-bold text-[#1e3a8a] sm:px-4">
                                            {row.referral_label}
                                            <span className="mt-0.5 block text-[10px] font-normal text-slate-500">
                                                {row.referral_required} direct active
                                                {row.referral_required > 1 ? 's' : ''}
                                            </span>
                                        </td>
                                        <td className="border border-sky-200/80 px-3 py-2.5 text-center sm:px-4">
                                            {row.direct_active_met ? (
                                                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-200">
                                                    Open
                                                </span>
                                            ) : (
                                                <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
                                                    Locked
                                                </span>
                                            )}
                                        </td>
                                        <td className="border border-sky-200/80 px-3 py-2.5 text-right sm:px-4">
                                            <span
                                                className={`font-mono font-bold ${
                                                    row.has_earned ? 'text-emerald-700' : 'text-slate-400'
                                                }`}
                                            >
                                                {formatUsd2(row.earned_usd)}
                                            </span>
                                            {row.payment_count > 0 ? (
                                                <span className="mt-0.5 block text-[10px] font-normal text-slate-500">
                                                    {row.payment_count} payment{row.payment_count === 1 ? '' : 's'}
                                                </span>
                                            ) : null}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {p.recent_payouts?.length > 0 ? (
                    <PanelCard title="Recent network ROI credits" icon="affiliate_network_roi" className="border-fintech-line !p-4">
                        <ul className="mt-2 space-y-2">
                            {p.recent_payouts.map((row, i) => (
                                <li
                                    key={`${row.at}-${i}`}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs"
                                >
                                    <span className="text-fintech-muted">
                                        Level {row.level ?? '�'}
                                        {row.percent != null ? ` � ${formatPct(row.percent)} of ROI` : ''}
                                        {row.from_member_code ? ` � from ${row.from_member_code}` : ''}
                                    </span>
                                    <span className="font-semibold text-emerald-700">{formatUsd2(row.amount_usd)}</span>
                                </li>
                            ))}
                        </ul>
                        <Link
                            href={route('transactions', { income: 'affiliate_network_roi' })}
                            className="mt-3 inline-block text-sm font-semibold text-[#2563EB] hover:underline"
                        >
                            View all in ledger ?
                        </Link>
                    </PanelCard>
                ) : null}

                <p className="text-[11px] leading-relaxed text-fintech-muted sm:text-xs">
                    <strong className="text-fintech-ink">Direct active</strong> = your direct referral activated their member ID
                    (first investment). Level 1 ? 1 direct active, Level 2 ? 2, � Level 10 ? 10. You earn the ROI % when downline
                    receives trading returns.
                </p>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
