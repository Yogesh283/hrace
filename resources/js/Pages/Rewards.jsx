import PanelCard from '@/Components/PanelCard';
import MemberPageHero, { MemberHeroLink } from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import MemberTableScroll from '@/Components/Member/MemberTableScroll';
import RacePdfPanel from '@/Components/Member/RacePdfPanel';
import RacePdfSectionHeader from '@/Components/Member/RacePdfSectionHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage } from '@inertiajs/react';

const ROW_A = 'rgba(16, 185, 129, 0.1)';
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

const defaultProps = {
    program_name: 'Affiliate Team Rewards',
    withdrawal_fee_percent: '10.00',
    withdrawal_fee: {
        flat_fee_usd: '1.00',
        flat_fee_max_gross_usd: '99.99',
        percent_from_usd: '100.00',
        percent: '10.00',
        team_reward_percent: '10.00',
        admin_fee_percent: '1.00',
        mode: 'dual',
        destination: 'community_team_rewards',
    },
    ladder: [],
    lifetime_earned_usd: '0.00',
    recent_payouts: [],
    trigger_note: '',
};

export default function Rewards(props) {
    const p = { ...defaultProps, ...props };
    const { blockchain } = usePage().props;
    const fee = p.withdrawal_fee ?? defaultProps.withdrawal_fee;

    return (
        <AuthenticatedLayout
            pageTitle="Team Rewards"
            memberSurface="race"
            showMobileFintechNav
            mobileFintechPageTitle="Team Rewards"
        >
            <Head title="Affiliate Team Rewards" />

            <MemberPageShell contentClassName="space-y-5 sm:space-y-6">
                <MemberPageHero
                    kicker="Withdrawal fee reward"
                    title={p.program_name}
                    variant="pdf"
                    icon="rewards"
                    actions={
                        <>
                            <MemberHeroLink href={route('leadership')}>Affiliate R10 Leadership →</MemberHeroLink>
                            <MemberHeroLink href={route('dashboard')}>Dashboard →</MemberHeroLink>
                        </>
                    }
                />

            <div className="mb-5 grid gap-3 sm:grid-cols-2">
                <PanelCard title="Lifetime earned" icon="rewards" className="border-fintech-line !p-4">
                    <p className="mt-1 text-2xl font-bold text-emerald-700">{formatUsd2(p.lifetime_earned_usd)}</p>
                </PanelCard>
                <PanelCard title="Trigger" icon="withdrawal" className="border-fintech-line !p-4">
                    <p className="mt-1 text-sm font-medium text-fintech-ink">Per downline wallet withdrawal</p>
                    <p className="mt-1 text-[11px] text-fintech-muted">{p.trigger_note}</p>
                </PanelCard>
            </div>

            <RacePdfPanel className="mb-6">
                <RacePdfSectionHeader
                    title="Reward ladder"
                    subtitle={`On a ${formatUsd2(100)} income withdrawal: 10% Team Reward = $10 shared L1–L10, plus separate $1 Admin Fee (net $89). Level N needs N $50+ activated directs. Fixed maturity/EMI excluded.`}
                />
                <MemberTableScroll>
                    <table className="w-full min-w-[24rem] text-left text-xs sm:min-w-0 sm:text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-100/90 text-fintech-muted">
                                <th className="px-3 py-2.5 font-semibold sm:px-4">Level</th>
                                <th className="px-3 py-2.5 font-semibold sm:px-4">Reward %</th>
                                <th className="px-3 py-2.5 font-semibold sm:px-4">Example pay</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(p.ladder || []).map((row, i) => (
                                <tr
                                    key={row.level}
                                    className="border-b border-slate-100/80"
                                    style={{ backgroundColor: i % 2 === 0 ? ROW_A : ROW_B }}
                                >
                                    <td className="px-3 py-2.5 font-bold text-emerald-800 sm:px-4">Level {row.level}</td>
                                    <td className="px-3 py-2.5 font-semibold text-fintech-ink sm:px-4">{formatPct(row.percent)}</td>
                                    <td className="px-3 py-2.5 font-medium text-emerald-700 sm:px-4">
                                        {formatUsd2(row.example_usd)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </MemberTableScroll>
            </RacePdfPanel>

            {p.recent_payouts?.length > 0 && (
                <PanelCard className="border-fintech-line !p-4">
                    <p className="text-sm font-semibold text-fintech-ink">Recent team rewards</p>
                    <ul className="mt-3 space-y-2">
                        {p.recent_payouts.map((row, i) => (
                            <li
                                key={`${row.at}-${i}`}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs"
                            >
                                <span className="text-fintech-muted">
                                    Level {row.level ?? '—'}
                                    {row.from_user_id ? ` · member #${row.from_user_id}` : ''}
                                </span>
                                <span className="font-semibold text-emerald-700">{formatUsd2(row.amount_usd)}</span>
                            </li>
                        ))}
                    </ul>
                </PanelCard>
            )}

            <p className="mt-4 text-[11px] text-fintech-muted sm:text-xs">
                Team Rewards = one-time on connection. Affiliate R10 Leadership = monthly % on downline team volume (separate
                program).
            </p>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
