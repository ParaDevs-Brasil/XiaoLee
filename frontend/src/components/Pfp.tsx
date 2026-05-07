import { useState, useEffect } from 'react';
import Video from './Video';

export default function Pfp({ pfp, loop }: { pfp: string; loop: boolean }) {
    const [videoKey, setVideoKey] = useState(0);
    const [currentPfp, setCurrentPfp] = useState(pfp);

    useEffect(() => {
        if (pfp !== currentPfp) {
            setCurrentPfp(pfp);
            setVideoKey(prev => prev + 1);
        }
    }, [pfp, currentPfp]);

    useEffect(() => {
        const unsubscribe = Video.subscribe((newPfp) => {
            if (newPfp !== currentPfp) {
                setCurrentPfp(newPfp);
                setVideoKey(prev => prev + 1);
            }
        });

        return unsubscribe; // Cleanup
    }, [currentPfp]);

    const handleVideoEnded = () => {
        if (!loop) {
            Video.primaryVideoDidEnd();
        }
    };

    if (!pfp || pfp === "null" || pfp === "undefined" || typeof pfp !== "string") {
        return (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--pfp-fallback-bg-start)] to-[var(--pfp-fallback-bg-end)] flex items-center justify-center border-2 border-[var(--pfp-fallback-border)]">
                <span className="text-[var(--pfp-fallback-icon)] text-xs">✨</span>
            </div>
        );
    }    return (
        <div >
            <video
                key={videoKey}
                src={`/${pfp}`}
                className="absolute inset-0 w-full h-full object-cover rounded-[calc(1.5rem-4px)]"
                autoPlay
                muted
                playsInline
                preload={pfp.includes("standby") ? "auto" : "metadata"}
                loop={loop}
                onEnded={handleVideoEnded}
            />
        </div>
    );
} 