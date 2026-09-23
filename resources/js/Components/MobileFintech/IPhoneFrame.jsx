export default function IPhoneFrame({ title, children, className = '' }) {
    return (
        <div className={`flex flex-col items-center ${className}`}>
            <p className="mb-3 max-w-[320px] text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                {title}
            </p>
            <div className="relative w-[320px] max-w-[92vw] scale-[1] sm:scale-[1.02]">
                <div
                    className="pointer-events-none absolute -inset-8 rounded-[3.75rem] bg-gradient-to-br from-[#38BDF8]/22 via-transparent to-[#2563EB]/18 blur-3xl"
                    aria-hidden
                />
                <div className="relative w-full rounded-[2.95rem] border-[12px] border-[#0c1222] bg-gradient-to-b from-[#1e293b] via-[#0f172a] to-[#020617] p-[1px] shadow-[0_40px_80px_-24px_rgba(15,23,42,0.55),0_0_0_1px_rgba(255,255,255,0.07)_inset,0_2px_0_rgba(255,255,255,0.1)_inset]">
                    <div className="relative rounded-[2.75rem] bg-[#0a0f1a] p-[10px]">
                        {/* Dynamic Island */}
                        <div
                            className="absolute left-1/2 top-[13px] z-30 h-[30px] w-[108px] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_1px_3px_rgba(255,255,255,0.08),0_2px_8px_rgba(0,0,0,0.5)] ring-1 ring-white/[0.06]"
                            aria-hidden
                        />
                        <div className="flex flex-col overflow-hidden rounded-[2.2rem] bg-[#F8FAFC] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]">
                            <div className="flex h-[640px] min-h-0 flex-col overflow-hidden">
                                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                    {children}
                                </div>
                                <div className="flex shrink-0 justify-center bg-[#F8FAFC] pb-2.5 pt-1">
                                    <div className="h-[5px] w-[112px] rounded-full bg-[#0F172A]/10" aria-hidden />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
