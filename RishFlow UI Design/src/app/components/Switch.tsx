import React from 'react';
import { motion } from 'motion/react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, description, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-accent/40"
    >
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium text-foreground">{label}</span>}
          {description && <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>}
        </span>
      )}
      <span
        className={`relative flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition-colors duration-300 ${
          checked ? 'justify-end border-primary/50 bg-primary' : 'justify-start border-border bg-secondary'
        }`}
        style={checked ? { boxShadow: '0 0 18px -4px var(--glow)' } : undefined}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 520, damping: 32 }}
          className={`block h-[18px] w-[18px] rounded-full shadow-md ${checked ? 'bg-primary-foreground' : 'bg-muted-foreground/70'}`}
        />
      </span>
    </button>
  );
}
