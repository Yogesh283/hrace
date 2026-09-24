import MemberPageHero from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import MemberStatCard from '@/Components/Member/MemberStatCard';
import PanelCard from '@/Components/PanelCard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

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

export default function SelfHold({ self_hold_usd = '0.00', investments = [] }) {
    const active = investments.filter((i) => i.status === 'active');

    return (
        <AuthenticatedLayout pageTitle="Self Hold" memberSurface="race" showMobileFintechNav>
            <Head title="Self Hold" />

            <MemberPageShell inset particles contentClassName="space-y-5 sm:space-y-6">
                <MemberPageHero
                    kicker="Active packages"
                    title="Self Hold"
                    variant="sky"
                    icon="investment"
                    actions={
                        <Link href={route('investment')} className="text-sm font-semibold text-[#2563EB] hover:underline">
                            New package
                        </Link>
                    }
                >
                    Total principal in active Built for Growth packages — used for leadership qualification and plan
                    status.
                </MemberPageHero>

                <MemberStatCard
                    label="Total self hold"
                    value={formatUsd(self_hold_usd)}
                    hint={`${active.length} active package${active.length === 1 ? '' : 's'}`}
                    icon="investment"
                />

                <PanelCard title="Active packages" icon="investment">
                    {active.length === 0 ? (
                        <p className="rx-empty">
                            No active hold yet.{' '}
                            <Link href={route('investment')} className="font-semibold text-sky-300 hover:underline">
                                Record a package
                            </Link>
                            .
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[320px] text-left text-sm">
                                <thead>
                                    <tr className="border-b border-sky-100 text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">
                                        <th className="px-2 py-2">Principal</th>
                                        <th className="px-2 py-2">Term</th>
                                        <th className="px-2 py-2">Daily %</th>
                                        <th className="px-2 py-2">ROI paid</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {active.map((row) => (
                                        <tr key={row.id} className="border-b border-sky-50/80">
                                            <td className="px-2 py-2.5 font-semibold text-fintech-ink">
                                                {formatUsd(row.amount_usd)}
                                            </td>
                                            <td className="px-2 py-2.5 text-fintech-muted">{row.duration_days ?? '—'} days</td>
                                            <td className="px-2 py-2.5 text-fintech-muted">
                                                {row.roi_percent_daily != null ? `${row.roi_percent_daily}%` : '—'}
                                            </td>
                                            <td className="px-2 py-2.5 font-mono text-emerald-700">
                                                {formatUsd(row.total_roi_paid_usd)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </PanelCard>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
