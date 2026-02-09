import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import rishflowVideo from '../../assets/video/rishflow_video.mp4';
import splashAudio from '../../assets/audio/dragon-studio-elemental-spell-impact-water-478377.mp3';

interface SplashScreenProps {
    onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hasCompletedRef = useRef(false);

    const handleComplete = () => {
        if (hasCompletedRef.current) return;
        hasCompletedRef.current = true;
        onComplete();
    };

    useEffect(() => {
        const audio = new Audio(splashAudio);
        audio.volume = 0.8; // Set volume to 80%

        const playContent = async () => {
            try {
                if (videoRef.current) {
                    await videoRef.current.play();
                }
                await audio.play();
            } catch (error) {
                console.error("Autoplay failed:", error);
                // If autoplay fails, we shouldn't block. Ensure fallback runs.
            }
        };

        playContent();

        // Fallback: If video doesn't end (or very long), force skip after 12 seconds
        // (Assuming video is around 5-10s normally?)
        const fallbackTimer = setTimeout(() => {
            console.warn("Splash screen fallback timeout triggered");
            handleComplete();
        }, 12000);

        // Cleanup audio on unmount
        return () => {
            clearTimeout(fallbackTimer);
            audio.pause();
            audio.currentTime = 0;
        };
    }, []);

    return (
        <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
        >
            <video
                ref={videoRef}
                src={rishflowVideo}
                className="w-full h-full object-cover"
                muted
                playsInline
                onEnded={handleComplete}
                onError={(e) => {
                    console.error("Video error:", e);
                    handleComplete(); // Skip if video fails to load
                }}
                style={{ pointerEvents: 'none' }}
            />

            {/* Skip Button */}
            <button
                onClick={handleComplete}
                className="absolute top-8 right-8 text-white/50 hover:text-white bg-black/20 hover:bg-black/40 px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm transition-all border border-white/10 z-[110]"
            >
                Skip Intro
            </button>
        </motion.div>
    );
}
