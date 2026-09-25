import { RACE_SPLASH_VIDEO_SRC } from '@/lib/brandAssets';
import { useEffect, useRef, useState } from 'react';

const SPLASH_DURATION_MS = 1200;
const FADE_OUT_MS = 280;

export default function SplashScreen() {
    const [hidden, setHidden] = useState(false);
    const [mounted, setMounted] = useState(true);
    const videoRef = useRef(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) {
            return undefined;
        }

        const ensureMuted = () => {
            video.muted = true;
            video.defaultMuted = true;
            video.volume = 0;
        };

        const tryPlay = () => {
            ensureMuted();
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {});
            }
        };

        ensureMuted();
        tryPlay();

        video.addEventListener('loadeddata', tryPlay);
        video.addEventListener('canplay', tryPlay);

        return () => {
            video.removeEventListener('loadeddata', tryPlay);
            video.removeEventListener('canplay', tryPlay);
        };
    }, []);

    useEffect(() => {
        const hideTimer = window.setTimeout(() => setHidden(true), SPLASH_DURATION_MS);
        const unmountTimer = window.setTimeout(() => setMounted(false), SPLASH_DURATION_MS + FADE_OUT_MS);

        return () => {
            window.clearTimeout(hideTimer);
            window.clearTimeout(unmountTimer);
        };
    }, []);

    if (!mounted) {
        return null;
    }

    return (
        <div
            className={`rx-splash rx-splash--video-only${hidden ? ' is-hidden' : ''}`}
            role="presentation"
            aria-hidden={hidden}
            style={{ backgroundColor: '#050816' }}
        >
            <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                preload="auto"
                disablePictureInPicture
                controls={false}
                className="rx-splash-fullvideo"
                aria-label="RACE Network"
            >
                <source src={RACE_SPLASH_VIDEO_SRC} type="video/mp4" />
            </video>
        </div>
    );
}
