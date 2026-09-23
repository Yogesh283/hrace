import { MEMBER_CARD, PANEL_DENSITY } from '@/lib/memberTheme';

export default function MemberCard({ children, className = '', density = 'default' }) {
    return (
        <div className={`${MEMBER_CARD} ${PANEL_DENSITY[density] ?? PANEL_DENSITY.default} ${className}`}>
            <div
                className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/40 to-transparent"
                aria-hidden
            />
            {children}
        </div>
    );
}
