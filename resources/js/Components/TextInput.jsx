import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

const baseFintech =
    'min-h-[2.75rem] rounded-xl border border-[#38BDF8]/35 bg-[#0F172A]/85 px-3.5 py-2.5 text-sm text-slate-100 shadow-sm caret-sky-300 placeholder:text-slate-300 focus:border-[#38BDF8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/35 aria-[invalid=true]:border-red-400 sm:rounded-2xl sm:px-4 ';

const baseDark =
    'min-h-[2.75rem] rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-white shadow-sm caret-sky-300 placeholder:text-slate-300 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 aria-[invalid=true]:border-red-400 ';

export default forwardRef(function TextInput(
    { type = 'text', className = '', isFocused = false, variant = 'fintech', ...props },
    ref,
) {
    const localRef = useRef(null);

    useImperativeHandle(ref, () => ({
        focus: () => localRef.current?.focus(),
    }));

    useEffect(() => {
        if (isFocused) {
            localRef.current?.focus();
        }
    }, [isFocused]);

    const base = variant === 'dark' ? baseDark : baseFintech;

    return (
        <input
            {...props}
            type={type}
            className={base + className}
            ref={localRef}
        />
    );
});
