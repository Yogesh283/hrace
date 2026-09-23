import Modal from '@/Components/Modal';
import { RACE_BRAND_NAME, RACE_LOGO_SRC } from '@/lib/brandAssets';
import { Link } from '@inertiajs/react';

/**
 * Auth choice modal — wallet login / register (live).
 */
export function WelcomeAuthComingSoonModal({ show, onClose }) {
    return (
        <Modal show={show} onClose={onClose} maxWidth="sm">
            <div className="-m-px mx-1 overflow-hidden rounded-2xl border border-[#F59E0B]/25 bg-[#0F172A] p-6 text-center text-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65)] sm:mx-0 sm:p-8">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-[#0B0B0B]/60 ring-1 ring-[#F59E0B]/20">
                    <img src={RACE_LOGO_SRC} alt={RACE_BRAND_NAME} className="h-14 w-14 object-contain" />
                </div>
                <p className="mt-5 font-poppins text-[11px] font-bold uppercase tracking-[0.22em] text-[#F59E0B]">
                    RACE Network
                </p>
                <h3 className="font-poppins mt-2 text-2xl font-extrabold tracking-tight text-white">
                    Sign in or register
                </h3>
                <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
                    Connect your wallet to sign in, or register with your sponsor join code.
                </p>
                <div className="mt-8 flex flex-col gap-3">
                    <Link
                        href={route('login')}
                        onClick={onClose}
                        className="w-full rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] py-3 text-center text-sm font-bold text-[#0B0B0B] shadow-[0_8px_24px_-6px_rgba(245,158,11,0.45)] transition hover:brightness-105"
                    >
                        Sign in with wallet
                    </Link>
                    <Link
                        href={route('register')}
                        onClick={onClose}
                        className="w-full rounded-xl border border-white/20 bg-white/5 py-3 text-center text-sm font-bold text-white transition hover:bg-white/10"
                    >
                        Create account
                    </Link>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-xs font-medium text-slate-500 transition hover:text-slate-300"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </Modal>
    );
}

export function WelcomeAuthComingSoonButton({ className = '', children, onOpen, href }) {
    if (href) {
        return (
            <Link href={href} className={className}>
                {children}
            </Link>
        );
    }

    return (
        <button type="button" className={className} onClick={onOpen}>
            {children}
        </button>
    );
}
