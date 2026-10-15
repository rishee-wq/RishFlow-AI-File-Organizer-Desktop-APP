import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', size = 'md', children, className = '', ...props }: ButtonProps) {
  const base =
    'group/btn relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl font-medium transition-all duration-300 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45';

  const variants = {
    primary:
      'bg-primary text-primary-foreground shadow-[0_8px_30px_-10px_var(--glow)] hover:shadow-[0_12px_40px_-8px_var(--glow)] hover:brightness-110',
    secondary: 'glass text-foreground hover:border-border-strong hover:bg-accent/60',
    outline: 'border border-border-strong text-foreground hover:bg-primary/10',
    ghost: 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
    destructive:
      'bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive hover:text-destructive-foreground',
  };

  const sizes = {
    sm: 'h-9 px-3.5 text-sm',
    md: 'h-11 px-5 text-sm',
    lg: 'h-13 px-7 text-base',
    icon: 'h-9 w-9 p-0',
  };

  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {variant === 'primary' && (
        <span
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-[120%] bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-0 group-hover/btn:animate-sheen group-hover/btn:opacity-100"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}
