import React, { useMemo } from 'react';

interface AmbientBackgroundProps {
  bubbles?: number;
  className?: string;
}

/**
 * Slow-drifting caustic light and a few rising bubbles. Sits behind the
 * whole app; every colour comes from theme tokens.
 */
export function AmbientBackground({ bubbles = 14, className = '' }: AmbientBackgroundProps) {
  const dots = useMemo(
    () =>
      Array.from({ length: bubbles }, (_, i) => ({
        left: `${(i * 37 + 11) % 100}%`,
        size: 3 + ((i * 7) % 7),
        dur: `${11 + ((i * 5) % 9)}s`,
        delay: `${-((i * 1.7) % 14)}s`,
        sway: `${((i % 2 ? 1 : -1) * (8 + (i % 5) * 6)).toFixed(0)}px`,
      })),
    [bubbles],
  );

  return (
    <div className={`pointer-events-none fixed inset-0 -z-0 overflow-hidden ${className}`} aria-hidden>
      <div
        className="animate-caustic absolute -left-[20%] -top-[30%] h-[80vh] w-[80vw] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(closest-side, var(--caustic-1), transparent)' }}
      />
      <div
        className="animate-caustic-slow absolute -right-[15%] top-[20%] h-[70vh] w-[60vw] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(closest-side, var(--caustic-2), transparent)' }}
      />
      <div
        className="animate-caustic absolute -bottom-[30%] left-[25%] h-[70vh] w-[70vw] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(closest-side, var(--caustic-3), transparent)', animationDelay: '-9s' }}
      />
      {/* fine grain keeps large gradients from banding */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      {dots.map((d, i) => (
        <span
          key={i}
          className="animate-rise absolute bottom-[-20px] rounded-full"
          style={
            {
              left: d.left,
              width: d.size,
              height: d.size,
              border: '1px solid color-mix(in srgb, var(--primary) 45%, transparent)',
              background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
              '--dur': d.dur,
              '--delay': d.delay,
              '--sway': d.sway,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
