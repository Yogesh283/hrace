import MemberPageHero from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import MemberStatCard from '@/Components/Member/MemberStatCard';
import MemberTableScroll from '@/Components/Member/MemberTableScroll';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';

function typeLabel(entryType, typeLabels) {
    return typeLabels?.[entryType] ?? entryType ?? '—';
}

function formatUsd(n, withSign = false) {
    const v = Number(n);
    if (Number.isNaN(v)) {
        return '—';
    }
    // Use 4 decimal places for small amounts (e.g. $0.0033 network ROI),
    // otherwise keep standard 2 decimal places.
    const decimals = v !== 0 && Math.abs(v) < 0.01 ? 4 : 2;
    const abs = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: 8,
    }).format(Math.abs(v));
    if (!withSign) {
        return abs;
    }
    if (v > 0) {
        return `+ ${abs}`;
    }
    if (v < 0) {
        return `− ${abs}`;
    }
    return abs;
}

function formatRace(n) {
    const v = Number(n);
    if (Number.isNaN(v)) {
        return '—';
    }
    return `${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(v)} RACE`;
}

function isRaceRow(row) {
    return row?.asset === 'RACE';
}

function RowAmount({ row, align = 'right' }) {
    if (isRaceRow(row)) {
        return (
            <div className={align === 'right' ? 'text-right' : ''}>
                <p className="font-mono text-sm font-bold tabular-nums text-emerald-600">+ {formatRace(row.amount_race)}</p>
                <p className="font-mono text-[11px] font-medium tabular-nums text-slate-500">
                    ≈ {formatUsd(row.amount_usd)} USDT
                </p>
            </div>
        );
    }
    const pos = Number(row.amount_usd) >= 0;
    return (
        <p
            className={`font-mono text-sm font-bold tabular-nums ${pos ? 'text-emerald-600' : 'text-red-600'} ${
                align === 'right' ? 'text-right' : ''
            }`}
        >
            {formatUsd(row.amount_usd, true)}
        </p>
    );
}

function FromMember({ row }) {
    if (!row.from_member) {
        return null;
    }
    return (
        <span className="mt-1 inline-flex rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
            From: {row.from_member}
        </span>
    );
}

function formatRowDate(createdAt, { dateOnly = false } = {}) {
    if (!createdAt) {
        return '—';
    }
    const d = new Date(createdAt);
    if (dateOnly) {
        return d.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    }
    return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function transactionQueryParams(filter_income_key, date) {
    const params = {};
    if (filter_income_key) {
        params.income = filter_income_key;
    }
    if (date) {
        params.date = date;
    }
    return params;
}

function navigateTransactions(filter_income_key, date) {
    router.get(route('transactions'), transactionQueryParams(filter_income_key, date), {
        preserveScroll: true,
        preserveState: true,
    });
}

function DateFilterBar({
    filter_date,
    filter_date_label,
    max_date,
    filter_income_key,
    day_total_usd,
    rowCount,
}) {
    const isToday = filter_date === max_date;
    const isAllDates = filter_date === 'all';
    const dateInputValue = isAllDates ? max_date : filter_date;

    return (
        <div className="rounded-xl border border-fintech-line bg-white p-3 shadow-sm sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="text-[0.65rem] font-bold uppercase tracking-wide text-fintech-muted">
                        Select date
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-fintech-ink">
                        {filter_date_label ?? 'Today'}
                        {!isAllDates && day_total_usd != null ? (
                            <span className="ml-2 font-mono text-xs font-bold text-emerald-600">
                                +{formatUsd(day_total_usd)}
                            </span>
                        ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-fintech-muted">
                        {isAllDates
                            ? 'Showing latest activity (up to 200 rows)'
                            : `${rowCount} transaction${rowCount === 1 ? '' : 's'} on this day`}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor="transactions-date">
                        Transaction date
                    </label>
                    <input
                        id="transactions-date"
                        type="date"
                        value={dateInputValue}
                        max={max_date}
                        onChange={(e) => {
                            if (e.target.value) {
                                navigateTransactions(filter_income_key, e.target.value);
                            }
                        }}
                        className="min-h-[2.5rem] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-fintech-ink shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    {!isToday && !isAllDates ? (
                        <button
                            type="button"
                            onClick={() => navigateTransactions(filter_income_key, max_date)}
                            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800 transition hover:bg-sky-100"
                        >
                            Today
                        </button>
                    ) : null}
                    {!isAllDates ? (
                        <button
                            type="button"
                            onClick={() => navigateTransactions(filter_income_key, 'all')}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                        >
                            All dates
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => navigateTransactions(filter_income_key, max_date)}
                            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800 transition hover:bg-sky-100"
                        >
                            Today only
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function TransactionRowMobile({ row, typeLabels }) {
    return (
        <div className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {formatRowDate(row.created_at, { dateOnly: true })}
                    </p>
                    <p className="mt-1 text-[13px] font-semibold leading-snug text-fintech-ink">
                        {row.income_name ?? typeLabel(row.entry_type, typeLabels)}
                    </p>
                    <div className="flex flex-wrap items-center gap-1">
                        {row.level_label ? (
                            <span className="mt-1 inline-flex rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-800">
                                {row.level_label}
                            </span>
                        ) : null}
                        <FromMember row={row} />
                    </div>
                    {row.detail && !row.from_member ? (
                        <p className="mt-1 text-xs leading-snug text-slate-500">{row.detail}</p>
                    ) : null}
                </div>
                <div className="shrink-0">
                    <RowAmount row={row} />
                </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-400">
                {formatRowDate(row.created_at)}
                {row.balance_after_usd != null ? ` · Bal ${formatUsd(row.balance_after_usd)}` : ''}
                {row.tx_url ? (
                    <>
                        {' · '}
                        <a href={row.tx_url} target="_blank" rel="noreferrer" className="font-semibold text-sky-600 hover:underline">
                            View tx
                        </a>
                    </>
                ) : null}
            </p>
        </div>
    );
}

export default function Transactions({
    entries = [],
    filter_income_key = null,
    filter_label = null,
    total_earnings_usd = '0.00',
    filtered_earnings_usd = null,
    filter_date = null,
    filter_date_label = 'Today',
    max_date = null,
    day_total_usd = null,
    race_level_income = null,
}) {
    const { incomeHub } = usePage().props;
    const typeLabels = incomeHub?.type_labels ?? {};
    const lifetimeTotal = total_earnings_usd || incomeHub?.total_income_usd || '0.00';
    const displayTotal = filter_income_key && filtered_earnings_usd != null ? filtered_earnings_usd : lifetimeTotal;
    const todayDate = max_date || new Date().toISOString().slice(0, 10);
    const activeDate = filter_date ?? todayDate;

    return (
        <AuthenticatedLayout
            pageTitle={filter_income_key ? 'Transactions' : 'Total Earnings'}
            memberSurface="race"
            showMobileFintechNav
            mobileFintechPageTitle="Earnings"
        >
            <Head title={filter_income_key ? 'Transactions' : 'Total Earnings'} />

            <MemberPageShell contentClassName="space-y-5 sm:space-y-6">
                <MemberPageHero
                    kicker={filter_income_key ? 'Earnings ledger' : 'Lifetime · all reward types'}
                    title={filter_income_key ? filter_label ?? 'Transaction history' : 'Total Earnings'}
                    variant="pdf"
                    icon="transactions"
                >
                    {filter_income_key
                        ? `Credits for ${filter_label ?? 'this program'} — activity below.`
                        : 'Sum of all rewards credited to your account to date (excludes wallet deposits).'}
                </MemberPageHero>

                <MemberStatCard
                    label={filter_income_key ? 'Total earned (this type)' : 'Total earned till today'}
                    value={formatUsd(displayTotal)}
                    hint={
                        filter_income_key
                            ? `Lifetime all types: ${formatUsd(lifetimeTotal)}`
                            : 'All ROI, referral, bonus and rewards combined'
                    }
                    icon="transactions"
                />

                {race_level_income && Number(race_level_income.race) > 0 ? (
                    <MemberStatCard
                        label="Level income received (RACE coin)"
                        value={formatRace(race_level_income.race)}
                        hint={`≈ ${formatUsd(race_level_income.usdt)} USDT value · RACE is credited straight to your wallet at stake time`}
                        icon="transactions"
                    />
                ) : null}

                <DateFilterBar
                    filter_date={activeDate}
                    filter_date_label={filter_date_label}
                    max_date={todayDate}
                    filter_income_key={filter_income_key}
                    day_total_usd={day_total_usd}
                    rowCount={entries.length}
                />

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
                    <p className="max-w-2xl text-xs leading-relaxed text-fintech-muted sm:text-sm">
                        {filter_label
                            ? `Ledger for: ${filter_label}.`
                            : activeDate === 'all'
                              ? 'All reward and wallet activity below.'
                              : `Activity for ${filter_date_label ?? 'selected day'}.`}
                    </p>
                    <span className="w-fit shrink-0 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-blue-600">
                        {entries.length} row{entries.length === 1 ? '' : 's'}
                    </span>
                </div>

                {filter_income_key ? (
                    <p className="mb-3 text-xs sm:mb-4">
                        <Link href={route('transactions')} className="font-semibold text-[#2563EB] hover:underline">
                            ← Show all transactions
                        </Link>
                    </p>
                ) : (
                    <p className="mb-3 text-xs text-fintech-muted sm:mb-4">
                        Tap a reward type above to filter, or open Dashboard for summaries.
                    </p>
                )}

                <div className="overflow-hidden rounded-xl border border-fintech-line bg-white shadow-sm">
                    {entries.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm text-fintech-muted">
                            {activeDate === 'all'
                                ? 'No transactions yet.'
                                : `No transactions on ${filter_date_label ?? 'this date'}.`}
                        </p>
                    ) : (
                        <>
                            <div className="divide-y divide-fintech-line md:hidden">
                                {entries.map((r) => (
                                    <TransactionRowMobile key={r.id} row={r} typeLabels={typeLabels} />
                                ))}
                            </div>

                            <div className="hidden md:block">
                                <MemberTableScroll>
                                    <table className="transactions-ledger-table w-full divide-y divide-fintech-line text-left text-xs text-fintech-muted md:text-sm">
                                        <thead className="bg-fintech-soft text-left text-[0.65rem] font-semibold uppercase tracking-wide text-fintech-muted sm:text-xs">
                                            <tr>
                                                <th className="px-4 py-3">Date</th>
                                                <th className="hidden px-4 py-3 lg:table-cell">ID</th>
                                                <th className="px-4 py-3">Type</th>
                                                <th className="hidden px-4 py-3 lg:table-cell">Details</th>
                                                <th className="px-4 py-3">Amount</th>
                                                <th className="hidden px-4 py-3 xl:table-cell">Balance after</th>
                                                <th className="hidden px-4 py-3 xl:table-cell">Reference</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-fintech-line text-fintech-muted">
                                            {entries.map((r) => {
                                                return (
                                                    <tr key={r.id} className="hover:bg-fintech-soft/80">
                                                        <td className="whitespace-nowrap px-4 py-3 text-fintech-muted">
                                                            {formatRowDate(r.created_at)}
                                                        </td>
                                                        <td className="hidden px-4 py-3 font-mono text-xs font-medium text-fintech-ink lg:table-cell">
                                                            #{r.id}
                                                        </td>
                                                        <td className="max-w-[14rem] px-4 py-3">
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <span className="font-medium text-fintech-ink">
                                                                    {r.income_name ?? typeLabel(r.entry_type, typeLabels)}
                                                                </span>
                                                                {r.level_label ? (
                                                                    <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800">
                                                                        {r.level_label}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                        <td className="hidden max-w-[14rem] px-4 py-3 text-xs leading-snug text-slate-600 lg:table-cell">
                                                            {r.from_member ? (
                                                                <span className="font-semibold text-amber-800">From: {r.from_member}</span>
                                                            ) : (
                                                                r.detail ?? '—'
                                                            )}
                                                        </td>
                                                        <td className="whitespace-nowrap px-4 py-3">
                                                            <RowAmount row={r} align="left" />
                                                        </td>
                                                        <td className="hidden whitespace-nowrap px-4 py-3 text-fintech-ink xl:table-cell">
                                                            {r.balance_after_usd != null ? formatUsd(r.balance_after_usd) : '—'}
                                                        </td>
                                                        <td className="hidden max-w-[8rem] truncate px-4 py-3 font-mono text-xs text-fintech-muted xl:table-cell">
                                                            {r.tx_url ? (
                                                                <a
                                                                    href={r.tx_url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="font-semibold text-sky-600 hover:underline"
                                                                >
                                                                    View tx
                                                                </a>
                                                            ) : r.reference_type && r.reference_id ? (
                                                                `${r.reference_type} #${r.reference_id}`
                                                            ) : (
                                                                '—'
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </MemberTableScroll>
                            </div>
                        </>
                    )}
                </div>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
