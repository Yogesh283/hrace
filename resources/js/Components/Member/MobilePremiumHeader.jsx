import { RACE_BRAND_NAME, RACE_LOGO_SRC } from '@/lib/brandAssets';
import { Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';

/** Soft neumorphic control — white + sky lift */
const neuControl =
    'border border-white/95 bg-gradient-to-br from-white via-sky-50/80 to-white text-slate-600 shadow-[5px_5px_16px_rgba(148,163,184,0.2),-4px_-4px_14px_rgba(255,255,255,1),inset_0_1px_0_rgba(255,255,255,0.98)] transition duration-200 hover:text-[#1D4ED8] hover:shadow-[6px_6px_18px_rgba(37,99,235,0.14),-4px_-4px_14px_rgba(255,255,255,1)] active:scale-[0.95]';

function BrandLogo() {
    return (
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-white/90 bg-white shadow-[0_8px_22px_-8px_rgba(37,99,235,0.35),inset_0_1px_0_rgba(255,255,255,0.95)] ring-1 ring-sky-100/80">
            <img
                src={RACE_LOGO_SRC}
                alt={RACE_BRAND_NAME}
                className="h-9 w-9 object-contain"
            />
        </span>
    );
}

export default function MobilePremiumHeader({
    menuOpen = false,
    onMenuToggle,
    pageTitle = 'Dashboard',
    initials = 'YK',
    profileHref = '#',
    logoutHref = '#',
    dropdownSurface = '',
}) {
    const [profileOpen, setProfileOpen] = useState(false);
    const menuPanelClass =
        dropdownSurface ||
        'border border-slate-200/90 bg-white py-1 shadow-[0_16px_48px_-12px_rgba(15,23,42,0.18)]';

    useEffect(() => {
        if (menuOpen) {
            setProfileOpen(false);
        }
    }, [menuOpen]);

    return (
        <header
            className={`rx-mobile-topbar pointer-events-none fixed inset-x-0 top-0 z-[110] px-0 pt-[env(safe-area-inset-top,0px)] lg:hidden ${
                menuOpen ? 'rx-mobile-topbar--menu-open' : ''
            }`}
        >
            {profileOpen && !menuOpen ? (
                <button
                    type="button"
                    className="pointer-events-auto fixed inset-0 z-[111] bg-transparent"
                    aria-label="Close account menu"
                    onClick={() => setProfileOpen(false)}
                />
            ) : null}

            <div className="rx-mobile-topbar__shell pointer-events-auto relative overflow-visible rounded-none border-b border-[#38BDF8] bg-[#EFF6FF] px-3 py-3 shadow-[0_8px_20px_-8px_rgba(29,78,216,0.35)] sm:px-3.5 sm:py-3.5">
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-none">
                    <div
                        className="absolute inset-0"
                        style={{
                            background: 'linear-gradient(135deg, #EFF6FF 0%, #BAE6FD 45%, #7DD3FC 70%, #EFF6FF 100%)',
                        }}
                        aria-hidden
                    />
                    <div
                        className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#38BDF8] to-transparent"
                        aria-hidden
                    />
                </div>

                <div className="relative z-[1] flex items-center gap-2.5 sm:gap-3">
                    {/* Left — rounded square hamburger */}
                    <button
                        type="button"
                        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] ${neuControl}`}
                        onClick={() => {
                            setProfileOpen(false);
                            onMenuToggle?.();
                        }}
                        aria-expanded={menuOpen}
                        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.15}>
                            {menuOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                            )}
                        </svg>
                    </button>

                    {/* Brand cluster — logo + typography */}
                    <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
                        <BrandLogo />
                        <div className="min-w-0 leading-none">
                            <p className="truncate font-poppins text-[9px] font-bold uppercase tracking-[0.22em] text-[#1D4ED8] sm:text-[10px]">
                                RACE NETWORK
                            </p>
                            <h1 className="mt-1 truncate font-poppins text-[17px] font-extrabold tracking-tight text-[#0F172A] sm:text-lg">
                                {pageTitle}
                            </h1>
                        </div>
                    </div>

                    {/* Right — profile avatar + dropdown */}
                    <div className="relative shrink-0">
                        <button
                            type="button"
                            aria-label="Account menu"
                            aria-expanded={profileOpen}
                            onClick={() => setProfileOpen((v) => !v)}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#1D4ED8] via-[#2563EB] to-[#38BDF8] font-poppins text-[11px] font-bold tracking-wide text-white shadow-[0_8px_22px_-6px_rgba(29,78,216,0.6),5px_5px_12px_rgba(148,163,184,0.18),-2px_-2px_8px_rgba(255,255,255,0.95)] ring-[2.5px] ring-white transition duration-200 active:scale-[0.95]"
                        >
                            {initials}
                        </button>

                        {profileOpen ? (
                            <div
                                className={`absolute end-0 top-[calc(100%+0.5rem)] z-[112] w-48 origin-top-right overflow-hidden rounded-xl ${menuPanelClass}`}
                                role="menu"
                            >
                                <Link
                                    href={profileHref}
                                    role="menuitem"
                                    className="block w-full px-4 py-2.5 text-start font-poppins text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                    onClick={() => setProfileOpen(false)}
                                >
                                    Profile settings
                                </Link>
                                <Link
                                    href={logoutHref}
                                    method="post"
                                    as="button"
                                    role="menuitem"
                                    className="block w-full px-4 py-2.5 text-start font-poppins text-sm font-medium text-red-600 transition hover:bg-red-50"
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
