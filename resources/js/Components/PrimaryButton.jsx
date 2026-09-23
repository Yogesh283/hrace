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
                'inline-flex items-center justify-center rounded-xl border border-white/25 bg-gradient-to-r from-[#2563EB] to-[#38BDF8] px-3.5 py-2 text-[13px] font-semibold text-white shadow-[0_10px_32px_-6px_rgba(37,99,235,0.42)] ring-1 ring-white/20 transition duration-150 ease-in-out hover:shadow-[0_14px_36px_-4px_rgba(37,99,235,0.48)] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/35 focus:ring-offset-2 focus:ring-offset-[#F8FAFC] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-sm ' +
                className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
