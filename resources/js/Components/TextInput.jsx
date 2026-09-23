import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

const baseFintech =
    'rounded-2xl border border-[#2563EB]/35 bg-[#0F172A]/80 px-3.5 py-2.5 text-[13px] text-slate-100 shadow-sm caret-sky-300 placeholder:text-slate-500 focus:border-[#38BDF8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/30 sm:px-4 sm:py-3 sm:text-sm ';

const baseDark =
    'rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white shadow-sm caret-sky-300 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ';

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
