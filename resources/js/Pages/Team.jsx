import MemberPageHero, { MemberHeroLink } from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import MemberStatCard from '@/Components/Member/MemberStatCard';
import MemberTableScroll from '@/Components/Member/MemberTableScroll';
import PanelCard from '@/Components/PanelCard';
import { formatMemberCode } from '@/lib/memberCode';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import { useState } from 'react';

function formatUsd(value) {
    const n = Number(value);
    if (Number.isNaN(n)) {
        return '—';
    }
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(n);
}

const defaultStats = {
    direct_count: 0,
    total_downline: 0,
    network_volume_usd: '0.00',
    downline_volume_usd: '0.00',
};

function MemberRow({ m }) {
    return (
        <tr className="border-b border-fintech-line/80 last:border-0">
            <td className="py-2.5 pr-3 font-mono text-xs font-medium text-fintech-ink sm:text-sm">
                {m.member_code ?? formatMemberCode(m.member_number)}
            </td>
            <td className="py-2.5 pr-3 font-medium text-fintech-ink">{m.name}</td>
            <td className="hidden py-2.5 pr-3 font-mono text-xs sm:table-cell">{m.referral_code ?? '—'}</td>
            <td className="py-2.5 pr-3">{formatUsd(m.invested_usd)}</td>
            <td className="hidden py-2.5 pr-3 text-xs text-fintech-muted md:table-cell">
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
    );
}

function LevelToggle({ level, count, members, isOpen, onToggle }) {
    return (
        <div className="overflow-hidden rounded-xl border border-fintech-line/90 bg-white shadow-sm">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50/90 sm:px-5"
                aria-expanded={isOpen}
            >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#2563EB] to-[#38BDF8] font-poppins text-sm font-bold text-white">
                        L{level.level}
                    </span>
                    <div className="member-level-toggle__label min-w-0">
                        <p className="font-poppins text-sm font-bold text-fintech-ink sm:text-base">
                            Level {level.level}
                        </p>
                        <p className="text-[11px] text-fintech-muted sm:text-xs">
                            {level.level === 1 ? 'Direct referrals' : `Network depth ${level.level}`}
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-[#2563EB]/10 px-2.5 py-1 font-poppins text-sm font-bold text-[#2563EB]">
                        {count}
                    </span>
                    <svg
                        className={`h-5 w-5 text-fintech-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>

            {isOpen ? (
                <div className="border-t border-fintech-line/80 bg-slate-50/50 px-3 py-3 sm:px-4">
                    {members.length === 0 ? (
                        <p className="py-4 text-center text-sm text-fintech-muted">No members at this level.</p>
                    ) : (
                        <MemberTableScroll>
                            <table className="w-full min-w-[32rem] text-left text-xs sm:min-w-0 sm:text-sm">
                                <thead>
                                    <tr className="text-[0.65rem] font-semibold uppercase tracking-wide text-fintech-muted sm:text-xs">
                                        <th className="pb-2 pr-3">Member ID</th>
                                        <th className="pb-2 pr-3">Name</th>
                                        <th className="hidden pb-2 pr-3 sm:table-cell">Code</th>
                                        <th className="pb-2 pr-3">Invested</th>
                                        <th className="hidden pb-2 pr-3 md:table-cell">Joined</th>
                                        <th className="pb-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody>{members.map((m) => (
                                    <MemberRow key={m.id} m={m} />
                                ))}</tbody>
                            </table>
                        </MemberTableScroll>
                    )}
                </div>
            ) : null}
        </div>
    );
}

export default function Team({ stats: statsProp = {}, levels: levelsProp = [] }) {
    const { user } = usePage().props.auth;
    const stats = { ...defaultStats, ...statsProp };
    const levels = levelsProp?.length
        ? levelsProp
        : Array.from({ length: 10 }, (_, i) => ({ level: i + 1, count: 0, members: [] }));

    const [openLevels, setOpenLevels] = useState(() => new Set());

    const toggleLevel = (levelNum) => {
        setOpenLevels((prev) => {
            const next = new Set(prev);
            if (next.has(levelNum)) {
                next.delete(levelNum);
            } else {
                next.add(levelNum);
            }
            return next;
        });
    };

    const totalFromLevels = levels.reduce((sum, row) => sum + (row.count ?? 0), 0);

    return (
        <AuthenticatedLayout
            pageTitle="Total Team"
            memberSurface="race"
            showMobileFintechNav
            mobileFintechPageTitle="Total Team"
        >
            <Head title="Total Team" />

            <MemberPageShell contentClassName="space-y-5 sm:space-y-6">
                <MemberPageHero
                    kicker="Referral network"
                    title="Total Team"
                    variant="pdf"
                    icon="team"
                    actions={<MemberHeroLink href={route('direct-team')}>Direct Team only →</MemberHeroLink>}
                >
                    Your full referral tree by network level (L1–L10). Tap a level to see every member at that depth.
                </MemberPageHero>

                <div className="rounded-xl border border-white/90 bg-white/75 px-3 py-2.5 text-sm text-fintech-muted shadow-[0_8px_32px_-12px_rgba(37,99,235,0.12)] backdrop-blur-sm sm:px-4 sm:py-3">
                    <span className="text-fintech-muted">Your invite code · </span>
                    <span className="font-mono font-medium text-fintech-ink">{user?.referral_code ?? '—'}</span>
                </div>

                <div className="member-stat-grid gap-2 sm:gap-4 lg:grid lg:grid-cols-4">
                    <MemberStatCard label="Level 1 (direct)" value={stats.direct_count} icon="user-plus" />
                    <MemberStatCard
                        label="Total team"
                        value={stats.total_downline || totalFromLevels}
                        hint="L1–L10 combined"
                        icon="users"
                    />
                    <MemberStatCard
                        className="col-span-2 sm:col-span-1"
                        label="Network volume"
                        value={formatUsd(stats.network_volume_usd)}
                        valueClassName="text-xl text-brand"
                        hint="Level 1 (direct) investments only"
                        icon="chart"
                    />
                    <MemberStatCard
                        className="col-span-2 sm:col-span-1"
                        label="Downline only"
                        value={formatUsd(stats.downline_volume_usd)}
                        valueClassName="text-xl"
                        hint="Full team (L1–L10) investments"
                        icon="network"
                    />
                </div>

                <PanelCard title="Team by level (L1 – L10)" icon="team" className="!p-3 sm:!p-4">
                    <p className="mb-4 text-xs text-fintech-muted sm:text-sm">
                        Each row shows how many users are at that network level. Click to expand and view members.
                    </p>
                    <div className="space-y-2 sm:space-y-2.5">
                        {levels.map((row) => (
                            <LevelToggle
                                key={row.level}
                                level={row}
                                count={row.count ?? 0}
                                members={row.members ?? []}
                                isOpen={openLevels.has(row.level)}
                                onToggle={() => toggleLevel(row.level)}
                            />
                        ))}
                    </div>
                </PanelCard>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
