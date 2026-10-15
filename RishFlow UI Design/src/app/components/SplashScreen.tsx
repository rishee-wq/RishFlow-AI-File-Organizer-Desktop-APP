import React, { useEffect, useRef, useState } from 'react';
import { animate, motion, useReducedMotion } from 'motion/react';
import { pythonAPI } from '@/api/pywebview';
import { LogoMark } from './fx/LogoMark';
import { playDropSound } from '../lib/dropSound';

interface SplashScreenProps {
  onComplete: () => void;
}

const CYAN = '#64CEFB';
const IMPACT = 0.75; // seconds until the droplet meets the surface
const MIN_DURATION = 3600; // ms — the sequence is choreographed to this
const STATUSES = ['Waking the current', 'Mapping your streams', 'Calibrating the AI', 'Ready to flow'];

/**
 * Code-driven intro: a droplet falls, hits the surface, ripples spread,
 * the logo orb fills with water and the wordmark surfaces from the blur.
 */
export function SplashScreen({ onComplete }: SplashScreenProps) {
  const reduce = useReducedMotion();
  const doneRef = useRef(false);
  const [level, setLevel] = useState(0);
  const [status, setStatus] = useState(0);
  const [progress, setProgress] = useState(0);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete();
  };

  useEffect(() => {
    const start = performance.now();
    const minDuration = reduce ? 900 : MIN_DURATION;

    // Drop sound the moment the droplet meets the surface
    let stopSound = () => {};
    const soundTimer = reduce
      ? undefined
      : setTimeout(() => {
          stopSound = playDropSound(0.5);
        }, IMPACT * 1000 - 20);

    // Orb fills after impact
    const fill = animate(0, 0.62, {
      delay: reduce ? 0 : IMPACT + 0.25,
      duration: reduce ? 0.01 : 1.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: setLevel,
    });

    // Progress + status copy track elapsed time and backend readiness
    let apiReady = false;
    pythonAPI
      .initialize()
      .catch(() => {})
      .finally(() => {
        apiReady = true;
      });

    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      const timeShare = Math.min(elapsed / minDuration, 1);
      // Hold at 92% until the Python bridge has answered (max ~3s)
      const p = apiReady ? timeShare : Math.min(timeShare, 0.92);
      setProgress(p);
      setStatus(Math.min(Math.floor(p * STATUSES.length), STATUSES.length - 1));
      if (p >= 1) {
        setTimeout(finish, reduce ? 0 : 250);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // rAF pauses while the window is hidden/minimized — never hang the launch on it
    const safety = setTimeout(finish, minDuration + 4500);

    const skip = () => finish();
    window.addEventListener('keydown', skip);

    return () => {
      clearTimeout(safety);
      cancelAnimationFrame(raf);
      fill.stop();
      if (soundTimer) clearTimeout(soundTimer);
      window.removeEventListener('keydown', skip);
      stopSound();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const word = 'RishFlow'.split('');

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex cursor-pointer items-center justify-center overflow-hidden bg-[#02060b] font-sans text-white select-none"
      onClick={finish}
      initial={{ opacity: 1 }}
      exit={{
        opacity: 0,
        scale: 1.06,
        filter: 'blur(12px)',
        transition: { duration: 0.8, ease: [0.65, 0, 0.35, 1] },
      }}
    >
      {/* Light falling through water */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <motion.div
          className="absolute -top-1/4 left-1/2 h-[90vh] w-[90vw] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: `radial-gradient(closest-side, ${CYAN}22, transparent)` }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 2.4, ease: 'easeOut' }}
        />
        {[-34, -16, 0, 14, 30].map((x, i) => (
          <motion.div
            key={i}
            className="absolute -top-[10%] h-[85%] w-[9vw] origin-top blur-2xl"
            style={{
              left: `${50 + x}%`,
              background: `linear-gradient(to bottom, ${CYAN}26, transparent 75%)`,
              transform: `skewX(${x * 0.6}deg)`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.9, 0.35, 0.8] }}
            transition={{ duration: 4.5, delay: 0.2 + i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <div className="relative flex flex-col items-center">
        {/* Droplet */}
        {!reduce && (
          <motion.div
            className="absolute left-1/2 top-[44px] h-5 w-3.5 -translate-x-1/2"
            style={{
              borderRadius: '50% 50% 50% 50% / 62% 62% 38% 38%',
              background: `linear-gradient(180deg, #ffffff, ${CYAN})`,
              boxShadow: `0 0 24px 4px ${CYAN}88`,
            }}
            initial={{ y: '-52vh', scaleY: 1.5, opacity: 0 }}
            animate={{ y: 0, scaleY: [1.5, 1.7, 0.6], opacity: [0, 1, 1, 0] }}
            transition={{ duration: IMPACT, ease: [0.55, 0, 1, 0.45], times: [0, 0.2, 0.96, 1] }}
          />
        )}

        {/* Ripples spreading over the surface */}
        <div className="pointer-events-none absolute left-1/2 top-[54px] -translate-x-1/2 -translate-y-1/2" aria-hidden>
          {[0, 0.16, 0.34, 0.6].map((d, i) => (
            <motion.span
              key={i}
              className="absolute left-1/2 top-1/2 block h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ border: `1.5px solid ${CYAN}`, scaleY: 0.38 }}
              initial={{ opacity: 0, scale: 0.1 }}
              animate={{ opacity: [0, 0.8, 0], scale: [0.1, 3.6 + i * 0.5] }}
              transition={{ duration: 2.2, delay: (reduce ? 0 : IMPACT) + d, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
          {/* Impact flash */}
          <motion.span
            className="absolute left-1/2 top-1/2 block h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
            style={{ background: CYAN }}
            initial={{ opacity: 0, scale: 0.2 }}
            animate={{ opacity: [0, 0.55, 0], scale: [0.2, 1.6, 2.2] }}
            transition={{ duration: 1.1, delay: reduce ? 0 : IMPACT - 0.02, ease: 'easeOut' }}
          />
        </div>

        {/* Logo orb */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.4, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16, delay: reduce ? 0 : IMPACT + 0.05 }}
        >
          <div className="absolute inset-0 -m-6 rounded-full blur-2xl" style={{ background: `${CYAN}30` }} />
          <LogoMark size={108} level={level} color="#ffffff" className="relative" />
        </motion.div>

        {/* Wordmark */}
        <h1 className="relative mt-10 flex overflow-hidden text-6xl font-semibold tracking-tighter sm:text-7xl">
          {word.map((ch, i) => (
            <motion.span
              key={i}
              className="inline-block"
              style={i >= 4 ? { color: CYAN } : undefined}
              initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, delay: (reduce ? 0 : 1.15) + i * 0.055, ease: [0.22, 1, 0.36, 1] }}
            >
              {ch}
            </motion.span>
          ))}
          {/* One sheen across the finished word */}
          {!reduce && (
            <motion.span
              className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent mix-blend-overlay"
              initial={{ left: '-40%' }}
              animate={{ left: '120%' }}
              transition={{ duration: 1.1, delay: 2.0, ease: 'easeInOut' }}
              aria-hidden
            />
          )}
        </h1>

        <motion.p
          className="mt-4 text-xs font-medium uppercase text-white/55"
          initial={{ opacity: 0, letterSpacing: '0.1em', y: 8 }}
          animate={{ opacity: 1, letterSpacing: '0.42em', y: 0 }}
          transition={{ duration: 1.2, delay: reduce ? 0 : 1.75, ease: [0.22, 1, 0.36, 1] }}
        >
          Organize at the speed of flow
        </motion.p>
      </div>

      {/* Liquid progress */}
      <motion.div
        className="absolute bottom-14 left-1/2 w-[min(320px,70vw)] -translate-x-1/2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 1.3, duration: 0.6 }}
      >
        <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${progress * 100}%`,
              background: `linear-gradient(90deg, ${CYAN}55, ${CYAN}, #ffffff)`,
              boxShadow: `0 0 14px ${CYAN}`,
            }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] font-medium tracking-wide text-white/40">
          <motion.span key={status} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
            {STATUSES[status]}
            {status < STATUSES.length - 1 && '…'}
          </motion.span>
          <span className="tabular-nums">{Math.round(progress * 100)}%</span>
        </div>
      </motion.div>

      <motion.span
        className="absolute bottom-6 right-8 text-[11px] tracking-wide text-white/25"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        Click or press any key to skip
      </motion.span>
    </motion.div>
  );
}
