import MemberPageHero, { MemberHeroLink } from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import MemberStatCard from '@/Components/Member/MemberStatCard';
import MemberTableScroll from '@/Components/Member/MemberTableScroll';
import PanelCard from '@/Components/PanelCard';
import { formatMemberCode } from '@/lib/memberCode';
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

export default function DirectTeam({ direct_count: directCount = 0, directTeam: directTeamProp = [] }) {
    const directTeam = directTeamProp ?? [];

    return (
        <AuthenticatedLayout
            pageTitle="Direct Team"
            memberSurface="race"
            showMobileFintechNav
            mobileFintechPageTitle="Direct Team"
        >
            <Head title="Direct Team" />

            <MemberPageShell contentClassName="space-y-5 sm:space-y-6">
                <MemberPageHero
                    kicker="Level 1 only"
                    title="Direct Team"
                    variant="pdf"
                    icon="user-plus"
                    actions={
                        <MemberHeroLink href={route('team')}>Total Team (L1–L10) →</MemberHeroLink>
                    }
                >
                    Members who joined directly under your referral code — no deeper levels on this page.
                </MemberPageHero>

                <MemberStatCard
                    label="Direct referrals"
                    value={directCount}
                    hint="Level 1 · personal invites only"
                    icon="user-plus"
                    className="max-w-sm"
                />

                <PanelCard title={`Direct members (${directCount})`} icon="team">
                    {directTeam.length === 0 ? (
                        <p className="rx-empty">
                            No direct referrals yet. Share your invite code so new members appear here.
                        </p>
                    ) : (
                        <MemberTableScroll>
                            <table className="w-full min-w-[32rem] text-left text-xs sm:min-w-0 sm:text-sm">
                                <thead>
                                    <tr className="text-[0.65rem] font-semibold uppercase tracking-wide text-fintech-muted sm:text-xs">
                                        <th className="pb-2 pr-3">Member ID</th>
                                        <th className="pb-2 pr-3">Name</th>
                                        <th className="hidden pb-2 pr-3 sm:table-cell">Invite code</th>
                                        <th className="pb-2 pr-3">Invested</th>
                                        <th className="hidden pb-2 pr-3 md:table-cell">Joined</th>
                                        <th className="pb-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-fintech-line">
                                    {directTeam.map((m) => (
                                        <tr key={m.id}>
                                            <td className="py-2.5 pr-3 font-mono font-medium text-fintech-ink">
                                                {m.member_code ?? formatMemberCode(m.member_number)}
                                            </td>
                                            <td className="py-2.5 pr-3 font-medium text-fintech-ink">{m.name}</td>
                                            <td className="hidden py-2.5 pr-3 font-mono text-xs sm:table-cell">
                                                {m.referral_code ?? '—'}
                                            </td>
                                            <td className="py-2.5 pr-3">{formatUsd(m.invested_usd)}</td>
                                            <td className="hidden py-2.5 pr-3 text-fintech-muted md:table-cell">
                                                {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}
                                            </td>
                                            <td className="py-2.5">
                                                {m.is_blocked ? (
                                                    <span className="text-xs font-semibold text-red-500">Blocked</span>
                                                ) : m.id_active ? (
                                                    <span className="text-xs font-semibold text-emerald-600">Active</span>
                                                ) : (
                                                    <span className="text-xs font-semibold text-amber-600">Pending</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </MemberTableScroll>
                    )}
                </PanelCard>

                <p className="text-xs text-fintech-muted">
                    <Link href={route('team')} className="font-semibold text-[#2563EB] hover:underline">
                        View Total Team
                    </Link>
                    {' '}for all levels 1–10 with counts per level.
                </p>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
