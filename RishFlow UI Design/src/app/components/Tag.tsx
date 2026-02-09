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
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 ${className}`}
      style={color ? { backgroundColor: `${color}15`, color: color, borderColor: `${color}30` } : undefined}
    >
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
