import { RACE_BRAND_NAME, RACE_LOGO_SRC } from '@/lib/brandAssets';
import { Link, usePage } from '@inertiajs/react';

function BrandLogo() {
    return (
        <Link
            href="/"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-white/20 bg-[#0F172A]/70 shadow-[0_8px_22px_-8px_rgba(37,99,235,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-[#F59E0B]/20 sm:h-11 sm:w-11 sm:rounded-[14px]"
        >
            <img src={RACE_LOGO_SRC} alt={RACE_BRAND_NAME} className="h-7 w-7 object-contain sm:h-9 sm:w-9" />
        </Link>
    );
}

export default function WelcomeGlassHeader({ navItems = [] }) {
    const { auth, canLogin = true, canRegister = true } = usePage().props;
    const user = auth?.user;

    const navLink =
        'shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-semibold text-sky-200/80 transition hover:bg-[#2563EB]/20 hover:text-sky-100 hover:ring-1 hover:ring-[#38BDF8]/40 sm:px-3 sm:text-xs';

    const actionLink =
        'relative z-[2] inline-flex cursor-pointer rounded-[12px] px-2.5 py-1.5 font-poppins text-[10px] font-bold transition hover:brightness-105 sm:px-4 sm:py-2 sm:text-xs';

    return (
        <header className="rx-pro-chrome rx-mobile-topbar pointer-events-none fixed inset-x-0 top-0 z-[10001] px-2.5 pt-[max(0.5rem,env(safe-area-inset-top,0px))] sm:px-3.5 sm:pt-[max(0.65rem,env(safe-area-inset-top,0px))]">
            <div
                className="pointer-events-none absolute inset-x-6 top-2 h-20 rounded-full bg-[radial-gradient(ellipse,rgba(56,189,248,0.32),transparent_70%)] blur-2xl"
                aria-hidden
            />

            <div className="rx-mobile-topbar__shell pointer-events-auto relative mx-auto max-w-6xl overflow-hidden rounded-[22px] border border-[#38BDF8]/45 bg-[#0F172A]/75 px-2.5 py-2 shadow-[0_20px_50px_-16px_rgba(0,0,0,0.55),0_0_36px_-8px_rgba(37,99,235,0.55),inset_0_1px_0_rgba(56,189,248,0.25)] backdrop-blur-[20px] sm:overflow-visible sm:rounded-[30px] sm:px-3.5 sm:py-3">
                <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/55 to-transparent" aria-hidden />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#2563EB]/12 via-transparent to-[#F59E0B]/10" aria-hidden />

                <div className="relative z-[1] flex items-center gap-2.5 sm:gap-3">
                    <BrandLogo />

                    <div className="min-w-0 flex-1 leading-none">
                        <p className="hidden truncate font-poppins text-[9px] font-bold uppercase tracking-[0.22em] text-[#F59E0B] min-[380px]:block sm:text-[10px]">
                            RACE Network
                        </p>
                        <p className="truncate font-poppins text-sm font-extrabold tracking-tight text-white sm:mt-1 sm:text-base">
                            RACE Coin
                        </p>
                    </div>

                    <nav
                        className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto xl:flex [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        aria-label="Sections"
                    >
                        {navItems.map((item) => (
                            <a key={item.label} href={item.href} className={navLink}>
                                {item.label}
                            </a>
                        ))}
                    </nav>

                    <div className="relative z-[2] flex shrink-0 items-center gap-1 sm:gap-2">
                        {user ? (
                            <Link
                                href={route('dashboard')}
                                className={`${actionLink} bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white shadow-[0_6px_20px_-6px_rgba(37,99,235,0.55)]`}
                            >
                                Dashboard
                            </Link>
                        ) : (
                            <>
                                {canLogin ? (
                                    <Link
                                        href={route('login')}
                                        className={`${actionLink} hidden rounded-full border border-white/15 bg-[#0F172A]/50 font-semibold text-slate-200 hover:border-sky-400/40 hover:text-sky-300 min-[400px]:inline-flex`}
                                    >
                                        Sign in
                                    </Link>
                                ) : null}
                                {canRegister ? (
                                    <Link
                                        href={route('register')}
                                        className={`${actionLink} bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] text-[#0B0B0B] shadow-[0_6px_20px_-6px_rgba(245,158,11,0.45)]`}
                                    >
                                        Join
                                    </Link>
                                ) : null}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
