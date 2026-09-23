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

function ReadOnlyField({ label, value, mono = false, emptyText = '—', hint = null }) {
    const display = value != null && String(value).trim() !== '' ? value : emptyText;

    return (
        <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p
                className={`mt-1 rounded-xl border border-white/15 bg-[#0F172A]/55 px-3 py-2.5 text-sm text-slate-100 shadow-inner backdrop-blur-sm ${
                    mono ? 'break-all font-mono text-xs sm:text-sm' : 'font-medium'
                }`}
            >
                {display}
            </p>
            {hint ? <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{hint}</p> : null}
        </div>
    );
}

function StatCard({ label, value, tone = 'sky' }) {
    const tones = {
        emerald: {
            box: 'border-emerald-500/25 bg-emerald-500/10',
            label: 'text-emerald-300',
            value: 'text-emerald-200',
        },
        sky: {
            box: 'border-sky-500/25 bg-sky-500/10',
            label: 'text-sky-300',
            value: 'text-sky-200',
        },
    };
    const t = tones[tone] ?? tones.sky;

    return (
        <div className={`rounded-xl border px-4 py-3 backdrop-blur-sm ${t.box}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${t.label}`}>{label}</p>
            <p className={`mt-1 font-mono text-xl font-bold ${t.value}`}>{value}</p>
        </div>
    );
}

export default function ProfileInformationDisplay({ profile = {}, className = '' }) {
    const walletAddress = profile.wallet_address?.trim() || profile.withdrawal_address?.trim() || null;
    const showEmail = profile.show_email && profile.email?.trim();

    return (
        <section className={className}>
            <header>
                <h2 className="text-lg font-semibold text-white">Profile Information</h2>
                <p className="mt-1 text-sm text-slate-400">
                    Your account details are read-only. Contact support if something needs to change.
                </p>
            </header>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <ReadOnlyField label="Member ID" value={profile.member_id} mono />
                <ReadOnlyField label="Referral code" value={profile.referral_code} mono />
                <ReadOnlyField label="Name" value={profile.name} />
                {showEmail ? <ReadOnlyField label="Email" value={profile.email} /> : null}
                <div className={showEmail ? 'sm:col-span-2' : 'sm:col-span-2'}>
                    <ReadOnlyField
                        label="Connected wallet (BEP20)"
                        value={walletAddress}
                        mono
                        emptyText="Not connected"
                        hint={
                            walletAddress
                                ? undefined
                                : 'Connect your wallet on the Swap page to link it to your account.'
                        }
                    />
                </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <StatCard label="Total staking" value={formatUsd(profile.total_staking_usd)} tone="emerald" />
                <StatCard label="Total withdrawals" value={formatUsd(profile.total_withdrawals_usd)} tone="sky" />
            </div>
        </section>
    );
}
