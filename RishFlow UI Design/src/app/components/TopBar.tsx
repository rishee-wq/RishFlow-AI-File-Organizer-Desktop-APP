import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, CornerDownLeft, RefreshCw, Search } from 'lucide-react';
import { useTheme, THEMES } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useProfile } from '../contexts/ProfileContext';
import { NAV, type View } from '../lib/nav';
import { getIconForFile } from '../lib/files';
import { LogoMark } from './fx/LogoMark';
import type { FileItem } from './FileGrid';

interface TopBarProps {
  currentView: View;
  onNavigate: (view: string) => void;
  onPreviewFile: (file: FileItem) => void;
  isMobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

export function TopBar({ currentView, onNavigate, onPreviewFile, isMobileMenuOpen, onToggleMobileMenu }: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const { files, categories, loading, refreshData } = useData();
  const { initials } = useProfile();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = NAV.find((n) => n.id === currentView);

  // Ctrl/⌘ + K focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const views = NAV.filter((n) => !q || n.label.toLowerCase().includes(q) || n.blurb.toLowerCase().includes(q)).map(
      (n) => ({ kind: 'view' as const, id: n.id, label: n.label, sub: n.blurb, icon: n.icon }),
    );
    const cats = q
      ? categories
          .filter((c) => c.name.toLowerCase().includes(q))
          .slice(0, 3)
          .map((c) => ({ kind: 'category' as const, id: c.id, label: c.name, sub: `${c.fileCount} files`, emoji: c.icon }))
      : [];
    const fileHits = q
      ? files
          .filter((f) => f.name.toLowerCase().includes(q))
          .slice(0, 6)
          .map((f) => ({ kind: 'file' as const, id: f.id, label: f.name, sub: f.category, file: f }))
      : [];
    return [...fileHits, ...cats, ...views].slice(0, 10);
  }, [query, files, categories]);

  useEffect(() => setCursor(0), [query]);

  const choose = (i: number) => {
    const r = results[i];
    if (!r) return;
    if (r.kind === 'view') onNavigate(r.id);
    if (r.kind === 'category') onNavigate('categories');
    if (r.kind === 'file') onPreviewFile({ ...r.file, icon: getIconForFile(r.file.name) });
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <>
      <header className="relative z-30 flex h-[76px] shrink-0 items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Hamburger (mobile) */}
        <button
          onClick={onToggleMobileMenu}
          className="relative z-[11] flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-xl lg:hidden"
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          <span className={`h-[2px] w-6 rounded bg-foreground transition-all duration-300 ${isMobileMenuOpen ? 'translate-y-[7px] rotate-45' : ''}`} />
          <span className={`h-[2px] w-6 rounded bg-foreground transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
          <span className={`h-[2px] w-6 rounded bg-foreground transition-all duration-300 ${isMobileMenuOpen ? '-translate-y-[7px] -rotate-45' : ''}`} />
        </button>

        {/* Breadcrumb */}
        <div className="hidden min-w-0 md:block">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Workspace</p>
          <AnimatePresence mode="wait">
            <motion.p
              key={currentView}
              className="truncate text-base font-semibold tracking-tight"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {current?.label}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Search pill */}
        <div className="relative mx-auto w-full max-w-md flex-1">
          <div
            className={`glass flex h-11 items-center gap-2 rounded-full pl-4 pr-2 transition-all ${
              open ? 'border-border-strong shadow-[0_10px_40px_-18px_var(--glow)]' : ''
            }`}
          >
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setCursor((c) => Math.min(c + 1, results.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setCursor((c) => Math.max(c - 1, 0));
                } else if (e.key === 'Enter') {
                  choose(cursor);
                } else if (e.key === 'Escape') {
                  setOpen(false);
                  inputRef.current?.blur();
                }
              }}
              placeholder="Search files, categories, pages…"
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
            />
            <kbd className="hidden rounded-md border border-border bg-secondary px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground sm:block">
              Ctrl K
            </kbd>
          </div>

          <AnimatePresence>
            {open && results.length > 0 && (
              <motion.div
                className="glass-strong edge-light absolute left-0 right-0 top-[52px] overflow-hidden rounded-2xl p-1.5"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.18 }}
              >
                {results.map((r, i) => {
                  const Icon = r.kind === 'view' ? r.icon : r.kind === 'file' ? getIconForFile(r.label) : null;
                  return (
                    <button
                      key={`${r.kind}-${r.id}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => choose(i)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        cursor === i ? 'bg-primary/10' : ''
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                        {Icon ? <Icon className="h-4 w-4" /> : <span className="text-sm">{r.kind === 'category' ? r.emoji : ''}</span>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{r.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.kind === 'file' ? `File · ${r.sub}` : r.kind === 'category' ? `Category · ${r.sub}` : r.sub}
                        </span>
                      </span>
                      {cursor === i &&
                        (r.kind === 'view' ? (
                          <ArrowUpRight className="h-4 w-4 text-primary" />
                        ) : (
                          <CornerDownLeft className="h-4 w-4 text-primary" />
                        ))}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          <div className="glass hidden items-center gap-1 rounded-full p-1 md:flex">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                title={t.name}
                className="relative flex h-8 w-8 items-center justify-center rounded-full"
              >
                {theme === t.id && (
                  <motion.span
                    layoutId="theme-active"
                    className="absolute inset-0 rounded-full bg-primary/15 ring-1 ring-primary/40"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                )}
                <span
                  className="relative h-4 w-4 rounded-full ring-1 ring-white/20"
                  style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 35%, ${t.swatch[2]})` }}
                />
              </button>
            ))}
          </div>

          <button
            onClick={() => refreshData()}
            className="glass hidden h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground sm:flex"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => onNavigate('settings')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/40 text-xs font-semibold text-primary-foreground shadow-[0_6px_24px_-8px_var(--glow)] transition-transform hover:scale-105"
            title="Profile & settings"
          >
            {initials}
          </button>
        </div>
      </header>

      {/* Mobile navigation overlay */}
      <div
        className={`fixed inset-0 z-[9] bg-background/95 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isMobileMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex h-full flex-col px-8 pb-10 pt-24">
          <div className="mb-8 flex items-center gap-2.5 text-primary">
            <LogoMark size={24} />
            <span className="text-lg font-semibold tracking-tight text-foreground">RishFlow</span>
          </div>
          <nav className="space-y-1">
            {NAV.map((item, i) => (
              <motion.button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                initial={false}
                animate={isMobileMenuOpen ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
                transition={{ delay: isMobileMenuOpen ? 0.05 + i * 0.04 : 0, duration: 0.3 }}
                className={`block w-full py-2 text-left text-3xl font-medium tracking-tight transition-opacity hover:opacity-60 ${
                  currentView === item.id ? 'text-primary' : 'text-foreground'
                }`}
              >
                {item.label}
              </motion.button>
            ))}
          </nav>
          <div className="mt-auto flex gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex-1 rounded-2xl border px-3 py-3 text-sm font-medium ${
                  theme === t.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
