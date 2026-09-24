export default function DangerButton({
    className = '',
    disabled,
    children,
    ...props
}) {
    return (
        <button
            {...props}
            className={
                'inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(220,38,38,0.7)] transition duration-150 ease-in-out hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1120] active:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 ' +
                className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
