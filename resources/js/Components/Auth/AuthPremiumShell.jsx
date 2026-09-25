import BrandMark from '@/Components/BrandMark';
import { AUTH_CARD_GUEST } from '@/lib/memberTheme';
import { motion } from 'framer-motion';

function AuthGlowButton({ children, disabled, type = 'submit', onClick }) {
    return (
        <motion.button
            type={type}
            disabled={disabled}
            onClick={onClick}
            whileHover={disabled ? undefined : { y: -2 }}
            whileTap={disabled ? undefined : { scale: 0.99 }}
            className="relative w-full overflow-hidden rounded-xl border border-sky-300/40 bg-gradient-to-r from-[#2563EB] via-[#3b82f6] to-[#38BDF8] py-2.5 text-xs font-extrabold text-white shadow-[0_12px_40px_-8px_rgba(37,99,235,0.5),0_0_32px_rgba(56,189,248,0.2)] transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-70 sm:rounded-2xl sm:py-4 sm:text-base"
        >
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/15 to-transparent" />
            <span className="relative">{children}</span>
        </motion.button>
    );
}

export { AuthGlowButton };

export default function AuthPremiumShell({
    title,
    subtitle,
    status,
    children,
    footer = null,
    maxWidth = 'max-w-lg',
}) {
    return (
        <div className={`relative z-[2] mx-auto w-full ${maxWidth}`}>
            <div className={AUTH_CARD_GUEST}>
                <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#38BDF8]/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 -left-16 h-60 w-60 rounded-full bg-[#2563EB]/10 blur-3xl" />
                <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/30 to-transparent" />

                <div className="relative flex flex-row items-start justify-between gap-2 border-b border-white/10 pb-4 sm:gap-6 sm:pb-6">
                    <div className="min-w-0 flex-1 pr-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
                            <BrandMark className="shrink-0 [&_img]:h-8 [&_img]:w-8 sm:[&_img]:h-10 sm:[&_img]:w-10" />
                            <span className="font-poppins text-sm font-bold tracking-tight text-white sm:text-base">
                                RACE NETWORK
                            </span>
                        </div>
                        {title ? (
                            <h1 className="mt-2 font-poppins text-xl font-bold tracking-tight text-white sm:mt-4 sm:text-3xl">
                                {title}
                            </h1>
                        ) : null}
                        {subtitle ? (
                            <p className="mt-1.5 text-xs leading-relaxed text-slate-300 sm:mt-2 sm:text-sm">{subtitle}</p>
                        ) : null}
                    </div>
                </div>

                {status ? (
                    <div className="relative mt-3 rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-100 shadow-sm backdrop-blur-md sm:mt-6 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
                        {status}
                    </div>
                ) : null}

                <div className="relative mt-4 sm:mt-8">{children}</div>

                {footer ? <div className="relative mt-5 sm:mt-8">{footer}</div> : null}
            </div>
        </div>
    );
}
