import React, { useMemo, useState } from 'react';
import { motion, type Variants } from 'motion/react';
import {
  ArrowRight,
  Files,
  FolderTree,
  CalendarCheck,
  Clock,
  Sparkles,
  CopyX,
  Activity,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { pythonAPI } from '@/api/pywebview';
import { useData } from '../contexts/DataContext';
import { useProfile } from '../contexts/ProfileContext';
import { useCountUp } from '../hooks/useCountUp';
import { getColorForFile, getIconForFile, greeting, relativeTime, baseName } from '../lib/files';
import { Card } from './Card';
import { Badge } from './Badge';
import { ShinyText } from './fx/ShinyText';
import { VideoBackdrop } from './fx/VideoBackdrop';

const HERO_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_105406_16f4600d-7a92-4292-b96e-b19156c7830a.mp4';

interface DashboardProps {
  onNavigate: (view: string) => void;
}

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};
const rise: Variants = {
  hidden: { opacity: 0, y: 18, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

export function Dashboard({ onNavigate }: DashboardProps) {
  const { activities, categories, stats, selectedSourceFolder, selectedDestFolder } = useData();
  const { profile, displayName } = useProfile();
  const [scanning, setScanning] = useState(false);

  const moved = useMemo(
    () => activities.filter((a) => a.status !== 'error' && !/^(Failed|Reverted)/.test(a.category)),
    [activities],
  );
  const sortedCount = useCountUp(moved.length);

  // Moves per day for the last 7 days
  const week = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return { key: d.toLocaleDateString(), label: d.toLocaleDateString([], { weekday: 'short' }), count: 0 };
    });
    moved.forEach((a) => {
      const day = days.find((d) => d.key === a.date);
      if (day) day.count += 1;
    });
    return days;
  }, [moved]);
  const weekMax = Math.max(1, ...week.map((d) => d.count));
  const weekTotal = week.reduce((s, d) => s + d.count, 0);

  const recent = moved.slice(0, 6);

  const findDuplicates = async () => {
    const folder = selectedSourceFolder || selectedDestFolder;
    if (!folder) {
      toast.info('Pick a folder first', { description: 'Choose a source folder, then scan it for duplicates.' });
      onNavigate('organize');
      return;
    }
    if (!pythonAPI.available) {
      toast.info('Duplicate scanning runs in the RishFlow desktop app.');
      return;
    }
    try {
      setScanning(true);
      const res = await pythonAPI.findDuplicates(folder);
      if (res?.error) throw new Error(res.error);
      const n = Number(res?.duplicates ?? 0);
      if (n > 0) toast.warning(`${n} duplicate ${n === 1 ? 'file' : 'files'} found`, { description: `In ${baseName(folder)}` });
      else toast.success('No duplicates found', { description: `${baseName(folder)} is crystal clear.` });
    } catch (err) {
      toast.error('Duplicate scan failed', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─────────── Hero ─────────── */}
      <section className="relative h-[min(640px,calc(100vh-110px))] min-h-[500px] overflow-hidden rounded-[28px] bg-black text-white shadow-2xl">
        <VideoBackdrop src={HERO_VIDEO} autoPlay loop muted playsInline />
        {/* soft fade into the page so the card feels submerged, not pasted on */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />

        <motion.div
          className="relative z-10 flex h-full flex-col p-6 sm:p-8 lg:p-10"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {/* Top row */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <motion.p variants={rise} className="max-w-md text-sm text-white/80 md:text-base">
              RishFlow reads, sorts and files everything in your folders — locally, privately, in seconds.
            </motion.p>
            <motion.p variants={rise} className="text-sm text-white/80 md:text-base lg:text-right">
              {moved.length > 0 ? (
                <>
                  <span className="font-semibold text-white tabular-nums">{sortedCount.toLocaleString()}+</span> files already flowing!
                </>
              ) : (
                'Your first sort is one click away.'
              )}
            </motion.p>
          </div>

          {/* Heading */}
          <div className="mt-auto">
            <motion.p variants={rise} className="mb-4 text-xs font-medium uppercase tracking-tight text-white/80 md:text-sm">
              {greeting()}, {displayName} · Your AI current is ready
            </motion.p>
            <motion.h1
              variants={rise}
              className="text-5xl leading-[0.85] tracking-tighter sm:text-6xl lg:text-7xl xl:text-8xl 2xl:text-9xl"
            >
              <span className="block font-medium text-white">Let your files</span>
              <ShinyText text="find their flow." color="#64CEFB" shineColor="#ffffff" speed={3} spread={100} className="pb-2 font-medium" />
            </motion.h1>

            <motion.div variants={rise} className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => onNavigate('organize')}
                className="group inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-medium text-white ring-1 ring-white/15 transition-all hover:bg-gray-900 hover:ring-white/30 md:px-8 md:py-4 md:text-base"
              >
                Start Organizing
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => onNavigate('activity')}
                className="rounded-full px-5 py-3 text-sm font-medium text-white/80 transition-colors hover:text-white md:py-4 md:text-base"
              >
                View activity
              </button>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ─────────── Stats ─────────── */}
      <motion.div className="grid grid-cols-2 gap-4 xl:grid-cols-4" variants={stagger} initial="hidden" animate="show">
        <StatTile icon={Files} label="Files sorted" value={moved.length} hint={moved.length ? 'All time' : 'Ready to organize'} />
        <StatTile icon={FolderTree} label="Categories" value={categories.length} hint={profile?.focusTypes?.length ? 'Including your picks' : 'Auto-created as you sort'} />
        <StatTile icon={CalendarCheck} label="Sorted today" value={stats.sortedToday} hint={new Date().toLocaleDateString([], { weekday: 'long' })} />
        <StatTile
          icon={Clock}
          label="Last activity"
          text={stats.lastActivity ? relativeTime(new Date(stats.lastActivity)) : '—'}
          hint={stats.lastActivity ? new Date(stats.lastActivity).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Nothing yet'}
        />
      </motion.div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* ─────────── Recent ─────────── */}
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between p-6 pb-2">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Recently sorted</h3>
              <p className="text-xs text-muted-foreground">The latest files RishFlow moved for you</p>
            </div>
            {recent.length > 0 && (
              <button
                onClick={() => onNavigate('activity')}
                className="group flex items-center gap-1 text-sm font-medium text-primary"
              >
                View all <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
          <div className="p-3">
            {recent.length > 0 ? (
              <ul>
                {recent.map((file, i) => {
                  const Icon = getIconForFile(file.fileName);
                  const color = getColorForFile(file.fileName);
                  return (
                    <motion.li
                      key={file.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + i * 0.05 }}
                      className="flex items-center gap-4 rounded-xl p-3 transition-colors hover:bg-accent/40"
                    >
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${color}1f`, color }}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" title={file.fileName}>
                          {file.fileName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{file.date} · {file.timestamp}</p>
                      </div>
                      <Badge variant="info" className="max-w-[40%]">{file.category || 'Uncategorized'}</Badge>
                    </motion.li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState onStart={() => onNavigate('organize')} />
            )}
          </div>
        </Card>

        <div className="space-y-6">
          {/* ─────────── Week ─────────── */}
          <Card>
            <div className="p-6">
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <h3 className="text-base font-semibold tracking-tight">Flow this week</h3>
                  <p className="text-xs text-muted-foreground">Files moved per day</p>
                </div>
                <p className="text-2xl font-semibold tabular-nums tracking-tight">{weekTotal}</p>
              </div>
              <div className="flex h-28 gap-2">
                {week.map((d, i) => (
                  <div key={d.key} className="flex flex-1 flex-col items-center gap-2">
                    <div className="relative flex w-full flex-1 items-end overflow-hidden rounded-lg bg-secondary/60">
                      <motion.div
                        className="w-full rounded-lg"
                        style={{
                          background: 'linear-gradient(to top, color-mix(in srgb, var(--primary) 35%, transparent), var(--primary))',
                          boxShadow: d.count ? '0 0 16px -4px var(--glow)' : undefined,
                        }}
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max((d.count / weekMax) * 100, d.count ? 8 : 3)}%` }}
                        transition={{ duration: 0.8, delay: 0.2 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                        title={`${d.count} on ${d.key}`}
                      />
                    </div>
                    <span className={`text-[10px] ${i === 6 ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* ─────────── Quick actions ─────────── */}
          <Card>
            <div className="p-6 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-base font-semibold tracking-tight">Quick actions</h3>
              </div>
            </div>
            <div className="space-y-1 p-3 pt-0">
              <QuickAction icon={FolderOpen} title="Start organizing" desc="Pick a folder and let AI sort it" onClick={() => onNavigate('organize')} />
              <QuickAction
                icon={scanning ? Loader2 : CopyX}
                spin={scanning}
                title="Find duplicates"
                desc={selectedSourceFolder || selectedDestFolder ? `Scan ${baseName((selectedSourceFolder || selectedDestFolder)!)}` : 'Scan a folder for copies'}
                onClick={findDuplicates}
              />
              <QuickAction icon={Activity} title="View activity" desc="Every move, with undo" onClick={() => onNavigate('activity')} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  text,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: number;
  text?: string;
  hint: string;
}) {
  const n = useCountUp(value ?? 0);
  return (
    <motion.div variants={rise}>
      <Card hover className="h-full">
        <div className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" />
          </div>
          <p className="text-3xl font-semibold tabular-nums tracking-tight">{text ?? n.toLocaleString()}</p>
          <p className="mt-1 text-sm font-medium text-foreground/90">{label}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
        </div>
      </Card>
    </motion.div>
  );
}

function QuickAction({
  icon: Icon,
  title,
  desc,
  onClick,
  spin,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  onClick: () => void;
  spin?: boolean;
}) {
  return (
    <button onClick={onClick} className="group flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-accent/50">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-primary">
        <Icon className={`h-4 w-4 ${spin ? 'animate-spin' : ''}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{desc}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
        <span className="animate-ripple absolute inset-0 rounded-full border border-primary/40" />
        <span className="animate-ripple absolute inset-0 rounded-full border border-primary/30" style={{ animationDelay: '0.9s' }} />
        <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Files className="h-6 w-6" />
        </span>
      </div>
      <p className="text-sm font-medium">No files sorted yet</p>
      <p className="mt-1 text-xs text-muted-foreground">Choose a folder and RishFlow will take it from there.</p>
      <button
        onClick={onStart}
        className="group mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_8px_30px_-10px_var(--glow)]"
      >
        Start organizing <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </button>
    </div>
  );
}
