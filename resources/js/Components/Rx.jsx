import { Link } from '@inertiajs/react';
import { motion, useReducedMotion } from 'framer-motion';
import { forwardRef } from 'react';

/**
 * RYNEX PREMIUM UI KIT
 * ──────────────────────────────────────────────────────────────────────
 * Reusable building blocks that match the Rynex Premium design system.
 * Pair with the `.rx-pro` class on the page root and the utility
 * classes defined in resources/css/app.css.
 *
 * Available exports:
 *   <RynexBackdrop />          → animated grid + orbs + scan lines background
 *   <RxSection />              → consistent section wrapper
 *   <RxEyebrow />              → small uppercase neon kicker
 *   <RxHeading />              → display-grade heading (h1/h2/h3 via `as`)
 *   <RxMuted />                → muted body text
 *   <RxCard />                 → glass card with optional hover lift
 *   <RxBadge />                → neon pulsing badge
 *   <RxIcon />                 → gradient icon box wrapper
 *   <RxButton />               → primary gradient button (anchor or Inertia Link)
 *   <RxButtonGhost />          → secondary glass button
 *   <RxDivider />              → gradient divider line
 *   <ScrollReveal />           → framer-motion fade-in-on-scroll wrapper
 *   <Stagger />                → stagger container for child reveals
 *   <StaggerItem />            → child of <Stagger /> with built-in motion
 * ────────────────────────────────────────────────────────────────────── */

/* ───────────────────────── Animated background ───────────────────────── */

export function RynexBackdrop({ orbs = true, scan = true, grid = true, className = '' }) {
    return (
        <>
            {grid ? <div className={`rx-pro-bg ${className}`} aria-hidden /> : null}
            {orbs ? (
                <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
                    <span className="rx-pro-orb rx-pro-orb--1" />
                    <span className="rx-pro-orb rx-pro-orb--2" />
                    <span className="rx-pro-orb rx-pro-orb--3" />
                </div>
            ) : null}
            {scan ? <div className="rx-pro-scan" aria-hidden /> : null}
        </>
    );
}

/* ───────────────────────── Section wrapper ───────────────────────── */

export function RxSection({ id, className = '', children, ariaLabel }) {
    return (
        <section
            id={id}
            aria-label={ariaLabel}
            className={`rx-pro-section scroll-mt-24 ${className}`}
        >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
        </section>
    );
}

/* ───────────────────────── Typography ───────────────────────── */

export function RxEyebrow({ children, className = '' }) {
    return <p className={`rx-pro-eyebrow ${className}`}>{children}</p>;
}

export function RxHeading({ as: Tag = 'h2', gradient = false, className = '', children }) {
    return (
        <Tag className={`rx-pro-heading ${gradient ? 'rx-pro-gradient-text' : ''} ${className}`}>
            {children}
        </Tag>
    );
}

export function RxSubheading({ as: Tag = 'h3', className = '', children }) {
    return <Tag className={`rx-pro-subheading ${className}`}>{children}</Tag>;
}

export function RxMuted({ as: Tag = 'p', className = '', children }) {
    return <Tag className={`rx-pro-muted ${className}`}>{children}</Tag>;
}

/* ───────────────────────── Cards ───────────────────────── */

export const RxCard = forwardRef(function RxCard(
    { hover = true, padded = true, className = '', children, ...rest },
    ref,
) {
    return (
        <div
            ref={ref}
            className={`rx-pro-glass ${hover ? 'rx-pro-hover' : ''} ${
                padded ? 'p-6 sm:p-8' : ''
            } ${className}`}
            {...rest}
        >
            {children}
        </div>
    );
});

/* ───────────────────────── Badge / Icon ───────────────────────── */

export function RxBadge({ children, className = '' }) {
    return <span className={`rx-pro-badge ${className}`}>{children}</span>;
}

export function RxIcon({ children, className = '' }) {
    return <span className={`rx-pro-icon ${className}`}>{children}</span>;
}

export function RxDivider({ className = '' }) {
    return <hr className={`rx-pro-divider ${className}`} aria-hidden />;
}

/* ───────────────────────── Buttons ───────────────────────── */

function _btnInner(children, trailingIcon) {
    return (
        <>
            <span>{children}</span>
            {trailingIcon === false ? null : (
                <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    aria-hidden
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
                </svg>
            )}
        </>
    );
}

export function RxButton({
    href,
    inertia = true,
    onClick,
    type,
    children,
    className = '',
    trailingIcon,
    ...rest
}) {
    const cls = `rx-pro-btn ${className}`;
    if (href && inertia) {
        return (
            <Link href={href} className={cls} {...rest}>
                {_btnInner(children, trailingIcon)}
            </Link>
        );
    }
    if (href) {
        return (
            <a href={href} className={cls} {...rest}>
                {_btnInner(children, trailingIcon)}
            </a>
        );
    }
    return (
        <button type={type || 'button'} onClick={onClick} className={cls} {...rest}>
            {_btnInner(children, trailingIcon)}
        </button>
    );
}

export function RxButtonGhost({
    href,
    inertia = true,
    onClick,
    type,
    children,
    className = '',
    trailingIcon = false,
    ...rest
}) {
    const cls = `rx-pro-btn-ghost ${className}`;
    if (href && inertia) {
        return (
            <Link href={href} className={cls} {...rest}>
                {_btnInner(children, trailingIcon)}
            </Link>
        );
    }
    if (href) {
        return (
            <a href={href} className={cls} {...rest}>
                {_btnInner(children, trailingIcon)}
            </a>
        );
    }
    return (
        <button type={type || 'button'} onClick={onClick} className={cls} {...rest}>
            {_btnInner(children, trailingIcon)}
        </button>
    );
}

/* ───────────────────────── Scroll reveal (framer-motion) ───────────────────────── */

const _revealVariants = {
    hidden: { opacity: 0, y: 24 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
    },
};

export function ScrollReveal({
    as: Tag = 'div',
    delay = 0,
    y = 24,
    once = true,
    amount = 0.2,
    className = '',
    children,
    ...rest
}) {
    const reduce = useReducedMotion();
    const MotionTag = motion[Tag] || motion.div;
    if (reduce) {
        return (
            <Tag className={className} {...rest}>
                {children}
            </Tag>
        );
    }
    return (
        <MotionTag
            initial={{ opacity: 0, y }}
            whileInView={{
                opacity: 1,
                y: 0,
                transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay },
            }}
            viewport={{ once, amount }}
            className={className}
            {...rest}
        >
            {children}
        </MotionTag>
    );
}

/* ───────────────────────── Stagger container & items ───────────────────────── */

const _staggerParent = {
    hidden: {},
    show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

export function Stagger({ as: Tag = 'div', once = true, amount = 0.2, className = '', children, ...rest }) {
    const reduce = useReducedMotion();
    const MotionTag = motion[Tag] || motion.div;
    if (reduce) {
        return (
            <Tag className={className} {...rest}>
                {children}
            </Tag>
        );
    }
    return (
        <MotionTag
            variants={_staggerParent}
            initial="hidden"
            whileInView="show"
            viewport={{ once, amount }}
            className={className}
            {...rest}
        >
            {children}
        </MotionTag>
    );
}

export function StaggerItem({ as: Tag = 'div', className = '', children, ...rest }) {
    const reduce = useReducedMotion();
    const MotionTag = motion[Tag] || motion.div;
    if (reduce) {
        return (
            <Tag className={className} {...rest}>
                {children}
            </Tag>
        );
    }
    return (
        <MotionTag variants={_revealVariants} className={className} {...rest}>
            {children}
        </MotionTag>
    );
}

/* ───────────────────────── Stat tile (utility) ───────────────────────── */

export function RxStat({ label, value, hint, className = '' }) {
    return (
        <div className={`rx-pro-glass rx-pro-hover p-5 sm:p-6 ${className}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--rx-muted)]">
                {label}
            </p>
            <p className="mt-2 font-display text-3xl font-bold leading-tight text-[var(--rx-ink)] sm:text-4xl">
                {value}
            </p>
            {hint ? <p className="mt-1 text-sm text-[var(--rx-muted)]">{hint}</p> : null}
        </div>
    );
}

/* ───────────────────────── Page shell (helper) ───────────────────────── */

export function RxPage({ children, className = '' }) {
    return (
        <div className={`rx-pro ${className}`}>
            <RynexBackdrop />
            {children}
        </div>
    );
}
