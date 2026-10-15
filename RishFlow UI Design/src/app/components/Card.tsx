import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  style?: React.CSSProperties;
}

export function Card({ children, className = '', hover = false, style }: CardProps) {
  return (
    <div
      style={style}
      className={`glass edge-light relative overflow-hidden rounded-2xl text-foreground ${
        hover
          ? 'transition-all duration-500 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_24px_60px_-28px_var(--glow)]'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 pb-4 ${className}`}>{children}</div>;
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 pt-0 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-base font-semibold tracking-tight text-foreground ${className}`}>{children}</h3>;
}
