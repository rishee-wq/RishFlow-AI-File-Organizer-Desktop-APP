import { useEffect, useRef, useState } from 'react';
import { animate } from 'motion/react';

/** Smoothly animates a number from its previous value to `value`. */
export function useCountUp(value: number, duration = 1.1) {
  const [display, setDisplay] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const controls = animate(from.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, duration]);

  return display;
}
