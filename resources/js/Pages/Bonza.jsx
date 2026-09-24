import PanelCard from '@/Components/PanelCard';
import MemberPageHero, { MemberHeroLink } from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
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

const defaultBonza = {
    program_name: 'Affiliate Booster',
    program_subtitle: 'Affiliate Booster (+2% ROI)',
    is_bonza: false,
    bonza_rank_at: null,
    has_roi_bonus: false,
    bonza_direct_bonus_at: null,
    id_activated_at: null,
    activation_hold_usd: null,
    is_activated: false,
    required_directs: 2,
    qualified_direct_count: 0,
    qualified_directs: [],
    direct_window_days: 7,
    bonanza_window_ends_at: null,
    direct_monthly_bonus_percent: 2,
    sponsor_requirements_met: false,
};

export default function Bonza({ bonza: bonzaProp = {} }) {
    const b = { ...defaultBonza, ...bonzaProp };
    const hasBonus = b.has_roi_bonus || b.bonza_direct_bonus_at;

    return (
        <AuthenticatedLayout
            pageTitle="Affiliate Booster"
            memberSurface="race"
            showMobileFintechNav
            mobileFintechPageTitle="Booster"
        >
            <Head title="Affiliate Booster" />

            <MemberPageShell contentClassName="space-y-5 sm:space-y-6">
                <MemberPageHero
                    kicker={b.program_subtitle}
                    title={b.is_bonza ? 'Affiliate Booster unlocked' : 'Affiliate Booster'}
                    variant="violet"
                    icon="bonza"
                >
                    {b.is_activated ? (
                        <>
                            Activate <strong className="text-white">{b.required_directs} direct referrals</strong> within{' '}
                            <strong className="text-white">{b.direct_window_days} days</strong> of your activation, each with
                            the <strong className="text-white">same hold amount or more</strong> than yours (
                            {b.activation_hold_usd ? formatUsd(b.activation_hold_usd) : 'your activation package'}). You earn{' '}
                            <strong className="text-white">+{b.direct_monthly_bonus_percent}% extra monthly ROI</strong> on
                            whatever ROI you are earning (paid daily with your plan).
                        </>
                    ) : (
                        <>
                            First activate your member ID with a package investment. Then help{' '}
                            <strong className="text-white">{b.required_directs} directs</strong> activate within{' '}
                            <strong className="text-white">{b.direct_window_days} days</strong> of your activation — each at
                            your hold amount or higher — to unlock{' '}
                            <strong className="text-white">+{b.direct_monthly_bonus_percent}% monthly ROI</strong>.
                        </>
                    )}
                </MemberPageHero>

                <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
                    <PanelCard title="Your activation hold" icon="investment">
                        {b.is_activated ? (
                            <>
                                <p className="text-2xl font-bold text-fintech-ink">
                                    {b.activation_hold_usd ? formatUsd(b.activation_hold_usd) : '—'}
                                </p>
                                <p className="mt-1 text-sm text-fintech-muted">
                                    Activated{' '}
                                    {b.id_activated_at ? new Date(b.id_activated_at).toLocaleDateString() : '—'}
                                </p>
                                {b.bonanza_window_ends_at ? (
                                    <p className="mt-1 text-[11px] text-fintech-muted">
                                        Booster window ends{' '}
                                        {new Date(b.bonanza_window_ends_at).toLocaleDateString()}
                                    </p>
                                ) : null}
                            </>
                        ) : (
                            <>
                                <p className="text-sm text-fintech-muted">Activate your ID with your first investment.</p>
                                <MemberHeroLink href={route('investment')} className="mt-3">
                                    Invest now →
                                </MemberHeroLink>
                            </>
                        )}
                    </PanelCard>

                    <PanelCard title="Qualifying direct activations" icon="user-plus">
                        <p className="text-2xl font-bold text-fintech-ink">
                            {b.qualified_direct_count} / {b.required_directs}
                        </p>
                        <p className="mt-1 text-sm text-fintech-muted">
                            Each direct must activate within {b.direct_window_days} days of your activation with hold ≥
                            yours
                        </p>
                        <MemberHeroLink href={route('team')} className="mt-3">
                            View team →
                        </MemberHeroLink>
                    </PanelCard>
                </div>

                {hasBonus ? (
                    <PanelCard title="Your +2% ROI bonus" icon="bonza" className="border-emerald-200/80 bg-emerald-50/50">
                        <p className="text-sm text-emerald-200">
                            You receive <strong>+{b.direct_monthly_bonus_percent}% extra monthly ROI</strong> on your active
                            investment plan (credited daily with trading ROI). Active since{' '}
                            {b.bonza_direct_bonus_at
                                ? new Date(b.bonza_direct_bonus_at).toLocaleString()
                                : '—'}
                            .
                        </p>
                        <Link
                            href={route('transactions', { income: 'bonza_rank' })}
                            className="mt-2 inline-block text-sm font-semibold text-[#2563EB] hover:underline"
                        >
                            Booster bonus ledger →
                        </Link>
                    </PanelCard>
                ) : null}

                {b.is_bonza ? (
                    <PanelCard title="Affiliate Booster achieved" icon="rank" className="border-violet-200/80 bg-violet-50/40">
                        <p className="text-sm text-violet-950">
                            Congratulations — <strong>Affiliate Booster</strong> unlocked
                            {b.bonza_rank_at ? ` since ${new Date(b.bonza_rank_at).toLocaleString()}` : ''}.
                        </p>
                    </PanelCard>
                ) : b.sponsor_requirements_met ? (
                    <PanelCard title="Requirements met" className="border-amber-200/80 bg-amber-50/40">
                        <p className="text-sm text-amber-950">All rules satisfied — bonus will apply on the next check.</p>
                    </PanelCard>
                ) : null}

                {b.qualified_directs?.length > 0 ? (
                    <PanelCard title="Qualifying directs" className="border-fintech-line">
                        <ul className="divide-y divide-fintech-line text-sm">
                            {b.qualified_directs.map((d) => (
                                <li key={d.id} className="flex flex-wrap justify-between gap-2 py-2">
                                    <span className="font-medium text-fintech-ink">{d.name}</span>
                                    <span className="font-mono text-fintech-muted">
                                        {d.member_code} · hold {formatUsd(d.activation_hold_usd)}
                                        {d.activated_at
                                            ? ` · ${new Date(d.activated_at).toLocaleDateString()}`
                                            : ''}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </PanelCard>
                ) : null}

                <p className="text-[11px] leading-relaxed text-fintech-muted sm:text-xs">
                    <strong className="text-fintech-ink">Affiliate Booster</strong> — +2% monthly ROI on your plan when unlocked. Levels do
                    not stack — each direct must meet the full hold rule on their own activation. Bonus is on{' '}
                    <strong className="text-fintech-ink">your</strong> plan ROI only.
                </p>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
