import { Link } from '@inertiajs/react';

function routeHref(name) {
    try {
        return route(name);
    } catch {
        return '#';
    }
}

function routeActive(name) {
    try {
        return route().current(name);
    } catch {
        return false;
    }
}

const navItems = [
    { routeKey: 'dashboard', label: 'Dashboard', color: '#2563EB' },
    { routeKey: 'investment', label: 'Invest', color: '#0EA5E9' },
    { routeKey: 'team', label: 'Total Team', color: '#7C3AED' },
    { routeKey: 'profile.edit', label: 'Profile', color: '#DB2777' },
];

function NavIcon({ name, active }) {
    const c = 'h-[18px] w-[18px]';
    const sw = active ? 1.7 : 1.35;
    const props = { className: c, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: sw };

    switch (name) {
        case 'dashboard':
            return (
                <svg {...props}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75A2.25 2.25 0 0115.75 18h2.25A2.25 2.25 0 0120.25 15.75v-2.25a2.25 2.25 0 00-2.25-2.25H15.75a2.25 2.25 0 00-2.25 2.25v2.25zM13.5 3.75A2.25 2.25 0 0115.75 6v2.25A2.25 2.25 0 0113.5 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6a2.25 2.25 0 012.25-2.25h2.25zM6 13.5A2.25 2.25 0 018.25 15.75v2.25A2.25 2.25 0 016 20.25H3.75A2.25 2.25 0 011.5 18v-2.25A2.25 2.25 0 013.75 13.5H6z"
                    />
                </svg>
            );
        case 'investment':
            return (
                <svg {...props}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l5.94-2.28m-5.94 2.28l2.28 5.941" />
                </svg>
            );
        case 'deposit':
            return (
                <svg {...props}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 3V9M3 12l9-3 9 3M5.25 18h13.5M12 15.75h.008v.008H12V15.75z"
                    />
                </svg>
            );
        case 'team':
            return (
                <svg {...props}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18 18.72a9.09 9.09 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666M18 18.72a9.09 9.09 0 005.06-2.687m0 0a9.01 9.01 0 00-.94-3.197m0 0A9 9 0 005.64 5.64m9.367 9.367a9 9 0 00-9.367 9.367m9.367-9.367c.11-.408.17-.84.17-1.284m0 0a3 3 0 01-6 0m6 0a3 3 0 00-6 0"
                    />
                </svg>
            );
        case 'profile.edit':
            return (
                <svg {...props}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                </svg>
            );
        default:
            return null;
    }
}

export default function MobileFintechBottomNav() {
    return (
        <nav
            className="rx-mobile-bottomnav pointer-events-none fixed inset-x-0 bottom-0 z-[52] px-2.5 pb-[max(0.45rem,env(safe-area-inset-bottom,0px))] pt-2 lg:hidden"
            aria-label="Primary"
        >
            <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-300/20 to-transparent"
                aria-hidden
            />

            <div className="pointer-events-auto relative mx-auto max-w-xl">
                <div className="rx-mobile-bottomnav__shell relative overflow-hidden rounded-[30px] border border-slate-200/70 px-1.5 py-1 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.28)] backdrop-blur-[8px]">
                    <div
                        className="pointer-events-none absolute inset-0"
                        style={{
                            background:
                                'linear-gradient(135deg, rgba(241,245,249,0.92) 0%, rgba(226,232,240,0.86) 45%, rgba(203,213,225,0.7) 72%, rgba(237,242,247,0.9) 100%)',
                        }}
                        aria-hidden
                    />
                    <div className="pointer-events-none absolute -left-8 -top-10 h-24 w-24 rounded-full bg-[#38BDF8]/12 max-lg:hidden" aria-hidden />
                    <div className="pointer-events-none absolute -bottom-8 -right-6 h-20 w-20 rounded-full bg-[#2563EB]/10 max-lg:hidden" aria-hidden />
                    <div
                        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent"
                        aria-hidden
                    />

                    <div className="relative grid grid-cols-4 items-end gap-0">
                        {navItems.map((item) => {
                            const active = routeActive(item.routeKey);
                            const href = routeHref(item.routeKey);

                            return (
                                <Link
                                    key={item.routeKey}
                                    href={href}
                                    className="group relative flex min-w-0 flex-col items-center px-0.5 pb-0.5 pt-1 font-poppins transition duration-200"
                                    aria-current={active ? 'page' : undefined}
                                >
                                    <span
                                        className={`relative flex h-8 w-8 items-center justify-center rounded-[14px] transition duration-200 ${
                                            active
                                                ? 'bg-gradient-to-br from-white via-sky-50 to-sky-100/90 shadow-[0_6px_20px_-6px_rgba(37,99,235,0.45),inset_0_1px_0_rgba(255,255,255,0.95)] ring-1 ring-[#2563EB]/20'
                                                : 'bg-white/45 ring-1 ring-slate-200/60'
                                        }`}
                                        style={{ color: active ? '#2563EB' : item.color }}
                                    >
                                        {active ? (
                                            <span
                                                className="absolute inset-0 rounded-[14px] bg-gradient-to-br from-[#2563EB]/10 to-[#38BDF8]/15"
                                                aria-hidden
                                            />
                                        ) : null}
                                        <span
                                            className={`relative ${active ? 'drop-shadow-[0_0_6px_rgba(56,189,248,0.45)]' : ''}`}
                                        >
                                            <NavIcon name={item.routeKey} active={active} />
                                        </span>
                                        {active ? (
                                            <span
                                                className="pointer-events-none absolute inset-0 rounded-[14px] shadow-[0_0_14px_rgba(56,189,248,0.32)]"
                                                aria-hidden
                                            />
                                        ) : null}
                                    </span>

                                    <span
                                        className={`mt-0.5 h-[2px] w-5 rounded-full transition-all duration-200 ${
                                            active
                                                ? 'bg-gradient-to-r from-[#2563EB] to-[#38BDF8] opacity-100 shadow-[0_0_8px_rgba(56,189,248,0.65)]'
                                                : 'bg-transparent opacity-0 group-hover:bg-slate-300/50 group-hover:opacity-60'
                                        }`}
                                        aria-hidden
                                    />

                                    <span
                                        className={`mt-0.5 max-w-full truncate text-[8.5px] font-semibold leading-none tracking-tight sm:text-[9px] ${
                                            active ? 'font-bold' : ''
                                        }`}
                                        style={{ color: active ? '#1D4ED8' : item.color }}
                                    >
                                        {item.label}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>
        </nav>
    );
}
