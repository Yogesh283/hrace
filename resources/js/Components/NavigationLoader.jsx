import { RACE_LOGO_SRC } from '@/lib/brandAssets';
import { useEffect, useRef, useState } from 'react';

const SHOW_DELAY_MS = 1000;

function shouldIgnoreStart(event) {
    const visit = event?.detail?.visit;
    return Boolean(visit?.prefetch);
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
            if (shouldIgnoreStart(event)) {
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
            <div className="rx-nav-loader__stage">
                <div className="rx-splash-ring rx-nav-loader__ring">
                    <img src={RACE_LOGO_SRC} alt="" className="rx-splash-logo rx-nav-loader__logo object-contain" />
                </div>
                <p className="rx-nav-loader__label">RACE NETWORK</p>
            </div>
        </div>
    );
}
