import React from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

/** A liquid fill: gradient body with a moving highlight. */
export function ProgressBar({ value, max = 100, className = '', showLabel = false, size = 'md', color }: ProgressBarProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  const heights = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' };
  const fill = color ?? 'var(--primary)';

  return (
    <div className={`w-full ${className}`}>
      <div className={`relative w-full overflow-hidden rounded-full bg-secondary ${heights[size]}`}>
        <div
          className="relative h-full overflow-hidden rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, color-mix(in srgb, ${fill} 55%, transparent), ${fill})`,
            boxShadow: `0 0 12px -2px ${fill}`,
          }}
        >
          <span className="animate-sheen absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        </div>
      </div>
      {showLabel && <span className="mt-1 block text-xs text-muted-foreground">{pct.toFixed(0)}%</span>}
    </div>
  );
}
