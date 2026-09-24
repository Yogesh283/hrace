export default function SecondaryButton({
    type = 'button',
    className = '',
    disabled,
    children,
    ...props
}) {
    return (
        <button
            {...props}
            type={type}
            className={
                'inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl border border-[#38BDF8]/35 bg-[#0F172A]/80 px-4 py-2 text-sm font-semibold text-slate-100 shadow-sm transition duration-150 ease-in-out hover:border-[#38BDF8]/60 hover:bg-[#1E293B] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1120] disabled:cursor-not-allowed disabled:opacity-60 ' +
                className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
