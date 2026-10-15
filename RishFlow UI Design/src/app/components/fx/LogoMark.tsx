import React from 'react';

interface LogoMarkProps {
  size?: number;
  /** 0–1: how full of water the inner orb is */
  level?: number;
  className?: string;
  /** Ring/water colour; defaults to currentColor */
  color?: string;
}

/**
 * RishFlow mark: a thin ring holding an orb of moving water.
 * Pure CSS so it renders crisply at any size and animates for free.
 */
export function LogoMark({ size = 28, level = 0.62, className = '', color = 'currentColor' }: LogoMarkProps) {
  const inner = size * 0.64;
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ width: size, height: size, border: `${Math.max(1.5, size / 14)}px solid ${color}`, color }}
      aria-hidden
    >
      <span
        className="relative overflow-hidden rounded-full"
        style={{ width: inner, height: inner, boxShadow: `inset 0 0 0 ${Math.max(1, size / 28)}px ${color}` }}
      >
        <Wave color={color} level={level} className="animate-wave" opacity={1} />
        <Wave color={color} level={level + 0.08} className="animate-wave-slow" opacity={0.45} />
      </span>
    </span>
  );
}

function Wave({ color, level, className, opacity }: { color: string; level: number; className: string; opacity: number }) {
  const top = `${(1 - Math.min(Math.max(level, 0), 1)) * 100}%`;
  return (
    <span className="absolute inset-x-0 bottom-0" style={{ top: `calc(${top} - 18%)` }}>
      <svg
        className={`absolute left-0 top-0 h-full ${className}`}
        style={{ width: '200%', opacity }}
        viewBox="0 0 200 100"
        preserveAspectRatio="none"
      >
        <path
          d="M0 14 Q 12.5 4 25 14 T 50 14 T 75 14 T 100 14 T 125 14 T 150 14 T 175 14 T 200 14 V 100 H 0 Z"
          fill={color}
        />
      </svg>
    </span>
  );
}
