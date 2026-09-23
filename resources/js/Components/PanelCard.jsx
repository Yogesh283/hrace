import MemberIcon from '@/Components/Member/MemberIcon';
import { PANEL_DENSITY } from '@/lib/memberTheme';

export default function PanelCard({ title, children, className = '', icon = null, density = 'default' }) {
    const padding = PANEL_DENSITY[density] ?? PANEL_DENSITY.default;

    return (
        <section
            className={`race-glass race-pdf-panel relative min-w-0 overflow-hidden rounded-[1.25rem] border ${padding} ${className}`}
        >
            <div
                className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/40 to-transparent"
                aria-hidden
            />
            {title ? (
                <h3 className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 sm:mb-4 sm:text-xs">
                    {icon ? (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#2563EB]/30 bg-[#0F172A]/60 text-[#38BDF8]">
                            <MemberIcon name={icon} className="h-3.5 w-3.5" />
                        </span>
                    ) : null}
                    <span>{title}</span>
                </h3>
            ) : null}
            {children}
        </section>
    );
}
