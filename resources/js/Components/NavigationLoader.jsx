import { RACE_LOGO_SRC } from '@/lib/brandAssets';
import { useEffect, useRef, useState } from 'react';

/** Only show after this delay — fast auth/nav never flash the old full loader. */
const SHOW_DELAY_MS = 280;

function visitPath(visit) {
    try {
        const raw = visit?.url;
        if (!raw) {
            return window.location.pathname || '';
        }
        if (typeof raw === 'string') {
            return new URL(raw, window.location.origin).pathname;
        }
        if (typeof raw?.pathname === 'string') {
            return raw.pathname;
        }
        return String(raw);
    } catch {
        return window.location.pathname || '';
    }
}

function isAuthRelatedVisit(event) {
    const visit = event?.detail?.visit;
    if (!visit) {
        return false;
    }
    if (visit.prefetch) {
        return true;
    }

    const path = visitPath(visit).toLowerCase();
    const here = (window.location.pathname || '').toLowerCase();

    // Login / register / wallet-auth posts — button spinner is enough.
    if (/\/(login|register)(\/|$)/.test(path) || /wallet-auth|wallet\/auth/.test(path)) {
        return true;
    }
    // Leaving auth pages (successful sign-in → dashboard): skip heavy overlay.
    if (/\/(login|register)(\/|$)/.test(here)) {
        return true;
    }

    return false;
}

export default function NavigationLoader() {
    const [active, setActive] = useState(false);
    const delayRef = useRef(null);
    const pendingLoadsRef = useRef(0);

    useEffect(() => {
        const show = () => {
            if (delayRef.current !== null) {
                return;
            }
            delayRef.current = window.setTimeout(() => {
                delayRef.current = null;
                if (pendingLoadsRef.current > 0) {
                    setActive(true);
                }
            }, SHOW_DELAY_MS);
        };

        const clearDelay = () => {
            if (delayRef.current !== null) {
                window.clearTimeout(delayRef.current);
                delayRef.current = null;
            }
        };

        const hide = () => {
            clearDelay();
            setActive(false);
        };

        const onStart = (event) => {
            if (isAuthRelatedVisit(event)) {
                return;
            }
            pendingLoadsRef.current += 1;
            show();
        };

        const onFinish = () => {
            pendingLoadsRef.current = Math.max(0, pendingLoadsRef.current - 1);
            if (pendingLoadsRef.current === 0) {
                hide();
            }
        };

        document.addEventListener('inertia:start', onStart);
        document.addEventListener('inertia:finish', onFinish);
        document.addEventListener('inertia:error', onFinish);
        document.addEventListener('inertia:invalid', onFinish);

        return () => {
            document.removeEventListener('inertia:start', onStart);
            document.removeEventListener('inertia:finish', onFinish);
            document.removeEventListener('inertia:error', onFinish);
            document.removeEventListener('inertia:invalid', onFinish);
            clearDelay();
            pendingLoadsRef.current = 0;
        };
    }, []);

    return (
        <div
            className={`rx-nav-loader${active ? ' rx-nav-loader--active' : ''}`}
            role="status"
            aria-live="polite"
            aria-busy={active}
            aria-label={active ? 'Loading page' : undefined}
        >
            <div className="rx-nav-loader__bar" aria-hidden />
            <div className="rx-nav-loader__stage">
                <div className="rx-splash-ring rx-nav-loader__ring">
                    <img src={RACE_LOGO_SRC} alt="" className="rx-splash-logo rx-nav-loader__logo object-contain" />
                </div>
                <p className="rx-nav-loader__label">RACE NETWORK</p>
            </div>
        </div>
    );
}
