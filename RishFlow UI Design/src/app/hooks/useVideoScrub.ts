import { useEffect, type RefObject } from 'react';

const DESKTOP = 1024;

/**
 * Desktop: horizontal mouse movement scrubs the video timeline.
 * Below 1024px scrubbing is disabled and the video simply autoplays.
 */
export function useVideoScrub(videoRef: RefObject<HTMLVideoElement | null>) {
  // Desktop mouse scrubbing
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let prevX: number | null = null;
    let targetTime = 0;
    let seeking = false;

    const apply = () => {
      if (!video.duration || Number.isNaN(video.duration)) return;
      seeking = true;
      video.currentTime = targetTime;
    };

    const onSeeked = () => {
      seeking = false;
      // Catch up if the pointer moved while the last seek was in flight
      if (Math.abs(video.currentTime - targetTime) > 0.01) apply();
    };

    const onMove = (e: MouseEvent) => {
      if (window.innerWidth < DESKTOP) return;
      const duration = video.duration;
      if (!duration || Number.isNaN(duration)) return;

      if (prevX === null) {
        prevX = e.clientX;
        targetTime = video.currentTime;
        return;
      }
      const delta = e.clientX - prevX;
      prevX = e.clientX;
      targetTime = Math.min(
        Math.max(targetTime + (delta / window.innerWidth) * 0.8 * duration, 0),
        duration,
      );
      if (!seeking) apply();
    };

    video.addEventListener('seeked', onSeeked);
    window.addEventListener('mousemove', onMove);
    return () => {
      video.removeEventListener('seeked', onSeeked);
      window.removeEventListener('mousemove', onMove);
    };
  }, [videoRef]);

  // Mobile autoplay
  useEffect(() => {
    const video = videoRef.current;
    if (!video || window.innerWidth >= DESKTOP) return;
    video.autoplay = true;
    video.loop = true;
    video.play().catch(() => {});
  }, [videoRef]);
}
