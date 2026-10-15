import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Bell, Lock, Database, Zap, Palette, UserRound, Play, LogOut, Check, Trash2, Laptop, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { pythonAPI } from '../../api/pywebview';
import { useData } from '../contexts/DataContext';
import { useTheme, THEMES } from '../contexts/ThemeContext';
import { useProfile, detectSystem } from '../contexts/ProfileContext';
import { deviceSpecs } from './Onboarding';
import { useAppActions } from '../contexts/AppActionsContext';
import { baseName, statFiles, statSize, type FolderStats } from '../lib/files';
import { Card } from './Card';
import { Switch } from './Switch';
import { Button } from './Button';
import { Input } from './Input';
import { ProgressBar } from './ProgressBar';
import { useConfirm } from './Modal';
import { PageHeader } from './PageHeader';

interface SettingsProps {
  onNavigate?: (view: string) => void;
}

const STORAGE_CAP_BYTES = 10 * 1024 ** 3; // 10 GB reference for the gauge

export function Settings({ onNavigate }: SettingsProps) {
  const { selectedDestFolder, refreshData } = useData();
  const { theme, setTheme } = useTheme();
  const { profile, saveProfile } = useProfile();
  const { replayIntro, leaveToWelcome } = useAppActions();
  const confirm = useConfirm();

  // Notification settings
  const [notifyComplete, setNotifyComplete] = useState(true);
  const [notifyAI, setNotifyAI] = useState(true);
  const [notifyWeekly, setNotifyWeekly] = useState(false);
  const [notifyCategory, setNotifyCategory] = useState(true);

  // Privacy settings
  const [twoFactor, setTwoFactor] = useState(true);
  const [shareUsage, setShareUsage] = useState(false);
  const [encryptMeta, setEncryptMeta] = useState(true);

  // AI settings
  const [autoOrganize, setAutoOrganize] = useState(true);
  const [smartTags, setSmartTags] = useState(true);
  const [aggressive, setAggressive] = useState(false);
  const [confidence, setConfidence] = useState(80);

  // Storage
  const [destStats, setDestStats] = useState<FolderStats | null>(null);

  // Profile
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [workspace, setWorkspace] = useState(profile?.workspace ?? '');

  // Don't write defaults over saved settings before they've been read
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        if (pythonAPI.available) {
          const settings = await pythonAPI.loadState('app_settings');
          const s = settings?.value;
          if (s) {
            setNotifyComplete(s.notifyComplete ?? true);
            setNotifyAI(s.notifyAI ?? true);
            setNotifyWeekly(s.notifyWeekly ?? false);
            setNotifyCategory(s.notifyCategory ?? true);
            setTwoFactor(s.twoFactor ?? true);
            setShareUsage(s.shareUsage ?? false);
            setEncryptMeta(s.encryptMeta ?? true);
            setAutoOrganize(s.autoOrganize ?? true);
            setSmartTags(s.smartTags ?? true);
            setAggressive(s.aggressive ?? false);
            setConfidence(s.confidence ?? 80);
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        // Let the state updates above flush before enabling auto-save
        setTimeout(() => {
          loaded.current = true;
        }, 0);
      }
    })();
  }, []);

  const loadStorageStats = () => {
    if (!selectedDestFolder || !pythonAPI.available) {
      setDestStats(null);
      return;
    }
    pythonAPI
      .getFolderStats(selectedDestFolder)
      .then((s) => setDestStats(s && !s.error ? s : null))
      .catch(() => setDestStats(null));
  };

  useEffect(loadStorageStats, [selectedDestFolder]);

  // Auto-save when settings change
  useEffect(() => {
    if (!loaded.current || !pythonAPI.available) return;
    pythonAPI
      .saveState('app_settings', {
        notifyComplete,
        notifyAI,
        notifyWeekly,
        notifyCategory,
        twoFactor,
        shareUsage,
        encryptMeta,
        autoOrganize,
        smartTags,
        aggressive,
        confidence,
      })
      .catch(() => {});
  }, [notifyComplete, notifyAI, notifyWeekly, notifyCategory, twoFactor, shareUsage, encryptMeta, autoOrganize, smartTags, aggressive, confidence]);

  const handleClearLogs = async () => {
    const ok = await confirm({
      title: 'Clear all activity logs?',
      description: 'Your organized files stay where they are — only the history is erased.',
      confirmLabel: 'Clear logs',
      destructive: true,
    });
    if (!ok) return;
    if (!pythonAPI.available) {
      toast.info('This runs in the RishFlow desktop app.');
      return;
    }
    try {
      const result = await pythonAPI.clearActivityLogs();
      if (result?.status === 'cleared') {
        toast.success(`Cleared ${result.count} log entries`);
        loadStorageStats();
        refreshData();
      } else if (result?.error) {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error('Failed to clear activity logs', { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const profileDirty =
    firstName.trim() !== (profile?.firstName ?? '') ||
    lastName.trim() !== (profile?.lastName ?? '') ||
    workspace.trim() !== (profile?.workspace ?? '');

  const saveProfileChanges = () => {
    saveProfile({
      ...profile,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      workspace: workspace.trim() || 'My Workspace',
      focusTypes: profile?.focusTypes ?? [],
      createdAt: profile?.createdAt ?? new Date().toISOString(),
    });
    toast.success('Profile updated');
  };

  const [detecting, setDetecting] = useState(false);
  const redetect = async () => {
    setDetecting(true);
    const device = await detectSystem();
    if (profile) saveProfile({ ...profile, device });
    setDetecting(false);
    toast.success('Device details updated');
  };

  const storagePct =destStats?.total_size ? Math.min((destStats.total_size / STORAGE_CAP_BYTES) * 100, 100) : 0;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Preferences" title="Settings" subtitle="Tune how RishFlow looks, behaves and remembers. Changes save automatically." />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Profile */}
        <Section icon={UserRound} title="Profile" delay={0}>
          <div className="space-y-4 px-3 pb-2">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
              <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
            </div>
            <Input label="Workspace name" value={workspace} onChange={(e) => setWorkspace(e.target.value)} placeholder="My Workspace" />
            <div className="flex justify-end">
              <Button size="sm" onClick={saveProfileChanges} disabled={!profileDirty}>
                <Check className="h-4 w-4" /> Save profile
              </Button>
            </div>
          </div>
        </Section>

        {/* This device */}
        <Section icon={Laptop} title="This device" delay={0.03}>
          <div className="px-3 pb-2">
            {profile?.device ? (
              <>
                <p className="text-sm font-medium">
                  {[profile.device.name, profile.device.device_type, profile.device.model].filter(Boolean).join(' · ')}
                </p>
                <dl className="mt-3 space-y-2">
                  {deviceSpecs(profile.device).map((s) => (
                    <div key={s.label} className="flex items-center gap-3 text-sm">
                      <s.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <dt className="w-20 shrink-0 text-muted-foreground">{s.label}</dt>
                      <dd className="min-w-0 flex-1 truncate" title={s.value}>
                        {s.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No device details yet.</p>
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              {profile?.device?.tier ? (
                <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">{profile.device.tier} mode</span>
              ) : (
                <span />
              )}
              <Button size="sm" variant="secondary" onClick={redetect} disabled={detecting}>
                <RefreshCw className={`h-4 w-4 ${detecting ? 'animate-spin' : ''}`} /> Re-detect
              </Button>
            </div>
          </div>
        </Section>

        {/* Appearance */}
        <Section icon={Palette} title="Appearance" delay={0.05}>
          <div className="grid grid-cols-3 gap-3 px-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`rounded-2xl border p-2 text-left transition-all ${
                  theme === t.id ? 'border-primary shadow-[0_10px_30px_-14px_var(--glow)]' : 'border-border hover:border-border-strong'
                }`}
              >
                <div className="flex h-16 gap-1 overflow-hidden rounded-xl p-1.5" style={{ background: t.swatch[0] }}>
                  <div className="w-1/4 rounded-md" style={{ background: t.swatch[1] }} />
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="h-2 w-2/3 rounded-full" style={{ background: t.swatch[2] }} />
                    <div className="h-1.5 w-1/2 rounded-full opacity-40" style={{ background: t.swatch[2] }} />
                    <div className="mt-auto h-5 rounded-md" style={{ background: t.swatch[1] }} />
                  </div>
                </div>
                <p className="mt-2 px-1 text-sm font-medium">{t.name}</p>
                <p className="truncate px-1 text-[11px] text-muted-foreground">{t.description}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 px-3 pb-2">
            <Button variant="secondary" size="sm" onClick={replayIntro}>
              <Play className="h-3.5 w-3.5" /> Replay intro
            </Button>
            <Button variant="ghost" size="sm" onClick={leaveToWelcome}>
              <LogOut className="h-3.5 w-3.5" /> Back to welcome screen
            </Button>
          </div>
        </Section>

        {/* AI */}
        <Section icon={Zap} title="AI Behavior" delay={0.1}>
          <Switch checked={autoOrganize} onChange={setAutoOrganize} label="Auto-organize on upload" description="Sort new files as soon as they appear" />
          <Switch checked={smartTags} onChange={setSmartTags} label="Generate smart tags" description="Keywords and colours from file content" />
          <Switch checked={aggressive} onChange={setAggressive} label="Aggressive categorization" description="Prefer a category over 'Uncategorized'" />
          <div className="px-3 pb-2 pt-3">
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium">Minimum confidence</label>
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-primary">{confidence}%</span>
            </div>
            <div className="relative h-6">
              <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-secondary" />
              <div
                className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_12px_var(--glow)]"
                style={{ width: `${((confidence - 50) / 50) * 100}%` }}
              />
              <input
                type="range"
                min="50"
                max="100"
                value={confidence}
                onChange={(e) => setConfidence(parseInt(e.target.value))}
                className="absolute inset-0 w-full cursor-pointer opacity-0"
                aria-label="Minimum confidence threshold"
              />
              <div
                className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow-lg"
                style={{ left: `${((confidence - 50) / 50) * 100}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </Section>

        {/* Storage */}
        <Section icon={Database} title="Storage" delay={0.15}>
          <div className="px-3 pb-2">
            {selectedDestFolder ? (
              <>
                <p className="text-xs text-muted-foreground">Organized files in</p>
                <p className="truncate text-sm font-medium" title={selectedDestFolder}>
                  {baseName(selectedDestFolder)}
                </p>
                <div className="mb-3 mt-4 flex items-baseline justify-between">
                  <span className="text-3xl font-semibold tracking-tight">{statSize(destStats)}</span>
                  <span className="text-xs text-muted-foreground">{statFiles(destStats)} files</span>
                </div>
                <ProgressBar value={storagePct} size="md" />
                <p className="mt-2 text-[11px] text-muted-foreground">Gauge relative to 10 GB</p>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-5 text-center">
                <p className="text-sm text-muted-foreground">No destination folder yet.</p>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => onNavigate?.('organize')}>
                  Choose one
                </Button>
              </div>
            )}
            <Button variant="destructive" className="mt-5 w-full" onClick={handleClearLogs}>
              <Trash2 className="h-4 w-4" /> Clear activity logs
            </Button>
          </div>
        </Section>

        {/* Notifications */}
        <Section icon={Bell} title="Notifications" delay={0.2}>
          <Switch checked={notifyComplete} onChange={setNotifyComplete} label="Organization complete" />
          <Switch checked={notifyAI} onChange={setNotifyAI} label="New AI suggestions" />
          <Switch checked={notifyWeekly} onChange={setNotifyWeekly} label="Weekly activity summary" />
          <Switch checked={notifyCategory} onChange={setNotifyCategory} label="Category updates" />
        </Section>

        {/* Privacy */}
        <Section icon={Lock} title="Privacy & Security" delay={0.25}>
          <Switch checked={twoFactor} onChange={setTwoFactor} label="Two-factor authentication" />
          <Switch checked={shareUsage} onChange={setShareUsage} label="Share usage data" description="Off by default — RishFlow works fully offline" />
          <Switch checked={encryptMeta} onChange={setEncryptMeta} label="Encrypt file metadata" />
        </Section>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  delay,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 + delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="h-full">
        <div className="flex items-center gap-3 p-6 pb-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        </div>
        <div className="space-y-0.5 p-3 pt-1">{children}</div>
      </Card>
    </motion.div>
  );
}
