import IPhoneFrame from '@/Components/MobileFintech/IPhoneFrame';
import {
    ScreenDashboard,
    ScreenEarnings,
    ScreenLanding,
    ScreenLogin,
    ScreenPackages,
    ScreenRegister,
    ScreenWallet,
} from '@/Components/MobileFintech/FintechScreens';
import { Head, Link } from '@inertiajs/react';

const screens = [
    { label: '01 — Landing', Component: ScreenLanding },
    { label: '02 — Dashboard', Component: ScreenDashboard },
    { label: '03 — Login', Component: ScreenLogin },
    { label: '04 — Register', Component: ScreenRegister },
    { label: '05 — Wallet', Component: ScreenWallet },
    { label: '06 — Packages', Component: ScreenPackages },
    { label: '07 — Earnings', Component: ScreenEarnings },
];

export default function MobileFintechShowcase() {
    return (
        <>
            <Head title="RACE NETWORK — mobile experience preview">
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
                    rel="stylesheet"
                />
            </Head>
            <div className="relative min-h-screen overflow-hidden bg-[#F8FAFC] font-inter text-[#0F172A] antialiased">
                <div
                    className="pointer-events-none absolute -left-40 top-0 h-[420px] w-[420px] rounded-full bg-[#2563EB]/12 blur-3xl"
                    aria-hidden
                />
                <div
                    className="pointer-events-none absolute -right-32 bottom-20 h-[360px] w-[360px] rounded-full bg-[#38BDF8]/15 blur-3xl"
                    aria-hidden
                />
                <div
                    className="pointer-events-none absolute left-1/2 top-1/4 h-72 w-[32rem] -translate-x-1/2 rounded-full bg-white/80 blur-3xl"
                    aria-hidden
                />

                <header className="relative z-10 border-b border-slate-200/80 bg-white/75 backdrop-blur-xl">
                    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-5 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-10 lg:px-14">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2563EB]">
                                RACE NETWORK · mobile experience
                            </p>
                            <h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
                                Member app screens (preview)
                            </h1>
                            {/* <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#64748B] sm:text-base">
                                Seven iPhone-scale screens with Inter typography and soft gradients — a static preview of
                                the mobile member journey.
                            </p> */}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                            <Link
                                href="/"
                                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-[#0F172A] shadow-sm transition hover:border-[#2563EB]/35 hover:text-[#2563EB]"
                            >
                                ← Back to site
                            </Link>
                        </div>
                    </div>
                </header>

                <main className="relative z-10 mx-auto max-w-[1600px] px-5 py-14 sm:px-10 lg:px-14">
                    <div className="mb-10 flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-[#0F172A] shadow-sm ring-1 ring-slate-200/90">
                            Primary #2563EB
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-[#0F172A] shadow-sm ring-1 ring-slate-200/90">
                            Sky #38BDF8
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-[#0F172A] shadow-sm ring-1 ring-slate-200/90">
                            Surface #F8FAFC · Inter
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-[#0F172A] shadow-sm ring-1 ring-slate-200/90">
                            7 screens · motion + glass cards
                        </span>
                    </div>

                    <div className="grid justify-items-center gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {screens.map(({ label, Component }) => (
                            <IPhoneFrame key={label} title={label}>
                                <Component />
                            </IPhoneFrame>
                        ))}
                    </div>
                </main>

                <footer className="relative z-10 border-t border-slate-200/80 bg-white/70 py-8 text-center text-xs text-[#64748B] backdrop-blur-md">
                </footer>
            </div>
        </>
    );
}
