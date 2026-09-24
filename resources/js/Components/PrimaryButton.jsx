export default function PrimaryButton({
    className = '',
    disabled,
    children,
    ...props
}) {
    return (
        <button
            {...props}
            className={
                'inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl border border-white/20 bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#0369A1] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_28px_-8px_rgba(37,99,235,0.6)] transition duration-150 ease-in-out hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1120] active:scale-[0.98] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-none disabled:bg-slate-700 disabled:text-slate-300 disabled:shadow-none disabled:active:scale-100 sm:rounded-2xl ' +
                className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
