import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface ShinyTextProps {
  text: string;
  /** Base text colour */
  color?: string;
  /** Colour of the sweeping highlight */
  shineColor?: string;
  /** Seconds per sweep */
  speed?: number;
  /** Gradient angle in degrees */
  spread?: number;
  className?: string;
}

/** A highlight that sweeps continuously across the text, left to right. */
export function ShinyText({
  text,
  color = '#64CEFB',
  shineColor = '#ffffff',
  speed = 3,
  spread = 100,
  className = '',
}: ShinyTextProps) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className={`inline-block ${className}`}
      style={{
        backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: 'transparent',
      }}
      initial={{ backgroundPosition: '150% center' }}
      animate={reduce ? undefined : { backgroundPosition: ['150% center', '-50% center'] }}
      transition={{ duration: speed, ease: 'linear', repeat: Infinity }}
    >
      {text}
    </motion.span>
  );
}
