import GlobalFlashModal from '@/Components/GlobalFlashModal';
import BrandMark from '@/Components/BrandMark';
import { RynexBackdrop } from '@/Components/Rx';

export default function GuestLayout({
    children,
    hideHeader = false,
    authPremium = false,
    mainClassName,
    contentClassName = '',
    /** When header is hidden, vertically center the auth card (e.g. login/register). */
    centerAuth = false,
}) {
    const mainCls = mainClassName ?? 'w-full max-w-md';

    return (
        <div className="guest-race race-theme relative min-h-screen font-inter text-slate-100 antialiased">
            <RynexBackdrop />
            <div className="race-particles pointer-events-none fixed inset-0 z-0 opacity-35" aria-hidden />
            <GlobalFlashModal />

            {!hideHeader ? (
                <header className="sticky top-0 z-30 border-b border-[#2563EB]/25 bg-[#0B0B0B]/85 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                    <div className="mx-auto flex w-full max-w-7xl items-center px-6 py-4">
                        <BrandMark />
                    </div>
                </header>
            ) : null}

            <div
                className={
                    hideHeader
                        ? `relative z-10 flex min-h-[100dvh] min-h-screen justify-center overflow-y-auto px-3 py-5 sm:px-6 sm:py-10 ${
                              centerAuth ? 'items-center' : 'items-start sm:items-center'
                          } ${contentClassName}`
                        : 'relative z-10 flex min-h-[calc(100vh-73px)] items-center justify-center px-4 py-8 sm:px-6 sm:py-10'
                }
            >
                <main className={`${mainCls} relative overflow-visible`}>{children}</main>
            </div>
        </div>
    );
}
