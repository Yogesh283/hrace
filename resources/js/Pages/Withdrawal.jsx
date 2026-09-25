import PrimaryButton from '@/Components/PrimaryButton';
import PanelCard from '@/Components/PanelCard';
import TextInput from '@/Components/TextInput';
import MemberAlert from '@/Components/Member/MemberAlert';
import MemberPageHero from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import MemberTableScroll from '@/Components/Member/MemberTableScroll';
import IncomeHoldWithdrawCard from '@/Components/IncomeHoldWithdrawCard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

const USDT_NETWORK = 'BEP20 (BNB Smart Chain)';

function formatUsdtBalance(n) {
    const s = new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number.isFinite(n) ? n : 0);
    return `${s} USDT`;
}

function formatRowDate(createdAt) {
    if (!createdAt) {
        return '—';
    }
    return new Date(createdAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function statusBadgeClass(status) {
    switch (status) {
        case 'completed':
            return 'bg-emerald-100 text-emerald-800';
        case 'rejected':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-amber-100 text-amber-900';
    }
}

function formatCountdown(ms) {
    if (ms <= 0) {
        return '00:00:00';
    }
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function useReverseCountdown(isoTarget) {
    const [remainingMs, setRemainingMs] = useState(() => {
        if (!isoTarget) return 0;
        return Math.max(0, new Date(isoTarget).getTime() - Date.now());
    });

    useEffect(() => {
        if (!isoTarget) {
            setRemainingMs(0);
            return undefined;
        }
        const tick = () => {
            setRemainingMs(Math.max(0, new Date(isoTarget).getTime() - Date.now()));
        };
        tick();
        const id = window.setInterval(tick, 1000);
        return () => window.clearInterval(id);
    }, [isoTarget]);

    return remainingMs;
}

function WithdrawalRowMobile({ row }) {
    return (
        <div className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {formatRowDate(row.created_at)}
                    </p>
                    <p className="mt-1 font-mono text-sm font-bold text-fintech-ink">#{row.id}</p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fintech-muted">
                        <span>
                            Gross: <strong className="text-fintech-ink">{formatUsdtBalance(row.amount_usd)}</strong>
                        </span>
                        <span>
                            Net: <strong className="text-fintech-ink">{formatUsdtBalance(row.net_usd)}</strong>
                        </span>
                    </div>
                </div>
                <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(row.status)}`}
                >
                    {row.status_label ?? row.status}
                </span>
            </div>
        </div>
    );
}

export default function Withdrawal({
    race_level_income = null,
    balance_usd = '0.00',
    income_policy = {
        accrued_reward_usd: '0.0000',
        virtual_income_usd: '0.00',
        can_claim: false,
        next_claim_at: null,
    },
    wallet_address = null,
    withdrawal_fee = {
        min_amount_usd: '1.00',
        percent: '10.00',
        team_reward_percent: '10.00',
        mode: 'dual',
        destination: 'community_team_rewards',
        flat_fee_usd: '1.00',
        flat_fee_max_gross_usd: '99.99',
        percent_from_usd: '100.00',
        admin_fee_percent: '1.00',
    },
    admin_wallet = { address: '', network: 'BEP20 (BNB Smart Chain)' },
    withdrawals_disabled = false,
    rate_limit = {
        enabled: true,
        max_per_window: 2,
        window_hours: 24,
        used_in_window: 0,
        remaining: 2,
        can_request: true,
        next_available_at: null,
        slot_frees_at: [],
    },
    withdrawals = [],
}) {
    const { auth, flash, blockchain } = usePage().props;
    const raceOnlyIncome = Boolean(blockchain?.blockchain_only);
    const withdrawalAddressLocked = Boolean((wallet_address ?? auth?.user?.wallet_address ?? '').trim());
    const walletBalance = Number(
        balance_usd ?? auth?.user?.user_wallet?.balance_usd ?? auth?.user?.balance_usd ?? 0,
    );
    const percent = Number(withdrawal_fee.team_reward_percent ?? withdrawal_fee.percent) || 10;
    const adminFlat = Number(withdrawal_fee.flat_fee_usd) || 1;
    const adminPercentFrom = Number(withdrawal_fee.percent_from_usd) || 100;
    const adminPercent = Number(withdrawal_fee.admin_fee_percent) || 1;
    const adminAddress = (admin_wallet?.address || '').trim();
    const adminNetwork = admin_wallet?.network || 'BEP20 (BNB Smart Chain)';

    const rateLimited = Boolean(rate_limit?.enabled && !rate_limit?.can_request);
    const countdownMs = useReverseCountdown(rateLimited ? rate_limit?.next_available_at : null);
    const formBlocked = withdrawals_disabled || rateLimited;

    const { data, setData, post, processing, errors, reset } = useForm({
        amount_usd: '',
        destination_address: wallet_address ?? '',
    });

    const gross = Number(data.amount_usd) || 0;
    const teamReward = gross > 0 ? (gross * percent) / 100 : 0;
    const adminFee =
        gross > 0 ? (gross < adminPercentFrom ? adminFlat : (gross * adminPercent) / 100) : 0;
    const net = gross > 0 ? gross - teamReward - adminFee : 0;

    const submit = (e) => {
        e.preventDefault();
        if (formBlocked) {
            return;
        }
        post(route('withdrawals.store'), {
            preserveScroll: true,
            onSuccess: () => reset('amount_usd'),
        });
    };

    return (
        <AuthenticatedLayout
            pageTitle="Income wallet"
            memberSurface="race"
            showMobileFintechNav
            mobileFintechPageTitle="Income wallet"
        >
            <Head title="Income wallet" />

            <MemberPageShell contentClassName="space-y-5 sm:space-y-6">
                {raceOnlyIncome ? (
                    <>
                        <MemberPageHero kicker="Income wallet" title="Bring income to your wallet" variant="pdf" icon="withdrawal">
                            Held income shows here. One tap sends it to your wallet.
                        </MemberPageHero>
                        <div className="mx-auto w-full min-w-0 max-w-lg">
                            <IncomeHoldWithdrawCard raceLevelIncome={race_level_income} />
                        </div>
                    </>
                ) : (
                <>
                <MemberPageHero kicker="Income wallet" title="Bring income to your wallet" variant="pdf" icon="withdrawal">
                    Bring held RACE here. The USDT form below is separate.
                </MemberPageHero>

                <div className="mx-auto w-full min-w-0 max-w-lg">
                    <IncomeHoldWithdrawCard raceLevelIncome={race_level_income} />
                </div>

                <div className="mx-auto w-full min-w-0 max-w-lg">
                    {flash?.status ? (
                        <MemberAlert variant="success" className="mb-3">
                            {flash.status}
                        </MemberAlert>
                    ) : null}
                    {flash?.error ? (
                        <MemberAlert variant="error" className="mb-3">
                            {flash.error}
                        </MemberAlert>
                    ) : null}

                    {withdrawals_disabled ? (
                        <MemberAlert variant="warning" className="mb-3">
                            Withdrawals are temporarily disabled for your account. Please contact support.
                        </MemberAlert>
                    ) : null}

                    {rate_limit?.enabled ? (
                        <div
                            className={`mb-3 rounded-lg border px-3 py-2.5 text-xs sm:text-sm ${
                                rateLimited
                                    ? 'border-amber-400/70 bg-amber-950/50 text-amber-100'
                                    : 'border-sky-400/50 bg-[#0a1838]/80 text-sky-100'
                            }`}
                        >
                            <p className="font-semibold">
                                Withdrawal limit: {rate_limit.used_in_window ?? 0} /{' '}
                                {rate_limit.max_per_window ?? 2} used in last{' '}
                                {rate_limit.window_hours ?? 24}h
                                {!rateLimited ? (
                                    <span className="font-normal text-sky-200/90">
                                        {' '}
                                        · {rate_limit.remaining ?? 0} left
                                    </span>
                                ) : null}
                            </p>
                            {rateLimited ? (
                                <p className="mt-2 font-mono text-lg font-bold tracking-wider text-amber-100 sm:text-xl">
                                    Next in {formatCountdown(countdownMs)}
                                </p>
                            ) : null}
                            {Array.isArray(rate_limit.slot_frees_at) && rate_limit.slot_frees_at.length > 0 ? (
                                <ul className="mt-2 space-y-0.5 text-[11px] text-sky-300/80 sm:text-xs">
                                    {rate_limit.slot_frees_at.map((iso, i) => (
                                        <li key={`${iso}-${i}`}>
                                            Slot {i + 1} frees:{' '}
                                            {new Date(iso).toLocaleString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                    ) : null}

                    <p className="mb-3 rounded-lg border border-sky-400/50 bg-[#0a1838]/80 px-3 py-2 text-xs leading-relaxed text-sky-100 sm:text-sm">
                        <span className="font-semibold text-sky-50">Income withdrawal:</span> {percent}% Team Reward (L1–L10)
                        plus separate Admin Fee (${adminFlat} if under ${adminPercentFrom}; {adminPercent}% at $
                        {adminPercentFrom}+). After approval, <strong className="text-white">net USDT</strong> is sent to your BEP20
                        address. Separate from fixed-stake maturity / EMI.
                    </p>
                    {adminAddress ? (
                        <p className="mb-3 break-all rounded-lg border-2 border-amber-400/70 bg-amber-950/50 px-3 py-2 text-[11px] text-amber-100 sm:text-xs">
                            <span className="font-semibold text-amber-200">
                                Admin / Treasury wallet ({adminNetwork}):
                            </span>{' '}
                            <span className="font-mono font-bold text-amber-50">{adminAddress}</span>
                        </p>
                    ) : null}

                    <div className="mb-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-fintech-line bg-white px-3 py-2.5 shadow-sm sm:px-4 sm:py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-fintech-primary">
                                Accrued reward (unclaimed)
                            </p>
                            <p className="mt-1 break-words text-lg font-bold text-fintech-ink sm:text-xl">
                                {formatUsdtBalance(Number(income_policy?.accrued_reward_usd ?? 0))}
                            </p>
                            <p className="mt-1 text-[11px] text-fintech-muted">
                                Claim on Staking page — no Admin Fee on claim.
                            </p>
                        </div>
                        <div className="rounded-xl border border-fintech-line bg-white px-3 py-2.5 shadow-sm sm:px-4 sm:py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-fintech-primary">
                                Virtual income (withdrawable)
                            </p>
                            <p className="mt-1 break-words text-xl font-bold text-fintech-ink sm:text-2xl">
                                {formatUsdtBalance(walletBalance)}
                            </p>
                            <p className="mt-1 text-[11px] text-fintech-muted">
                                Admin Fee + Team Reward apply only when you withdraw off-platform.
                            </p>
                        </div>
                    </div>

                    <PanelCard title="Request USDT payout" icon="payout">
                        <p className="mb-6 text-sm text-fintech-muted">
                            Enter the gross USDT amount (deducted from your wallet). Operations send the net
                            amount to your BEP20 address.
                        </p>
                        <form onSubmit={submit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-fintech-ink">
                                    Amount (USDT) — gross
                                </label>
                                <TextInput
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    value={data.amount_usd}
                                    className="mt-2 block w-full"
                                    onChange={(e) => setData('amount_usd', e.target.value)}
                                    disabled={formBlocked}
                                />
                                {errors.amount_usd ? (
                                    <p className="mt-1 text-xs text-red-600">{errors.amount_usd}</p>
                                ) : null}
                                {gross > 0 ? (
                                    <p className="mt-2 text-xs text-fintech-muted">
                                        Team Reward ({percent}%):{' '}
                                        <strong>{formatUsdtBalance(teamReward)}</strong> · Admin Fee:{' '}
                                        <strong>{formatUsdtBalance(adminFee)}</strong> · Net withdrawal:{' '}
                                        <strong>{formatUsdtBalance(net)}</strong>
                                    </p>
                                ) : null}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-fintech-ink">
                                    USDT wallet address ({USDT_NETWORK})
                                </label>
                                <TextInput
                                    value={data.destination_address}
                                    className="mt-2 block w-full font-mono text-sm"
                                    placeholder="0x… your BEP20 USDT address"
                                    onChange={(e) => setData('destination_address', e.target.value)}
                                    readOnly={withdrawalAddressLocked}
                                    disabled={withdrawalAddressLocked || formBlocked}
                                    autoComplete="off"
                                />
                                {withdrawalAddressLocked ? (
                                    <p className="mt-1 text-xs text-fintech-muted">
                                        Fixed withdrawal address for your account (see Profile).
                                    </p>
                                ) : null}
                                {errors.destination_address ? (
                                    <p className="mt-1 text-xs text-red-600">{errors.destination_address}</p>
                                ) : null}
                            </div>
                            <PrimaryButton
                                type="submit"
                                className="mt-2 w-full justify-center border-red-500 bg-red-600 py-3 text-white hover:bg-red-500 focus:ring-red-400"
                                disabled={
                                    processing ||
                                    formBlocked ||
                                    !data.amount_usd ||
                                    !data.destination_address
                                }
                            >
                                {processing
                                    ? 'Processing…'
                                    : rateLimited
                                      ? `Wait ${formatCountdown(countdownMs)}`
                                      : 'Submit USDT withdrawal'}
                            </PrimaryButton>
                        </form>
                    </PanelCard>

                    <PanelCard title="Withdrawal history" icon="withdrawal" className="mt-5">
                        {withdrawals.length === 0 ? (
                            <p className="rx-empty">No withdrawal requests yet.</p>
                        ) : (
                            <div className="-mx-1 overflow-hidden rounded-xl border border-fintech-line bg-white sm:mx-0">
                                <div className="divide-y divide-fintech-line md:hidden">
                                    {withdrawals.map((row) => (
                                        <WithdrawalRowMobile key={row.id} row={row} />
                                    ))}
                                </div>

                                <div className="hidden md:block">
                                    <MemberTableScroll>
                                        <table className="w-full text-left text-xs text-fintech-muted sm:text-sm">
                                            <thead className="border-b border-fintech-line bg-fintech-soft text-[0.65rem] font-semibold uppercase tracking-wide sm:text-xs">
                                                <tr>
                                                    <th className="px-3 py-2.5">Date</th>
                                                    <th className="px-3 py-2.5">ID</th>
                                                    <th className="px-3 py-2.5">Gross</th>
                                                    <th className="px-3 py-2.5">Net</th>
                                                    <th className="px-3 py-2.5">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-fintech-line">
                                                {withdrawals.map((row) => (
                                                    <tr key={row.id} className="hover:bg-fintech-soft/80">
                                                        <td className="whitespace-nowrap px-3 py-2.5">
                                                            {formatRowDate(row.created_at)}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-fintech-ink">
                                                            #{row.id}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-2.5 font-medium text-fintech-ink">
                                                            {formatUsdtBalance(row.amount_usd)}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-2.5 text-fintech-ink">
                                                            {formatUsdtBalance(row.net_usd)}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-2.5">
                                                            <span
                                                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:text-xs ${statusBadgeClass(row.status)}`}
                                                            >
                                                                {row.status_label ?? row.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </MemberTableScroll>
                                </div>
                            </div>
                        )}
                    </PanelCard>
                </div>
                </>
                )}
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
