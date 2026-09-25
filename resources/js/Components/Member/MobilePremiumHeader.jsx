import { RACE_BRAND_NAME, RACE_LOGO_SRC } from '@/lib/brandAssets';
import { Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';

const iconControl =
    'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#38BDF8]/30 bg-[#0F172A] text-slate-100 shadow-sm transition hover:border-[#38BDF8]/60 hover:text-white active:scale-[0.96]';

export default function MobilePremiumHeader({
    menuOpen = false,
    onMenuToggle,
    pageTitle = 'Dashboard',
    initials = 'YK',
    profileHref = '#',
    logoutHref = '#',
}) {
    const [profileOpen, setProfileOpen] = useState(false);

    useEffect(() => {
        if (menuOpen) {
            setProfileOpen(false);
        }
    }, [menuOpen]);

    useEffect(() => {
        if (!profileOpen) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') setProfileOpen(false);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [profileOpen]);

    return (
        <header
            className={`rx-mobile-topbar rx-dark-scope pointer-events-none fixed inset-x-0 top-0 z-[110] pt-[env(safe-area-inset-top,0px)] lg:hidden ${
                menuOpen ? 'rx-mobile-topbar--menu-open' : ''
            }`}
        >
            {profileOpen && !menuOpen ? (
                <button
                    type="button"
                    className="pointer-events-auto fixed inset-0 z-[111] cursor-default bg-transparent"
                    aria-label="Close account menu"
                    onClick={() => setProfileOpen(false)}
                />
            ) : null}

            <div className="rx-mobile-topbar__shell pointer-events-auto relative border-b border-[#38BDF8]/35 bg-[#0B1120]/95 px-3 py-3 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.8)] backdrop-blur-md sm:px-4">
                <div className="relative z-[1] flex items-center gap-3 sm:gap-3.5">
                    <button
                        type="button"
                        className={iconControl}
                        onClick={() => {
                            setProfileOpen(false);
                            onMenuToggle?.();
                        }}
                        aria-expanded={menuOpen}
                        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                            {menuOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                            )}
                        </svg>
                    </button>

                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.08] ring-1 ring-white/15">
                            <img src={RACE_LOGO_SRC} alt={RACE_BRAND_NAME} className="h-8 w-8 object-contain" />
                        </span>
                        <div className="min-w-0 leading-none">
                            <p className="truncate font-poppins text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300">
                                RACE NETWORK
                            </p>
                            <h1 className="mt-1 truncate font-poppins text-base font-bold tracking-tight text-white min-[380px]:text-[17px]">
                                {pageTitle}
                            </h1>
                        </div>
                    </div>

                    <div className="relative shrink-0">
                        <button
                            type="button"
                            aria-label="Account menu"
                            aria-haspopup="menu"
                            aria-expanded={profileOpen}
                            onClick={() => setProfileOpen((v) => !v)}
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] font-poppins text-xs font-bold tracking-wide text-white shadow-[0_6px_18px_-6px_rgba(37,99,235,0.8)] ring-2 ring-[#38BDF8]/50 transition active:scale-[0.96]"
                        >
                            {initials}
                        </button>

                        {profileOpen ? (
                            <div
                                className="absolute end-0 top-[calc(100%+0.5rem)] z-[112] w-52 overflow-hidden rounded-xl border border-[#38BDF8]/30 bg-[#0F172A] py-1 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.8)]"
                                role="menu"
                            >
                                <Link
                                    href={profileHref}
                                    role="menuitem"
                                    className="flex min-h-[2.75rem] w-full items-center px-4 text-start font-poppins text-sm font-medium text-slate-100 transition hover:bg-white/[0.06]"
                                    onClick={() => setProfileOpen(false)}
                                >
                                    Profile settings
                                </Link>
                                <Link
                                    href={logoutHref}
                                    method="post"
                                    as="button"
                                    role="menuitem"
                                    className="flex min-h-[2.75rem] w-full items-center px-4 text-start font-poppins text-sm font-semibold text-red-300 transition hover:bg-red-500/10"
                                    onClick={() => setProfileOpen(false)}
                                >
                                    Log out
                                </Link>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </header>
    );
}
