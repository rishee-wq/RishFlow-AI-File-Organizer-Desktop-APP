import React from 'react';
import { X } from 'lucide-react';

interface TagProps {
  children: React.ReactNode;
  onRemove?: () => void;
  color?: string;
  className?: string;
}

export function Tag({ children, onRemove, color, className = '' }: TagProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary ${className}`}
      style={color ? { backgroundColor: `${color}1a`, color, borderColor: `${color}40` } : undefined}
    >
      {children}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-primary/20">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
