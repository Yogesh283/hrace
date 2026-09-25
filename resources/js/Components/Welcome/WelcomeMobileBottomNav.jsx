import { useEffect, useState } from 'react';

const navItems = [
    { id: 'hero', href: '#hero', label: 'Home' },
    { id: 'about', href: '#about', label: 'About' },
    { id: 'ecosystem', href: '#ecosystem', label: 'Eco' },
    { id: 'tokenomics', href: '#tokenomics', label: 'Token' },
    { id: 'contact', href: '#contact', label: 'Join', cta: true },
];

function NavIcon({ name, active }) {
    const c = 'h-[19px] w-[19px]';
    const sw = active ? 1.75 : 1.4;
    const props = { className: c, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: sw };

    switch (name) {
        case 'hero':
            return (
                <svg {...props}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
            );
        case 'about':
            return (
                <svg {...props}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
            );
        case 'ecosystem':
            return (
                <svg {...props}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75A2.25 2.25 0 0115.75 18h2.25a2.25 2.25 0 002.25-2.25v-2.25a2.25 2.25 0 00-2.25-2.25H15.75a2.25 2.25 0 00-2.25 2.25v2.25z" />
                </svg>
            );
        case 'tokenomics':
            return (
                <svg {...props}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            );
        case 'contact':
            return (
                <svg {...props}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
            );
        default:
            return null;
    }
}

function resolveActiveId() {
    if (typeof window === 'undefined') return 'hero';
    const hash = window.location.hash.replace('#', '');
    return navItems.some((item) => item.id === hash) ? hash : 'hero';
}

export default function WelcomeMobileBottomNav() {
    const [activeId, setActiveId] = useState('hero');

    useEffect(() => {
        setActiveId(resolveActiveId());
        const onHash = () => setActiveId(resolveActiveId());
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, []);

    useEffect(() => {
        const sections = navItems
            .map((item) => document.getElementById(item.id))
            .filter(Boolean);

        if (sections.length === 0) return undefined;

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

                if (visible[0]?.target?.id) {
                    setActiveId(visible[0].target.id);
                }
            },
            { rootMargin: '-42% 0px -42% 0px', threshold: [0.12, 0.35, 0.55] },
        );

        sections.forEach((section) => observer.observe(section));
        return () => observer.disconnect();
    }, []);

    return (
        <nav
            className="race-welcome-bottomnav rx-mobile-bottomnav pointer-events-none fixed inset-x-0 bottom-0 z-[52] px-0 pb-[env(safe-area-inset-bottom,0px)] pt-0 xl:hidden"
            aria-label="RACE sections"
        >
            <div className="pointer-events-auto relative mx-auto w-full max-w-none">
                <div className="race-welcome-bottomnav__shell rx-mobile-bottomnav__shell relative overflow-hidden rounded-none border-t border-[#38BDF8] bg-[#0B0B0B] px-1 py-1.5 shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.7)] sm:px-1.5">
                    <div
                        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#2563EB]/25 via-[#0B0B0B] to-[#F59E0B]/18"
                        aria-hidden
                    />
                    <div
                        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-sky-400 to-transparent"
                        aria-hidden
                    />

                    <div className="relative grid grid-cols-5 items-end gap-0">
                        {navItems.map((item) => {
                            const active = activeId === item.id;
                            const isCta = item.cta;

                            return (
                                <a
                                    key={item.id}
                                    href={item.href}
                                    onClick={() => setActiveId(item.id)}
                                    className="group relative flex min-h-[58px] min-w-0 flex-col items-center justify-end px-0.5 pb-1 pt-1.5 font-poppins transition duration-200 active:scale-95"
                                    aria-current={active ? 'page' : undefined}
                                >
                                    <span
                                        className={`relative flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-300 sm:h-11 sm:w-11 ${
                                            active
                                                ? isCta
                                                    ? 'bg-gradient-to-br from-[#F59E0B] to-[#FBBF24] text-[#0B0B0B] shadow-[0_8px_22px_-6px_rgba(245,158,11,0.7),inset_0_1px_0_rgba(255,255,255,0.35)] ring-2 ring-[#FBBF24]/70'
                                                    : 'bg-gradient-to-br from-[#2563EB] to-[#38BDF8] text-white shadow-[0_8px_22px_-6px_rgba(37,99,235,0.65),0_0_18px_rgba(56,189,248,0.45),inset_0_1px_0_rgba(255,255,255,0.25)] ring-2 ring-[#38BDF8]/55'
                                                : isCta
                                                  ? 'bg-[#F59E0B]/18 text-[#FCD34D] ring-1 ring-[#F59E0B]/45 group-hover:bg-[#F59E0B]/28'
                                                  : 'text-sky-300/70 ring-1 ring-white/10 group-hover:bg-[#2563EB]/15 group-hover:text-sky-200 group-hover:ring-[#38BDF8]/30'
                                        }`}
                                    >
                                        {active && !isCta ? (
                                            <span
                                                className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-400/15 to-transparent"
                                                aria-hidden
                                            />
                                        ) : null}
                                        <span className={`relative ${active ? 'drop-shadow-[0_0_8px_rgba(56,189,248,0.45)]' : ''}`}>
                                            <NavIcon name={item.id} active={active} />
                                        </span>
                                    </span>

                                    <span
                                        className={`mt-1 h-[3px] w-6 rounded-full transition-all duration-300 ${
                                            active
                                                ? isCta
                                                    ? 'bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] opacity-100 shadow-[0_0_10px_rgba(245,158,11,0.65)]'
                                                    : 'bg-gradient-to-r from-[#2563EB] to-[#38BDF8] opacity-100 shadow-[0_0_10px_rgba(56,189,248,0.55)]'
                                                : 'bg-transparent opacity-0'
                                        }`}
                                        aria-hidden
                                    />

                                    <span
                                        className={`mt-0.5 max-w-full truncate text-[10px] font-semibold leading-none tracking-wide sm:text-[11px] ${
                                            active
                                                ? isCta
                                                    ? 'font-bold text-[#FCD34D]'
                                                    : 'font-bold text-sky-200'
                                                : isCta
                                                  ? 'text-[#F59E0B]'
                                                  : 'text-slate-300 group-hover:text-sky-200'
                                        }`}
                                    >
                                        {item.label}
                                    </span>
                                </a>
                            );
                        })}
                    </div>
                </div>
            </div>
        </nav>
    );
}
