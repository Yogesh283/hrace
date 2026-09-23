import MemberIcon from '@/Components/Member/MemberIcon';

export default function MemberStatCard({ label, value, hint, className = '', valueClassName = '', icon = null }) {
    return (
        <div
            className={`min-w-0 rounded-xl border border-white/90 bg-white/75 px-3 py-3 shadow-[0_8px_32px_-12px_rgba(37,99,235,0.12)] backdrop-blur-sm sm:px-4 sm:py-4 ${className}`}
        >
            <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-[10px] font-semibold uppercase tracking-wide text-fintech-muted sm:text-xs">
                    {label}
                </p>
                {icon ? (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-sky-50/90 text-[#2563EB]">
                        <MemberIcon name={icon} className="h-3.5 w-3.5" />
                    </span>
                ) : null}
            </div>
            <p className={`mt-1 break-words text-xl font-bold text-fintech-ink sm:text-2xl ${valueClassName}`}>
                {value}
            </p>
            {hint ? <p className="mt-1 text-xs text-fintech-muted">{hint}</p> : null}
        </div>
    );
}
