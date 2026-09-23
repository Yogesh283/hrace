import MemberPageHero from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import MemberTableScroll from '@/Components/Member/MemberTableScroll';
import PanelCard from '@/Components/PanelCard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

function formatUsd(n) {
    const v = Number(n);
    if (Number.isNaN(v)) return '—';
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    }).format(v);
}

export default function VirtualIncomeWallet({
    summary = {
        available_balance_usd: '0.0000',
        today_income_usd: '0.0000',
        total_claimed_usd: '0.0000',
        total_compounded_usd: '0.0000',
        total_withdrawn_usd: '0.0000',
    },
    history = [],
    on_chain_history = [],
    on_chain_income = { enabled: false, authoritative: false, contract: '', settlement_token: '' },
    blockchain_only = false,
    rewards_engine = 'hybrid',
}) {
    return (
        <AuthenticatedLayout
            pageTitle="Virtual Income Wallet"
            memberSurface="race"
            showMobileFintechNav
            mobileFintechPageTitle="Income"
        >
            <Head title="Virtual Income Wallet" />

            <MemberPageShell contentClassName="space-y-5 sm:space-y-6">
                <MemberPageHero
                    kicker="Earned income"
                    title="Virtual Income Wallet"
                    variant="pdf"
                    icon="wallet"
                >
                    Combined platform income (USDT-notional). Not on-chain RACE until you compound or receive an
                    authorized mint. Withdrawals apply Team Reward + Admin Fee when funds leave the platform.
                </MemberPageHero>

                {blockchain_only ? (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                        Rewards engine is <strong>blockchain_only</strong> ({rewards_engine}). Laravel virtual accrual
                        and claim are disabled — use on-chain staking rewards. This page is read-only for history.
                    </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <PanelCard
                        title={on_chain_income.authoritative ? 'On-chain income balance' : 'Available balance'}
                        icon="wallet"
                        className="!p-4"
                    >
                        <p className="mt-1 text-2xl font-bold text-fintech-ink">
                            {formatUsd(summary.available_balance_usd)}
                        </p>
                        {on_chain_income.authoritative ? (
                            <p className="mt-2 text-xs text-fintech-muted">
                                Authoritative ledger: RaceIncomeVault ({on_chain_income.contract || 'not deployed'})
                            </p>
                        ) : null}
                    </PanelCard>
                    <PanelCard title="Today&apos;s income" icon="investment" className="!p-4">
                        <p className="mt-1 text-2xl font-bold text-fintech-ink">
                            {formatUsd(summary.today_income_usd)}
                        </p>
                    </PanelCard>
                    <PanelCard title="Total claimed" icon="payout" className="!p-4">
                        <p className="mt-1 text-2xl font-bold text-fintech-ink">
                            {formatUsd(summary.total_claimed_usd)}
                        </p>
                    </PanelCard>
                    <PanelCard title="Total compounded" icon="swap" className="!p-4">
                        <p className="mt-1 text-2xl font-bold text-fintech-ink">
                            {formatUsd(summary.total_compounded_usd)}
                        </p>
                    </PanelCard>
                    <PanelCard title="Total withdrawn (gross)" icon="withdrawal" className="!p-4">
                        <p className="mt-1 text-2xl font-bold text-fintech-ink">
                            {formatUsd(summary.total_withdrawn_usd)}
                        </p>
                    </PanelCard>
                </div>

                <p className="text-sm text-fintech-muted">
                    <Link href={route('investment')} className="font-semibold text-sky-700 hover:underline">
                        Claim accrued rewards
                    </Link>
                    {' · '}
                    <Link href={route('withdrawal')} className="font-semibold text-sky-700 hover:underline">
                        Withdraw off-platform
                    </Link>
                </p>

                <PanelCard title="Income history" icon="transactions">
                    {history.length === 0 ? (
                        <p className="text-sm text-fintech-muted">No income ledger entries yet.</p>
                    ) : (
                        <MemberTableScroll>
                            <table className="w-full min-w-[28rem] text-left text-xs sm:text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 text-fintech-muted">
                                        <th className="px-3 py-2 font-semibold">When</th>
                                        <th className="px-3 py-2 font-semibold">Type</th>
                                        <th className="px-3 py-2 font-semibold">Direction</th>
                                        <th className="px-3 py-2 font-semibold text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((row) => (
                                        <tr key={row.id} className="border-b border-slate-100">
                                            <td className="px-3 py-2">
                                                {row.created_at
                                                    ? new Date(row.created_at).toLocaleString()
                                                    : '—'}
                                            </td>
                                            <td className="px-3 py-2">{row.type_label ?? row.type}</td>
                                            <td className="px-3 py-2 uppercase">{row.direction}</td>
                                            <td className="px-3 py-2 text-right font-mono">
                                                {formatUsd(row.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </MemberTableScroll>
                    )}
                </PanelCard>

                {on_chain_income.enabled && on_chain_history.length > 0 ? (
                    <PanelCard title="On-chain income ledger (indexed)" icon="transactions">
                        <MemberTableScroll>
                            <table className="w-full min-w-[32rem] text-left text-xs sm:text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 text-fintech-muted">
                                        <th className="px-3 py-2 font-semibold">Event</th>
                                        <th className="px-3 py-2 font-semibold">Tx</th>
                                        <th className="px-3 py-2 font-semibold text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {on_chain_history.map((row, idx) => (
                                        <tr key={`${row.tx_hash}-${idx}`} className="border-b border-slate-100">
                                            <td className="px-3 py-2">{row.event_name}</td>
                                            <td className="px-3 py-2 font-mono text-[11px]">
                                                {row.tx_hash ? `${row.tx_hash.slice(0, 10)}…` : '—'}
                                                {row.block_number ? ` · #${row.block_number}` : ''}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono">
                                                {formatUsd(row.net_amount ?? row.amount ?? 0)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </MemberTableScroll>
                    </PanelCard>
                ) : null}
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
