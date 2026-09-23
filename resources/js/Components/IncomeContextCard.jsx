import { Link, usePage } from '@inertiajs/react';

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

/**
 * Shows one income program summary + links (from incomeHub.programs).
 */
export default function IncomeContextCard({ incomeKey, className = '' }) {
    const { incomeHub } = usePage().props;
    const row = incomeHub?.programs?.find((p) => p.key === incomeKey);
    if (!row) {
        return null;
    }

    return (
        <div
            className={`rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3 text-xs text-slate-700 sm:text-sm ${className}`}
        >
            <p className="font-semibold text-[#0F172A]">{row.label}</p>
            <p className="mt-1 text-slate-600">{row.trigger}</p>
            <p className="mt-2 font-mono text-sm font-bold text-emerald-700">
                Earned: {formatUsd2(row.amount_usd)}
                {row.count > 0 ? ` · ${row.count} credit(s)` : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
                <Link href={row.href} className="font-semibold text-[#2563EB] hover:underline">
                    Program page →
                </Link>
                <Link href={row.ledger_href} className="font-semibold text-[#2563EB] hover:underline">
                    Ledger entries →
                </Link>
                <Link href={route('dashboard')} className="font-semibold text-slate-500 hover:underline">
                    Dashboard
                </Link>
            </div>
        </div>
    );
}
