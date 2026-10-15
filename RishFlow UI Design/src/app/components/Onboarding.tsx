import React, { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Cpu,
  FolderInput,
  FolderOpen,
  HardDrive,
  Laptop,
  Loader2,
  MemoryStick,
  Monitor,
  MonitorCog,
  RotateCcw,
  PencilLine,
} from 'lucide-react';
import { toast } from 'sonner';
import { pythonAPI, type SystemInfo } from '@/api/pywebview';
import { useProfile, detectSystem, profileFromSystem, type Profile } from '../contexts/ProfileContext';
import { useTheme, THEMES } from '../contexts/ThemeContext';
import { LogoMark } from './fx/LogoMark';
import { useTypewriter } from '../hooks/useTypewriter';
import { SORT_MODES, baseName, type SortModeId } from '../lib/files';

const HERO_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260506_081238_406ed0e3-5d83-436e-a512-0bbff7ec5b95.mp4';

const FOCUS_TYPES = [
  { name: 'Documents', icon: '📄', color: '#38bdf8' },
  { name: 'Images', icon: '📷', color: '#f472b6' },
  { name: 'Audio', icon: '🎵', color: '#fbbf24' },
  { name: 'Video', icon: '🎬', color: '#2dd4bf' },
  { name: 'Spreadsheets', icon: '📊', color: '#34d399' },
  { name: 'Archives', icon: '🗜️', color: '#fb923c' },
];

const STEPS = ['Meet your machine', 'Connect your streams', 'Set your current'];

type Phase = 0 | 1 | 2 | 'welcome';

const heroContainer: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.2 } },
};
const heroItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

interface OnboardingProps {
  onEnter: () => void;
}

export function Onboarding({ onEnter }: OnboardingProps) {
  const { profile, saveProfile, clearProfile } = useProfile();
  const { theme, setTheme } = useTheme();

  const [phase, setPhase] = useState<Phase>(profile ? 'welcome' : 0);
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [workspace, setWorkspace] = useState(profile?.workspace ?? '');
  const [device, setDevice] = useState<SystemInfo | null>(profile?.device ?? null);
  const [editingName, setEditingName] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [dest, setDest] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortModeId>('AI-based Content');
  const [focus, setFocus] = useState<string[]>(profile?.focusTypes ?? []);
  const [picking, setPicking] = useState<'source' | 'dest' | null>(null);
  const [entering, setEntering] = useState(false);

  // Previously chosen folders + sort mode
  useEffect(() => {
    pythonAPI
      .initialize()
      .then(async () => {
        if (!pythonAPI.available) return;
        const [s, d, m] = await Promise.all([
          pythonAPI.loadState('last_source_folder'),
          pythonAPI.loadState('last_dest_folder'),
          pythonAPI.loadState('default_sort_mode'),
        ]);
        if (s?.value) setSource(s.value);
        if (d?.value) setDest(d.value);
        if (m?.value && SORT_MODES.some((x) => x.id === m.value)) setSortMode(m.value);
      })
      .catch(() => {});
  }, []);

  // First launch: detect this computer and create the profile from it right away.
  // Profiles made before auto-detection get their device details filled in.
  useEffect(() => {
    if (profile?.device) return;
    let cancelled = false;
    detectSystem().then((info) => {
      if (cancelled) return;
      setDevice(info);
      if (profile) {
        saveProfile({ ...profile, device: info });
      } else {
        const created = profileFromSystem(info);
        setFirstName(created.firstName);
        setWorkspace(created.workspace);
        saveProfile(created);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stepIndex = phase === 'welcome' ? 3 : phase;

  const pickFolder = async (which: 'source' | 'dest') => {
    if (!pythonAPI.available) {
      toast.info('The folder picker opens in the RishFlow desktop app.');
      return;
    }
    try {
      setPicking(which);
      const folder = await pythonAPI.browseFolder(which === 'source' ? 'Select Folder to Organize' : 'Select Destination Folder');
      if (which === 'source') setSource(folder);
      else setDest(folder);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== 'No folder selected') toast.error('Could not open folder', { description: msg });
    } finally {
      setPicking(null);
    }
  };

  const toggleFocus = (name: string) =>
    setFocus((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const persistAndEnter = async (next: Profile) => {
    setEntering(true);
    saveProfile(next);
    if (pythonAPI.available) {
      try {
        if (source) await pythonAPI.saveState('last_source_folder', source);
        if (dest) await pythonAPI.saveState('last_dest_folder', dest);
        await pythonAPI.saveState('default_sort_mode', sortMode);

        // Each focus type becomes a category the AI sorter can match against
        if (next.focusTypes.length) {
          const existing = (await pythonAPI.loadState('user_categories'))?.value ?? {};
          const custom: any[] = Array.isArray(existing.custom) ? existing.custom : [];
          const hidden: string[] = Array.isArray(existing.hidden) ? existing.hidden : [];
          FOCUS_TYPES.filter((f) => next.focusTypes.includes(f.name)).forEach((f, i) => {
            if (!custom.some((c) => c.name === f.name)) {
              custom.push({ id: `cat_${Date.now()}_${i}`, name: f.name, fileCount: 0, color: f.color, icon: f.icon, lastModified: 'just now' });
            }
          });
          await pythonAPI.saveState('user_categories', {
            custom,
            hidden: hidden.filter((h) => !next.focusTypes.includes(h)),
          });
        }
      } catch {
        /* non-fatal: the app works without these */
      }
    }
    onEnter();
  };

  const buildProfile = (): Profile => {
    const name = firstName.trim() || device?.name || 'My Computer';
    return {
      firstName: name,
      lastName: lastName.trim(),
      workspace: workspace.trim() || device?.model || `${name}'s Workspace`,
      focusTypes: focus,
      createdAt: profile?.createdAt ?? new Date().toISOString(),
      device: device ?? undefined,
    };
  };

  const continueFromSystem = () => {
    const next = buildProfile();
    setFirstName(next.firstName);
    setEditingName(false);
    saveProfile(next);
    setPhase(1);
  };

  return (
    <main className="flex min-h-screen w-full bg-black p-2 font-sans text-white antialiased transition-all duration-500 selection:bg-white/30 lg:h-screen lg:overflow-hidden lg:p-4">
      {/* ─────────── Left column: hero video ─────────── */}
      <section className="relative hidden h-full w-[52%] flex-col items-center justify-end overflow-hidden rounded-3xl px-12 pb-32 shadow-2xl lg:flex">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: 'hue-rotate(-62deg) saturate(1.15)' }}
          autoPlay
          muted
          loop
          playsInline
        >
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>

        <motion.div
          className="relative z-10 w-full max-w-xs space-y-8"
          variants={heroContainer}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={heroItem} className="flex items-center justify-center gap-2.5">
            <LogoMark size={26} color="#ffffff" />
            <span className="text-xl font-semibold tracking-tight">RishFlow</span>
          </motion.div>

          <motion.div variants={heroItem} className="space-y-3 text-center">
            <h1 className="whitespace-nowrap text-4xl font-medium tracking-tight">
              {phase === 'welcome' ? 'Welcome back' : 'Join RishFlow'}
            </h1>
            <p className="px-4 text-sm leading-relaxed text-white/60">
              {phase === 'welcome'
                ? `${profile?.workspace || 'Your workspace'} is calm and ready to flow.`
                : 'Follow these 3 quick phases to let your files find their flow.'}
            </p>
          </motion.div>

          <div className="space-y-3">
            {STEPS.map((text, i) => (
              <motion.div key={text} variants={heroItem}>
                <StepItem number={i + 1} text={text} active={stepIndex === i} done={stepIndex > i} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ─────────── Right column: setup flow ─────────── */}
      <section className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-12 sm:px-12 lg:px-16 lg:py-6 xl:px-24">
        <motion.div
          className="w-full max-w-xl space-y-8 sm:space-y-10 lg:space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          {/* Mobile brand (the hero column is desktop-only) */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <LogoMark size={24} color="#ffffff" />
            <span className="text-lg font-semibold tracking-tight">RishFlow</span>
          </div>

          {phase !== 'welcome' && <PhaseMeter step={phase} />}

          <AnimatePresence mode="wait">
            <motion.div
              key={String(phase)}
              initial={{ opacity: 0, x: 24, filter: 'blur(6px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: -24, filter: 'blur(6px)' }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-8 lg:space-y-6"
            >
              {phase === 0 && (
                <>
                  <Header
                    title={device ? 'Meet your machine' : 'Detecting your system…'}
                    subtitle="Your profile is named after this computer and created automatically. Nothing leaves this device."
                  />

                  <SystemCard
                    info={device}
                    name={firstName}
                    editing={editingName}
                    onEdit={() => setEditingName(true)}
                    onName={setFirstName}
                    onDone={() => setEditingName(false)}
                  />

                  <PrimaryButton onClick={continueFromSystem} disabled={!device}>
                    {device ? (
                      <>
                        Continue <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </>
                    ) : (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Detecting…
                      </>
                    )}
                  </PrimaryButton>
                </>
              )}

              {phase === 1 && (
                <>
                  <Header title="Connect your streams" subtitle="Pick where the chaos lives and where order should land. You can skip this and do it later." />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FolderTile
                      icon={<FolderOpen className="h-5 w-5" />}
                      label="Source folder"
                      path={source}
                      loading={picking === 'source'}
                      onClick={() => pickFolder('source')}
                    />
                    <FolderTile
                      icon={<FolderInput className="h-5 w-5" />}
                      label="Destination folder"
                      path={dest}
                      loading={picking === 'dest'}
                      onClick={() => pickFolder('dest')}
                    />
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-white">Default sort strategy</p>
                    <div className="flex flex-wrap gap-2">
                      {SORT_MODES.map((m) => (
                        <Pill key={m.id} label={m.label} active={sortMode === m.id} onClick={() => setSortMode(m.id)} />
                      ))}
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={sortMode}
                        className="text-xs text-white/40"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                      >
                        {SORT_MODES.find((m) => m.id === sortMode)?.hint}
                      </motion.p>
                    </AnimatePresence>
                  </div>

                  <NavRow onBack={() => setPhase(0)} onNext={() => setPhase(2)} nextLabel={source || dest ? 'Continue' : 'Skip for now'} />
                </>
              )}

              {phase === 2 && (
                <>
                  <Header title="Set your current" subtitle="Choose a look, then tell us what you sort most." />

                  <div className="grid grid-cols-3 gap-3">
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id)}
                        className={`group rounded-2xl p-2 text-left transition-all ${
                          theme === t.id ? 'bg-white/[0.06] ring-2 ring-brand-cyan' : 'bg-brand-gray hover:bg-white/[0.06]'
                        }`}
                      >
                        <ThemePreview swatch={t.swatch} />
                        <div className="mt-2 flex items-center justify-between px-1">
                          <span className="text-sm font-medium">{t.name}</span>
                          {theme === t.id && <Check className="h-3.5 w-3.5 text-brand-cyan" />}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xl font-medium tracking-tight">What do you usually sort?</p>
                      <p className="text-sm text-white/40">Select all that apply</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {FOCUS_TYPES.map((f) => (
                        <Pill key={f.name} label={f.name} active={focus.includes(f.name)} onClick={() => toggleFocus(f.name)} />
                      ))}
                    </div>
                    <AnimatePresence mode="wait">
                      {focus.length === 0 ? (
                        <motion.p
                          key="empty"
                          className="text-xs italic"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 0.5 }}
                          exit={{ opacity: 0 }}
                        >
                          Tap the types above — we'll create a category for each one.
                        </motion.p>
                      ) : (
                        <motion.div
                          key="banner"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                          className="overflow-hidden"
                        >
                          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                            <p className="min-w-0 text-sm text-white/70">
                              Ready to flow through: <span className="text-white">{focus.join(', ')}</span>
                            </p>
                            <button
                              type="button"
                              onClick={() => persistAndEnter(buildProfile())}
                              className="group flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-cyan"
                            >
                              Let's Go <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex gap-3">
                    <BackButton onClick={() => setPhase(1)} />
                    <PrimaryButton onClick={() => persistAndEnter(buildProfile())} disabled={entering}>
                      {entering ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enter RishFlow'}
                      {!entering && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
                    </PrimaryButton>
                  </div>
                </>
              )}

              {phase === 'welcome' && profile && (
                <WelcomeBack
                  profile={profile}
                  source={source}
                  dest={dest}
                  entering={entering}
                  onEnter={() => persistAndEnter({ ...profile })}
                  onEdit={() => setPhase(0)}
                  onReset={() => {
                    // Start over from this computer's details
                    const fresh = device ? profileFromSystem(device) : null;
                    clearProfile();
                    if (fresh) saveProfile(fresh);
                    setFirstName(fresh?.firstName ?? '');
                    setLastName('');
                    setWorkspace(fresh?.workspace ?? '');
                    setFocus([]);
                    setPhase(0);
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {phase !== 'welcome' && (
            <p className="text-center text-sm text-white/40">
              Been here before?{' '}
              <button
                type="button"
                onClick={() => persistAndEnter(buildProfile())}
                disabled={!device}
                className="font-medium text-white underline-offset-4 hover:underline disabled:opacity-40"
              >
                Skip setup
              </button>
            </p>
          )}
        </motion.div>
      </section>
    </main>
  );
}

/* ───────────────────────── Pieces ───────────────────────── */

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-2">
      <h2 className="text-3xl font-medium tracking-tight">{title}</h2>
      <p className="text-sm text-white/40">{subtitle}</p>
    </div>
  );
}

function PhaseMeter({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-brand-cyan"
              initial={false}
              animate={{ width: i <= step ? '100%' : '0%' }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        ))}
      </div>
      <span className="text-xs tabular-nums text-white/40">Phase {step + 1} of 3</span>
    </div>
  );
}

function PrimaryButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`group mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-white font-semibold text-black transition-all hover:bg-white/90 active:scale-[0.98] disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 transition-colors hover:bg-white/5"
      aria-label="Back"
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
}

function NavRow({ onBack, onNext, nextLabel }: { onBack: () => void; onNext: () => void; nextLabel: string }) {
  return (
    <div className="flex gap-3">
      <BackButton onClick={onBack} />
      <PrimaryButton onClick={onNext}>
        {nextLabel} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </PrimaryButton>
    </div>
  );
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      layout
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-white text-black shadow-md shadow-cyan-400/10'
          : 'border border-white/10 bg-brand-gray text-white hover:bg-white/10'
      }`}
    >
      <AnimatePresence initial={false}>
        {active && (
          <motion.span
            initial={{ scale: 0, width: 0, opacity: 0 }}
            animate={{ scale: 1, width: 'auto', opacity: 1 }}
            exit={{ scale: 0, width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="flex"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
      {label}
    </motion.button>
  );
}

function FolderTile({
  icon,
  label,
  path,
  loading,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  path: string | null;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`group relative flex flex-col items-start gap-4 overflow-hidden rounded-2xl border p-5 text-left transition-all hover:bg-white/5 ${
        path ? 'border-brand-cyan/40 bg-brand-cyan/[0.04]' : 'border-white/10 bg-black'
      }`}
    >
      <div className="flex w-full items-center justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            path ? 'bg-brand-cyan text-black' : 'bg-brand-gray text-white/70'
          }`}
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
        </span>
        {path && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Check className="h-4 w-4 text-brand-cyan" strokeWidth={3} />
          </motion.span>
        )}
      </div>
      <div className="w-full min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 truncate text-xs text-white/40" title={path ?? undefined}>
          {path ? baseName(path) : 'Choose folder…'}
        </p>
      </div>
    </button>
  );
}

function ThemePreview({ swatch }: { swatch: [string, string, string] }) {
  const [bg, surface, accent] = swatch;
  return (
    <div className="flex h-16 gap-1 overflow-hidden rounded-xl p-1.5" style={{ background: bg }}>
      <div className="w-1/4 rounded-md" style={{ background: surface }} />
      <div className="flex flex-1 flex-col gap-1">
        <div className="h-2 w-2/3 rounded-full" style={{ background: accent }} />
        <div className="h-1.5 w-1/2 rounded-full opacity-40" style={{ background: accent }} />
        <div className="mt-auto h-5 rounded-md" style={{ background: surface }} />
      </div>
    </div>
  );
}

function WelcomeBack({
  profile,
  source,
  dest,
  entering,
  onEnter,
  onEdit,
  onReset,
}: {
  profile: Profile;
  source: string | null;
  dest: string | null;
  entering: boolean;
  onEnter: () => void;
  onEdit: () => void;
  onReset: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const name = profile.firstName || 'Explorer';
  const { displayed, done } = useTypewriter(`Welcome back,\n${name}.`, 42, 350);

  return (
    <>
      <h2 className="min-h-[2.2em] whitespace-pre-wrap text-5xl font-medium leading-[1.08] tracking-tight">
        {displayed}
        {!done && <span className="ml-[2px] inline-block h-[1em] w-[2px] animate-blink bg-white align-middle" />}
      </h2>

      <div className="space-y-px overflow-hidden rounded-2xl border border-white/10">
        <Row label="Workspace" value={profile.workspace} />
        <Row label="Source" value={source ? baseName(source) : 'Not set'} title={source ?? undefined} />
        <Row label="Destination" value={dest ? baseName(dest) : 'Not set'} title={dest ?? undefined} />
        <div className="flex items-center justify-between bg-brand-gray/60 px-4 py-3">
          <span className="text-sm text-white/40">Current</span>
          <div className="flex gap-1.5">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                title={t.name}
                className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                  theme === t.id ? 'border-white' : 'border-transparent'
                }`}
                style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 40%, ${t.swatch[2]})` }}
              />
            ))}
          </div>
        </div>
      </div>

      <PrimaryButton onClick={onEnter} disabled={entering}>
        {entering ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enter RishFlow'}
        {!entering && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
      </PrimaryButton>

      <div className="flex items-center justify-center gap-6 text-sm text-white/40">
        <button type="button" onClick={onEdit} className="flex items-center gap-1.5 transition-colors hover:text-white">
          <PencilLine className="h-3.5 w-3.5" /> Edit profile
        </button>
        <button type="button" onClick={onReset} className="flex items-center gap-1.5 transition-colors hover:text-white">
          <RotateCcw className="h-3.5 w-3.5" /> Not you? Start fresh
        </button>
      </div>
    </>
  );
}

/** The detected computer: name (renamable), model and a spec list that fills in as it's read. */
function SystemCard({
  info,
  name,
  editing,
  onEdit,
  onName,
  onDone,
}: {
  info: SystemInfo | null;
  name: string;
  editing: boolean;
  onEdit: () => void;
  onName: (name: string) => void;
  onDone: () => void;
}) {
  const DeviceIcon = info?.device_type === 'Desktop' ? Monitor : Laptop;
  const specs = info ? deviceSpecs(info) : [];

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-brand-gray/40">
      <div className="flex items-center gap-4 border-b border-white/10 p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-cyan text-black">
          {info ? <DeviceIcon className="h-7 w-7" /> : <Loader2 className="h-6 w-6 animate-spin" />}
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => onName(e.target.value)}
              onBlur={onDone}
              onKeyDown={(e) => e.key === 'Enter' && onDone()}
              aria-label="Profile name"
              className="h-10 w-full rounded-lg bg-black/40 px-3 text-xl font-medium outline-none ring-2 ring-brand-cyan/40"
            />
          ) : (
            <p className="truncate text-2xl font-medium tracking-tight">{info ? name : 'Looking around…'}</p>
          )}
          <p className="truncate text-sm text-white/50">
            {info ? [info.device_type, info.model].filter(Boolean).join(' · ') : 'Reading hardware details'}
          </p>
        </div>
        {info && !editing && (
          <button
            type="button"
            onClick={onEdit}
            title="Rename profile"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <PencilLine className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="divide-y divide-white/5">
        {specs.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="flex items-center gap-3 px-5 py-2.5"
          >
            <s.icon className="h-4 w-4 shrink-0 text-white/40" />
            <span className="w-20 shrink-0 text-sm text-white/40">{s.label}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium" title={s.value}>
              {s.value}
            </span>
          </motion.div>
        ))}
        {info?.tier && (
          <div className="flex items-center justify-between px-5 py-2.5">
            <span className="text-sm text-white/40">RishFlow will run in</span>
            <span className="rounded-full bg-brand-cyan/15 px-3 py-1 text-xs font-semibold text-brand-cyan">{info.tier} mode</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Human-readable spec rows for a detected computer; empty fields are left out. */
export function deviceSpecs(info: SystemInfo) {
  return [
    { icon: Cpu, label: 'Processor', value: [info.cpu, info.cores ? `${info.cores} threads` : ''].filter(Boolean).join(' · ') },
    { icon: MemoryStick, label: 'Memory', value: info.ram_gb ? `${info.ram_gb} GB RAM` : '' },
    { icon: MonitorCog, label: 'Graphics', value: info.gpu },
    { icon: HardDrive, label: 'Storage', value: info.disk_total_gb ? `${info.disk_free_gb} GB free of ${info.disk_total_gb} GB` : '' },
    { icon: Laptop, label: 'System', value: [info.os, info.arch].filter(Boolean).join(' · ') },
  ].filter((s) => s.value);
}

function Row({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="flex items-center justify-between gap-6 bg-brand-gray/60 px-4 py-3">
      <span className="text-sm text-white/40">{label}</span>
      <span className="truncate text-sm font-medium" title={title}>
        {value}
      </span>
    </div>
  );
}

/* ───────────────────────── Reusable components ───────────────────────── */

export function StepItem({ number, text, active = false, done = false }: { number: number; text: string; active?: boolean; done?: boolean }) {
  return (
    <div
      className={`flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-all duration-500 ${
        active ? 'border border-white bg-white text-black' : 'border-none bg-brand-gray/85 text-white backdrop-blur-md'
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-500 ${
          active ? 'bg-black text-white' : done ? 'bg-brand-cyan text-black' : 'bg-white/10 text-white/40'
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : number}
      </span>
      <span className={`text-sm font-medium ${!active && !done ? 'text-white/70' : ''}`}>{text}</span>
    </div>
  );
}

export function SocialButton({
  icon,
  label,
  ...props
}: { icon: React.ReactNode; label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="flex h-12 items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-black text-sm font-medium text-white transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-black"
      {...props}
    >
      {icon}
      {label}
    </button>
  );
}

export function InputGroup({
  label,
  placeholder,
  type,
  value,
  onChange,
  error,
  hint,
  autoFocus,
}: {
  label: string;
  placeholder: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-white">
        {label}
      </label>
      <motion.input
        id={id}
        aria-invalid={!!error}
        type={type}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        animate={error ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className={`h-11 w-full rounded-xl border-none bg-brand-gray px-4 text-white outline-none transition-shadow placeholder:text-white/20 focus:ring-2 ${
          error ? 'ring-2 ring-red-400/60' : 'focus:ring-brand-cyan/40'
        }`}
      />
      {error ? <p className="text-[11px] text-red-300">{error}</p> : hint && <p className="text-[11px] text-white/30">{hint}</p>}
    </div>
  );
}
