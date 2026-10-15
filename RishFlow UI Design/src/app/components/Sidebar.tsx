import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { FolderPlus, Settings as SettingsIcon } from 'lucide-react';
import { pythonAPI } from '@/api/pywebview';
import { useData } from '../contexts/DataContext';
import { useProfile } from '../contexts/ProfileContext';
import { NAV } from '../lib/nav';
import { baseName, statFiles, statSize, type FolderStats } from '../lib/files';
import { LogoMark } from './fx/LogoMark';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  document: '#38bdf8',
  image: '#f472b6',
  video: '#2dd4bf',
  archive: '#fb923c',
  other: '#7f98a8',
};

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const { selectedDestFolder, activities, categories } = useData();
  const { profile, displayName, initials } = useProfile();
  const [destStats, setDestStats] = useState<FolderStats | null>(null);

  useEffect(() => {
    if (!selectedDestFolder || !pythonAPI.available) {
      setDestStats(null);
      return;
    }
    pythonAPI
      .getFolderStats(selectedDestFolder)
      .then((s) => setDestStats(s && !s.error ? s : null))
      .catch(() => setDestStats(null));
  }, [selectedDestFolder, activities.length]);

  const counts: Partial<Record<string, number>> = {
    categories: categories.length,
    activity: activities.length,
  };

  const byType = Object.entries(destStats?.count_by_type ?? {});
  const total = byType.reduce((s, [, n]) => s + n, 0);

  return (
    <aside className="glass edge-light flex h-full w-[248px] flex-col rounded-3xl">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LogoMark size={24} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-tight tracking-tight">RishFlow</p>
          <p className="truncate text-xs text-muted-foreground">{profile?.workspace || 'AI File Organizer'}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Navigate</p>
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = currentView === item.id;
          const count = counts[item.id];
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl border border-primary/25 bg-primary/10"
                  style={{ boxShadow: '0 8px 30px -14px var(--glow)' }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                >
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />
                </motion.span>
              )}
              <span className="absolute inset-0 rounded-xl bg-accent/0 transition-colors group-hover:bg-accent/40" />
              <Icon className={`relative h-[18px] w-[18px] transition-colors ${active ? 'text-primary' : ''}`} />
              <span className="relative flex-1 text-left">{item.label}</span>
              {!!count && (
                <span className="relative rounded-full bg-secondary px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                  {count > 999 ? '999+' : count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Destination reservoir */}
      <div className="px-3 pb-3">
        <div className="rounded-2xl border border-border bg-secondary/50 p-4">
          {selectedDestFolder ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Destination</p>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
              </div>
              <p className="truncate text-sm font-medium" title={selectedDestFolder}>
                {baseName(selectedDestFolder)}
              </p>
              <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-background/60">
                {total > 0 ? (
                  byType.map(([type, n]) => (
                    <motion.span
                      key={type}
                      initial={{ width: 0 }}
                      animate={{ width: `${(n / total) * 100}%` }}
                      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                      style={{ background: TYPE_COLORS[type] ?? TYPE_COLORS.other }}
                      title={`${type}: ${n}`}
                    />
                  ))
                ) : (
                  <span className="w-full bg-primary/20" />
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {statFiles(destStats)} files · {statSize(destStats)}
              </p>
            </>
          ) : (
            <button onClick={() => onNavigate('organize')} className="flex w-full items-center gap-3 text-left">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <FolderPlus className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-medium">Set a destination</span>
                <span className="block text-xs text-muted-foreground">Where organized files land</span>
              </span>
            </button>
          )}
        </div>

        {/* Profile */}
        <button
          onClick={() => onNavigate('settings')}
          className="mt-2 flex w-full items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-accent/50"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/40 text-xs font-semibold text-primary-foreground">
            {initials}
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-medium">{displayName}</span>
            <span className="block text-[11px] text-muted-foreground">Local · Private</span>
          </span>
          <SettingsIcon className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </aside>
  );
}
