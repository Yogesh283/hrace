import { MEMBER_PAGE_STACK } from '@/lib/memberTheme';

const PARTICLE_POSITIONS = [10, 25, 40, 55, 70, 85, 18, 62, 33, 78];

function MemberParticles() {
    return (
        <>
            {PARTICLE_POSITIONS.map((left, i) => (
                <span
                    key={i}
                    className="rx-dp-particle"
                    style={{
                        left: `${left}%`,
                        top: `${(i * 19 + 5) % 90}%`,
                        animationDelay: `${i * 0.5}s`,
                    }}
                    aria-hidden
                />
            ))}
        </>
    );
}

/**
 * Premium fintech background (grid + glows) shared across member pages.
 */
export default function MemberPageShell({
    children,
    className = '',
    particles = false,
    /** Center content to max-w-6xl with consistent vertical spacing (member pages). */
    aligned = true,
    /** Match Investment page edge bleed on small screens */
    inset = false,
    contentClassName = '',
}) {
    const shellClass = inset
        ? 'rx-dash-premium relative -mx-2.5 px-2.5 sm:-mx-5 sm:px-5 lg:mx-0 lg:px-0'
        : 'rx-dash-premium relative';

    const mergedContent = aligned
        ? [MEMBER_PAGE_STACK, contentClassName].filter(Boolean).join(' ')
        : contentClassName;

    return (
        <div className={shellClass}>
            <div className="race-pdf-backdrop-globe" aria-hidden />
            <div className="race-pdf-backdrop-city" aria-hidden />
            <div className={`rx-dp-grid ${inset ? 'rounded-3xl' : ''}`} aria-hidden />
            <div className="rx-dp-glow -left-20 top-0 h-56 w-56 bg-sky-300/40" aria-hidden />
            <div className="rx-dp-glow -right-16 bottom-20 h-48 w-48 bg-blue-400/25" aria-hidden />
            {particles ? <MemberParticles /> : null}
            <div className={`relative z-[1] min-w-0 overflow-x-clip ${mergedContent} ${className}`}>
                {children}
            </div>
        </div>
    );
}
