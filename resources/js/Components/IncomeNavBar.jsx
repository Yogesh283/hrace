import MemberIcon, { iconForIncomeKey } from '@/Components/Member/MemberIcon';
import { Link, usePage } from '@inertiajs/react';

function formatUsd(value) {
    const n = Number(value);
    if (Number.isNaN(n)) return '—';
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(n);
}

/**
 * Cross-links all income programs — data from shared incomeHub (ledger).
 */
export default function IncomeNavBar({ activeKey = null, className = '' }) {
    const incomeHub = usePage().props.incomeHub;
    if (!incomeHub?.programs?.length) {
        return null;
    }

    const pill =
        'race-pdf-nav-pill inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.65rem] font-semibold transition sm:text-xs';
    const idle = `${pill} race-pdf-nav-pill--idle`;
    const active = `${pill} race-pdf-nav-pill--active`;

    const NavPill = ({ href, iconName, isActive, children }) => (
        <Link href={href} className={isActive ? active : idle}>
            <MemberIcon name={iconName} className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-white' : 'text-[#2563EB]'}`} />
            <span>{children}</span>
        </Link>
    );

    return (
        <nav
            className={`mb-4 flex gap-2 overflow-x-auto overscroll-x-contain pb-1 sm:mb-5 ${className}`}
            aria-label="Reward programs"
        >
            <NavPill href={route('dashboard')} iconName="dashboard" isActive={activeKey === 'dashboard'}>
                All rewards
                {incomeHub.total_income_usd ? (
                    <span className="opacity-90">· {formatUsd(incomeHub.total_income_usd)}</span>
                ) : null}
            </NavPill>
            {incomeHub.programs.map((p) => (
                <NavPill key={p.key} href={p.href} iconName={iconForIncomeKey(p.key)} isActive={activeKey === p.key}>
                    {p.short_label}
                    {p.has_earned ? (
                        <span className={activeKey === p.key ? 'text-white/90' : 'text-emerald-600'}>
                            {formatUsd(p.amount_usd)}
                        </span>
                    ) : null}
                </NavPill>
            ))}
            <NavPill href={route('transactions')} iconName="transactions" isActive={activeKey === 'transactions'}>
                Full ledger
            </NavPill>
        </nav>
    );
}
