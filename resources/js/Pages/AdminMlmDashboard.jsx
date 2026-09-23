import { Head, Link } from '@inertiajs/react';

const BLUE = '#3B82F6';
const EMERALD = '#10B981';
const SLATE_SIDEBAR = '#1E293B';
const NAVY = '#0F172A';

const menuItems = [
    { id: 'dash', label: 'Dashboard', icon: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75A2.25 2.25 0 0115.75 18h2.25A2.25 2.25 0 0120.25 15.75v-2.25a2.25 2.25 0 00-2.25-2.25H15.75a2.25 2.25 0 00-2.25 2.25v2.25zM6 13.5A2.25 2.25 0 018.25 15.75v2.25A2.25 2.25 0 016 20.25H3.75A2.25 2.25 0 011.5 18v-2.25A2.25 2.25 0 013.75 13.5H6z', active: true },
    { id: 'mem', label: 'Members', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
    { id: 'gen', label: 'Genealogy', icon: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6' },
    { id: 'com', label: 'Commissions', icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'rep', label: 'Reports', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' },
    { id: 'set', label: 'Settings', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z' },
];

function Glass({ className = '', children }) {
    return (
        <div
            className={`rounded-2xl border border-white/[0.08] bg-white/[0.045] shadow-[0_8px_32px_rgba(0,0,0,0.35)] shadow-black/25 backdrop-blur-2xl ring-1 ring-white/[0.04] ${className}`}
        >
            {children}
        </div>
    );
}

function IconPath({ d, className }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={d} />
        </svg>
    );
}

function Avatar({ name, sub, size = 'md', primary = false }) {
    const initials = name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    const sz = size === 'lg' ? 'h-[4.5rem] w-[4.5rem] text-lg' : size === 'sm' ? 'h-10 w-10 text-xs' : 'h-12 w-12 text-sm';
    const ring = primary
        ? 'border-blue-400/50 ring-4 ring-blue-500/35 ring-offset-2 ring-offset-slate-900/80 shadow-[0_0_28px_rgba(59,130,246,0.35)]'
        : 'border-white/15 ring-2 ring-blue-500/15';
    return (
        <div className="flex flex-col items-center gap-1.5">
            <div
                className={`flex ${sz} items-center justify-center rounded-full border-2 bg-gradient-to-br font-bold text-white shadow-lg ${primary ? 'from-blue-700 to-slate-900' : 'from-slate-600 to-slate-800'} ${ring}`}
            >
                {initials}
            </div>
            <div className="text-center">
                <p className="max-w-[100px] truncate text-xs font-semibold text-white">{name}</p>
                {sub ? <p className="text-[0.65rem] text-slate-400">{sub}</p> : null}
            </div>
        </div>
    );
}

function PlaceholderNode({ label, count }) {
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-white/20 bg-white/[0.03] text-[0.65rem] font-bold text-slate-500">
                {label}
            </div>
            <span className="text-[0.65rem] font-semibold text-emerald-400">{count}</span>
        </div>
    );
}

function DonutCommission() {
    const gradient = `conic-gradient(from -90deg, ${BLUE} 0deg 162deg, #8b5cf6 162deg 241.2deg, #eab308 241.2deg 298.8deg, #f97316 298.8deg 342deg, #ec4899 342deg 360deg)`;
    return (
        <Glass className="p-5">
            <h3 className="text-sm font-semibold text-white">Commission Overview</h3>
            <div className="relative mx-auto mt-6 h-44 w-44">
                <div
                    className="h-full w-full rounded-full"
                    style={{
                        background: gradient,
                        mask: 'radial-gradient(farthest-side, transparent calc(100% - 14px), #000 calc(100% - 14px + 0.5px))',
                        WebkitMask:
                            'radial-gradient(farthest-side, transparent calc(100% - 14px), #000 calc(100% - 14px + 0.5px))',
                    }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <p className="text-lg font-bold text-white">$5,420.00</p>
                    <p className="text-[0.65rem] text-slate-400">Total Commission</p>
                </div>
            </div>
            <ul className="mt-5 space-y-2 text-xs">
                {[
                    { label: 'Matching Bonus', amt: '$2,450', pct: '45%', color: 'bg-blue-500' },
                    { label: 'Direct Bonus', amt: '$1,200', pct: '22%', color: 'bg-violet-500' },
                    { label: 'Level Bonus', amt: '$850', pct: '16%', color: 'bg-yellow-500' },
                    { label: 'Rank Bonus', amt: '$650', pct: '12%', color: 'bg-orange-500' },
                    { label: 'Other Bonus', amt: '$270', pct: '5%', color: 'bg-pink-500' },
                ].map((r) => (
                    <li key={r.label} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-slate-300">
                            <span className={`h-2 w-2 rounded-full ${r.color}`} />
                            {r.label}
                        </span>
                        <span className="font-mono text-slate-400">
                            {r.amt} <span className="text-slate-500">{r.pct}</span>
                        </span>
                    </li>
                ))}
            </ul>
        </Glass>
    );
}

function LineIncomeChart() {
    const pts = [20, 45, 38, 52, 48, 62, 58, 70, 65, 78, 72, 85, 80, 88, 82, 90, 86, 92, 95, 100, 98, 105, 102, 110, 108, 115, 112, 118, 120, 125];
    const w = 320;
    const h = 112;
    const max = Math.max(...pts);
    const min = Math.min(...pts);
    const path = pts
        .map((v, i) => {
            const x = (i / (pts.length - 1)) * w;
            const y = h - ((v - min) / (max - min)) * (h - 8) - 4;
            return `${i === 0 ? 'M' : 'L'}${x},${y}`;
        })
        .join(' ');
    return (
        <Glass className="p-5">
            <h3 className="text-sm font-semibold text-white">Reward Summary</h3>
            <p className="mt-1 text-xs text-slate-500">Month growth</p>
            <div className="relative mt-4">
                <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full max-w-full text-blue-500/25" preserveAspectRatio="xMidYMid meet">
                    {[0, 1, 2, 3].map((i) => (
                        <line key={i} x1="0" y1={i * 28 + 10} x2={w} y2={i * 28 + 10} stroke="currentColor" strokeWidth="1" />
                    ))}
                    <path d={path} fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="absolute bottom-6 left-[58%] rounded-lg border border-white/10 bg-slate-900/95 px-2 py-1.5 text-center shadow-xl">
                    <p className="text-[0.65rem] font-bold text-emerald-400">$4,520.00</p>
                    <p className="text-[0.6rem] text-slate-400">15 May</p>
                </div>
            </div>
        </Glass>
    );
}

function TeamGrowthBars() {
    const days = ['01', '05', '10', '15', '20', '25', '30'].map((d) => `May ${d}`);
    const leftH = [40, 55, 48, 62, 58, 70, 65];
    const rightH = [35, 50, 52, 58, 60, 55, 68];
    const max = 100;
    return (
        <Glass className="p-5">
            <h3 className="text-sm font-semibold text-white">Team Growth</h3>
            <p className="mt-1 text-xs text-slate-500">Left vs right · May</p>
            <div className="mt-4 flex items-end justify-between gap-1">
                {days.map((d, i) => (
                    <div key={`${d}-${i}`} className="flex flex-1 flex-col items-center gap-1">
                        <div className="flex h-32 w-full items-end justify-center gap-1">
                            <div
                                className="w-1.5 rounded-t bg-blue-500/90"
                                style={{ height: `${(leftH[i] / max) * 100}%` }}
                            />
                            <div
                                className="w-1.5 rounded-t bg-emerald-500/90"
                                style={{ height: `${(rightH[i] / max) * 100}%` }}
                            />
                        </div>
                        <span className="text-[0.55rem] text-slate-500">{d.replace('May ', '')}</span>
                    </div>
                ))}
            </div>
            <div className="mt-2 flex justify-center gap-4 text-[0.6rem] text-slate-400">
                <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-blue-500" /> Left
                </span>
                <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Right
                </span>
            </div>
        </Glass>
    );
}

function RecentTx() {
    const rows = [
        { label: 'Matching Bonus', amt: '+$450.00', color: 'text-emerald-400', arrow: '↓', sub: 'Completed', time: 'Today 09:14' },
        { label: 'Direct Bonus', amt: '+$250.00', color: 'text-blue-400', arrow: '↓', sub: 'Completed', time: 'Yesterday 16:22' },
        { label: 'Level Bonus', amt: '+$150.00', color: 'text-violet-400', arrow: '↓', sub: 'Completed', time: '14 May 11:03' },
    ];
    return (
        <Glass className="p-5">
            <h3 className="text-sm font-semibold text-white">Recent Transactions</h3>
            <ul className="mt-4 space-y-3">
                {rows.map((r) => (
                    <li
                        key={r.label}
                        className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                    >
                        <div className="flex gap-2">
                            <span className={`mt-0.5 text-lg ${r.color}`}>{r.arrow}</span>
                            <div>
                                <p className="text-sm font-medium text-white">{r.label}</p>
                                <p className="text-xs text-slate-500">{r.sub}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className={`text-sm font-bold ${r.color}`}>{r.amt}</p>
                            <p className="text-[0.65rem] text-slate-500">{r.time}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </Glass>
    );
}

function MetricCard({ title, value, pct, positive, icon }) {
    return (
        <Glass className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-xs font-medium text-slate-400">{title}</p>
                    <p className="mt-2 font-mono text-xl font-bold tracking-tight text-white sm:text-2xl">{value}</p>
                    <p className={`mt-1.5 text-sm font-semibold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pct}
                    </p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-blue-500/15 text-blue-400">
                    {icon}
                </div>
            </div>
        </Glass>
    );
}

function NetworkTreeCard() {
    const placeholders = [
        { l: 'A', c: 32 },
        { l: 'B', c: 28 },
        { l: 'C', c: 45 },
        { l: 'D', c: 31 },
        { l: 'E', c: 38 },
        { l: 'F', c: 41 },
        { l: 'G', c: 36 },
        { l: 'H', c: 29 },
    ];
    return (
        <Glass className="relative min-h-[520px] overflow-hidden p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Network Tree</h2>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-400">
                    Binary preview
                </span>
            </div>

            <div className="relative mx-auto max-w-3xl">
                <svg className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-full -translate-x-1/2 text-white/15" viewBox="0 0 400 420" preserveAspectRatio="xMidYMid meet">
                    <path d="M200 48 L200 88 M200 88 L120 140 M200 88 L280 140 M120 200 L120 240 M280 200 L280 240 M120 240 L60 300 M120 240 L120 300 M120 240 L180 300 M120 240 L240 300 M280 240 L240 300 M280 240 L300 300 M280 240 L340 300 M280 240 L380 300" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>

                <div className="relative z-10 flex flex-col items-center gap-10 pt-2">
                    <Avatar name="John Smith" sub="MLM123456" size="lg" primary />
                    <div className="flex w-full max-w-md justify-between gap-8 px-4">
                        <Avatar name="Robert Brown" sub="RB548796" />
                        <Avatar name="Michael Lee" sub="ML879654" />
                    </div>
                    <div className="flex w-full max-w-2xl flex-wrap justify-center gap-6 px-2">
                        <Avatar name="David Wilson" sub="DW112233" size="sm" />
                        <Avatar name="James Taylor" sub="JT445566" size="sm" />
                        <Avatar name="William Davis" sub="WD778899" size="sm" />
                        <Avatar name="Richard Miller" sub="RM334455" size="sm" />
                    </div>
                    <div className="flex w-full max-w-3xl flex-wrap justify-center gap-3 sm:gap-4">
                        {placeholders.map((p) => (
                            <PlaceholderNode key={p.l} label={p.l} count={p.c} />
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-10 grid gap-3 border-t border-white/[0.08] pt-6 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
                    <IconPath d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" className="h-6 w-6 text-blue-400" />
                    <div>
                        <p className="text-xs text-blue-200/80">Left Team</p>
                        <p className="text-xl font-bold text-white">136</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3">
                    <IconPath d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" className="h-6 w-6 text-violet-400" />
                    <div>
                        <p className="text-xs text-violet-200/80">Total Team</p>
                        <p className="text-xl font-bold text-white">272</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                    <IconPath d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" className="h-6 w-6 text-emerald-400" />
                    <div>
                        <p className="text-xs text-emerald-200/80">Right Team</p>
                        <p className="text-xl font-bold text-white">136</p>
                    </div>
                </div>
            </div>
        </Glass>
    );
}

function Sparkline() {
    const d = 'M0 18 L8 12 L16 16 L24 8 L32 10 L40 4 L48 6 L56 2 L64 4';
    return (
        <svg viewBox="0 0 64 20" className="h-8 w-full text-blue-400" preserveAspectRatio="none">
            <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export default function AdminMlmDashboard() {
    return (
        <div className="min-h-screen font-inter text-slate-200 antialiased" style={{ backgroundColor: NAVY }}>
            <Head title="MLM SOFT — Admin Dashboard" />

            <div className="flex min-h-screen">
                {/* Left sidebar */}
                <aside
                    className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/[0.06] lg:static lg:flex"
                    style={{ backgroundColor: SLATE_SIDEBAR }}
                >
                    <div className="flex h-16 items-center border-b border-white/[0.06] px-5">
                        <span className="font-poppins text-lg font-bold tracking-tight text-white">MLM SOFT</span>
                    </div>
                    <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                        {menuItems.map((m) => (
                            <button
                                key={m.id}
                                type="button"
                                className={`flex w-full items-center gap-3 rounded-xl border-l-[3px] px-3 py-2.5 text-left text-sm font-medium transition ${
                                    m.active
                                        ? 'border-blue-500 bg-blue-500/15 text-blue-100 shadow-[inset_0_0_24px_rgba(59,130,246,0.12)]'
                                        : 'border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-white'
                                }`}
                            >
                                <IconPath d={m.icon} className="h-5 w-5 shrink-0 opacity-80" />
                                {m.label}
                            </button>
                        ))}
                    </nav>
                    <div className="space-y-3 border-t border-white/[0.06] p-4">
                        <Glass className="p-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-bold text-white">
                                    JS
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-white">John Smith</p>
                                    <p className="text-xs text-slate-400">ID MLM123456</p>
                                    <span className="mt-1 inline-block rounded-md bg-blue-500/25 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-blue-300">
                                        Diamond
                                    </span>
                                </div>
                            </div>
                        </Glass>
                        <Glass className="p-3">
                            <p className="text-xs text-slate-400">Wallet Balance</p>
                            <p className="mt-1 font-mono text-lg font-bold text-white">$12,650.50</p>
                            <p className="mt-0.5 text-xs font-semibold text-emerald-400">+12.5% from last month</p>
                            <div className="mt-2">
                                <Sparkline />
                            </div>
                            <button
                                type="button"
                                className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
                                style={{ backgroundColor: BLUE }}
                            >
                                Withdraw
                            </button>
                        </Glass>
                    </div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col lg:pl-0">
                    {/* Top bar */}
                    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-white/[0.08] bg-[#0F172A]/95 px-4 backdrop-blur-md sm:px-6">
                        <span className="shrink-0 font-poppins text-base font-bold tracking-tight text-white">MLM SOFT</span>
                        <div className="relative min-w-0 flex-1 md:mx-auto md:max-w-xl">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </span>
                            <input
                                type="search"
                                placeholder="Search…"
                                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 outline-none ring-blue-500/30 focus:ring-2 md:placeholder:text-slate-500"
                            />
                        </div>
                        <div className="ml-auto flex items-center gap-1 sm:gap-2">
                            <button
                                type="button"
                                className="relative rounded-xl p-2.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
                                aria-label="Notifications"
                            >
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.75}
                                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                                    />
                                </svg>
                                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#0F172A]" />
                            </button>
                            <button
                                type="button"
                                className="rounded-xl p-2.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
                                aria-label="Messages"
                            >
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337L5.454 21.03A.75.75 0 014.5 20.25V17.379c-.88-.556-1.686-1.19-2.392-1.884A8.254 8.254 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                className="rounded-xl p-2.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
                                aria-label="Language"
                            >
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                                </svg>
                            </button>
                            <div className="ml-1 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-slate-600 to-slate-800 text-sm font-bold text-white">
                                JS
                            </div>
                        </div>
                    </header>

                    <div className="flex flex-1 flex-col">
                        <main className="mx-auto w-full max-w-[1920px] flex-1 overflow-y-auto p-4 sm:p-6 xl:p-8">
                            <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
                                <div>
                                    <h1 className="font-poppins text-2xl font-bold tracking-tight text-white sm:text-3xl">Dashboard</h1>
                                    <p className="mt-1 text-slate-400">
                                        Welcome back, <span className="font-medium text-slate-200">John Smith</span>!
                                    </p>
                                </div>
                                <Link href="/" className="text-xs font-medium text-blue-400 hover:text-blue-300">
                                    ← Back to site
                                </Link>
                            </div>

                            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                                <MetricCard
                                    title="Total Reward"
                                    value="$25,680.50"
                                    pct="+12.45%"
                                    positive
                                    icon={
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    }
                                />
                                <MetricCard
                                    title="Direct Reward"
                                    value="$8,650.00"
                                    pct="+8.25%"
                                    positive
                                    icon={
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" />
                                        </svg>
                                    }
                                />
                                <MetricCard
                                    title="Matching Reward"
                                    value="$5,420.00"
                                    pct="+10.35%"
                                    positive
                                    icon={
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M18 18.72a9.09 9.09 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666M18 18.72a9.09 9.09 0 005.06-2.687m0 0a9.01 9.01 0 00-.94-3.197m0 0A9 9 0 005.64 5.64m9.367 9.367a9 9 0 00-9.367 9.367m9.367-9.367c.11-.408.17-.84.17-1.284m0 0a3 3 0 01-6 0m6 0a3 3 0 00-6 0" />
                                        </svg>
                                    }
                                />
                                <MetricCard
                                    title="Reward Bonus"
                                    value="$3,250.00"
                                    pct="+5.25%"
                                    positive
                                    icon={
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m-8.25 3.75h16.5M4.5 19.125h15M5.25 4.5l1.5 15h10.5l1.5-15H5.25z" />
                                        </svg>
                                    }
                                />
                                <MetricCard
                                    title="Total Members"
                                    value="3,650"
                                    pct="+15.35%"
                                    positive
                                    icon={
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                                        </svg>
                                    }
                                />
                            </div>

                            {/* Center tree + right commission charts */}
                            <div className="mt-6 flex flex-col gap-6 xl:flex-row xl:items-start">
                                <div className="min-w-0 flex-1">
                                    <NetworkTreeCard />
                                </div>
                                <div className="flex w-full shrink-0 flex-col gap-6 xl:w-[min(100%,20rem)] xl:border-l xl:border-white/[0.08] xl:pl-6">
                                    <DonutCommission />
                                    <LineIncomeChart />
                                </div>
                            </div>

                            {/* Bottom: team growth + recent transactions */}
                            <div className="mt-6 grid gap-6 lg:grid-cols-2">
                                <TeamGrowthBars />
                                <RecentTx />
                            </div>
                        </main>
                    </div>
                </div>
            </div>
        </div>
    );
}
