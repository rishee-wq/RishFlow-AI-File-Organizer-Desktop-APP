import React, { forwardRef, useState } from 'react';

interface VideoBackdropProps extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, 'src'> {
  src: string;
  /** Painted behind the video, and all that shows if it can't load (offline). */
  fallback?: string;
  className?: string;
  videoClassName?: string;
}

/**
 * Absolutely-positioned background video. The videos stream from a CDN, so
 * an animated water gradient sits underneath and the video fades in only
 * once it has data — offline, the app still looks finished.
 */
export const VideoBackdrop = forwardRef<HTMLVideoElement, VideoBackdropProps>(function VideoBackdrop(
  { src, fallback, className = '', videoClassName = '', ...videoProps },
  ref,
) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div
        className="animate-flow-gradient absolute inset-0"
        style={{
          backgroundImage:
            fallback ??
            'linear-gradient(135deg, #02060b 0%, #06263a 35%, #0b4d6e 55%, #041824 75%, #02060b 100%)',
        }}
      />
      {!failed && (
        <video
          ref={ref}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
            ready ? 'opacity-100' : 'opacity-0'
          } ${videoClassName}`}
          onLoadedData={() => setReady(true)}
          onError={() => setFailed(true)}
          {...videoProps}
        >
          <source src={src} type="video/mp4" onError={() => setFailed(true)} />
        </video>
      )}
    </div>
  );
});
