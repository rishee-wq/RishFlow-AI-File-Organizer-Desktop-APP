import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView } from 'motion/react';
import {
  ArrowRight,
  ArrowUpDown,
  Check,
  CheckCircle2,
  AlertCircle,
  FolderInput,
  FolderOpen,
  LayoutGrid,
  List,
  Loader2,
  Waves,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { pythonAPI } from '@/api/pywebview';
import { useData } from '@/app/contexts/DataContext';
import { useTypewriter } from '../hooks/useTypewriter';
import { useVideoScrub } from '../hooks/useVideoScrub';
import {
  SORT_MODES,
  baseName,
  formatFileSize,
  getColorForFile,
  getIconForFile,
  getTypeForFile,
  statFiles,
  statSize,
  type FolderStats,
  type SortModeId,
} from '../lib/files';
import { Card } from './Card';
import { Badge } from './Badge';
import { Button } from './Button';
import { FileGrid, FileItem } from './FileGrid';
import { VideoBackdrop } from './fx/VideoBackdrop';

const HERO_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260601_110537_3a579fa0-7bbc-4d94-9d25-0e816c7840f5.mp4';

interface FileOrganizerProps {
  onPreviewFile: (file: FileItem) => void;
}

type SortKey = 'name' | 'type' | 'size';

export function FileOrganizer({ onPreviewFile }: FileOrganizerProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<FileItem[]>([]);
  const [rawSizes, setRawSizes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<'source' | 'dest' | null>(null);
  const [sourceFolder, setSourceFolder] = useState<string | null>(null);
  const [destFolder, setDestFolder] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortModeId>('AI-based Content');
  const [folderStats, setFolderStats] = useState<{ source: FolderStats | null; dest: FolderStats | null }>({ source: null, dest: null });
  const [organizing, setOrganizing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const { selectedSourceFolder, setSelectedSourceFolder, selectedDestFolder, setSelectedDestFolder, categories, refreshData } = useData();

  const videoRef = useRef<HTMLVideoElement>(null);
  useVideoScrub(videoRef);
  // The floating dock only appears once the inline "Ready" banner scrolls away
  const strategyRef = useRef<HTMLElement>(null);
  const strategyInView = useInView(strategyRef);
  const { displayed, done } = useTypewriter("Drop the chaos.\nWe'll find the flow.", 38, 600);

  // Default strategy chosen during onboarding
  useEffect(() => {
    if (!pythonAPI.available) return;
    pythonAPI
      .loadState('default_sort_mode')
      .then((m) => {
        if (m?.value && SORT_MODES.some((x) => x.id === m.value)) setSortMode(m.value);
      })
      .catch(() => {});
  }, []);

  const scanSource = async (folder: string) => {
    const [stats, result] = await Promise.all([pythonAPI.getFolderStats(folder), pythonAPI.scanSource(folder)]);
    setFolderStats((prev) => ({ ...prev, source: stats && !stats.error ? stats : null }));
    if (result?.files && Array.isArray(result.files)) {
      const sizes: Record<string, number> = {};
      const scanned: FileItem[] = result.files.map((f: any, idx: number) => {
        const id = `file_${idx}_${Date.now()}`;
        sizes[id] = f.size || 0;
        return {
          id,
          name: f.name,
          type: getTypeForFile(f.name),
          size: formatFileSize(f.size || 0),
          category: 'Uncategorized',
          confidence: 75,
          tags: [getTypeForFile(f.name).toLowerCase()],
          icon: getIconForFile(f.name),
          color: getColorForFile(f.name),
          path: f.path,
        };
      });
      setRawSizes(sizes);
      setFiles(scanned);
      setSelectedFiles(new Set());
    }
  };

  // Sync with global state on mount
  useEffect(() => {
    if (!pythonAPI.available) return;
    if (selectedSourceFolder && !sourceFolder) {
      setSourceFolder(selectedSourceFolder);
      scanSource(selectedSourceFolder).catch(() => {});
    }
    if (selectedDestFolder && !destFolder) {
      setDestFolder(selectedDestFolder);
      pythonAPI
        .getFolderStats(selectedDestFolder)
        .then((stats) => setFolderStats((prev) => ({ ...prev, dest: stats && !stats.error ? stats : null })))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSourceFolder, selectedDestFolder]);

  const ensureApi = () => {
    if (pythonAPI.available) return true;
    toast.info('The folder picker opens in the RishFlow desktop app.');
    return false;
  };

  const handleBrowseSource = async () => {
    if (!ensureApi()) return;
    try {
      setLoading('source');
      const folder = await pythonAPI.browseFolder('Select Folder to Organize');
      setSourceFolder(folder);
      setSelectedSourceFolder(folder);
      await scanSource(folder);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg !== 'No folder selected') toast.error('Could not select folder', { description: msg });
    } finally {
      setLoading(null);
    }
  };

  const handleBrowseDest = async () => {
    if (!ensureApi()) return;
    try {
      setLoading('dest');
      const folder = await pythonAPI.browseFolder('Select Destination Folder');
      setDestFolder(folder);
      setSelectedDestFolder(folder);
      const stats = await pythonAPI.getFolderStats(folder);
      setFolderStats((prev) => ({ ...prev, dest: stats && !stats.error ? stats : null }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg !== 'No folder selected') toast.error('Could not select destination', { description: msg });
    } finally {
      setLoading(null);
    }
  };

  const toggleFileSelection = (fileId: string) => {
    const next = new Set(selectedFiles);
    if (next.has(fileId)) next.delete(fileId);
    else next.add(fileId);
    setSelectedFiles(next);
  };

  const toggleSelectAll = () => {
    setSelectedFiles(selectedFiles.size === files.length ? new Set() : new Set(files.map((f) => f.id)));
  };

  const sortedFiles = useMemo(() => {
    const copy = [...files];
    if (sortKey === 'name') copy.sort((a, b) => a.name.localeCompare(b.name));
    if (sortKey === 'type') copy.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    if (sortKey === 'size') copy.sort((a, b) => (rawSizes[b.id] ?? 0) - (rawSizes[a.id] ?? 0));
    return copy;
  }, [files, sortKey, rawSizes]);

  /** Live "n of total" toast until the run ends; the completion summary comes from DataContext. */
  const trackProgress = (modeLabel: string) => {
    const id = toast.loading(`Organizing by ${modeLabel}…`, { description: 'Preparing files' });
    const timer = window.setInterval(async () => {
      try {
        const s = await pythonAPI.getOrganizeStatus();
        if (s.in_progress) {
          toast.loading(`Organizing by ${modeLabel}…`, {
            id,
            description: s.total ? `${s.done} of ${s.total} files` : 'Preparing files',
          });
          return;
        }
      } catch {
        /* stop polling below */
      }
      window.clearInterval(timer);
      toast.dismiss(id);
    }, 400);
  };

  const handleOrganizeNow = async () => {
    if (!sourceFolder) {
      toast.warning('Choose a source folder first');
      return;
    }
    if (!destFolder) {
      toast.warning('Choose a destination folder first');
      return;
    }
    try {
      setOrganizing(true);
      const result = await pythonAPI.startOrganizing(sourceFolder, destFolder, sortMode, categories);
      if (result?.error) throw new Error(result.error);
      if (result?.status === 'organizing') {
        trackProgress(SORT_MODES.find((m) => m.id === sortMode)?.label ?? sortMode);
        setFiles([]);
        setSourceFolder(null);
        setSelectedFiles(new Set());
        setFolderStats((prev) => ({ ...prev, source: null }));
      }
    } catch (error) {
      toast.error('Could not start organizing', { description: error instanceof Error ? error.message : String(error) });
    } finally {
      setOrganizing(false);
    }
  };

  const mode = SORT_MODES.find((m) => m.id === sortMode)!;
  const ready = !!sourceFolder && !!destFolder && files.length > 0;

  return (
    <div className="space-y-8">
      {/* ─────────── Hero (light, scrubbable) ─────────── */}
      <section className="relative flex flex-col overflow-hidden rounded-[28px] bg-[#f1f0f5] text-neutral-900 shadow-2xl lg:block lg:min-h-[480px]">
        <div className="pointer-events-none relative order-last aspect-video w-full overflow-hidden md:aspect-[21/9] lg:absolute lg:inset-0 lg:aspect-auto lg:h-full">
          <VideoBackdrop
            ref={videoRef}
            src={HERO_VIDEO}
            muted
            playsInline
            preload="auto"
            fallback="linear-gradient(120deg, #f1f0f5 0%, #e7e5f0 50%, #dfe9f2 100%)"
            videoClassName="object-right lg:object-right-bottom"
          />
        </div>

        <div className="relative z-10 order-first flex w-full flex-col px-6 py-10 sm:px-10 lg:max-w-[58%] lg:py-12">
          <p className="mb-6 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
            <Waves className="h-3.5 w-3.5" /> Organize · Move your mouse to stir the water
          </p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="mb-6 w-full select-none whitespace-pre-wrap text-4xl font-normal leading-[1.08] tracking-tight text-black md:text-5xl xl:text-[64px]">
              {displayed}
              {!done && <span className="ml-[2px] inline-block h-[1.1em] w-[2px] animate-blink bg-black align-middle" />}
            </h1>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
            <p className="mb-8 max-w-xl text-base leading-relaxed text-neutral-600 md:text-lg">
              Choose where your files live and where order should land.
              <br className="hidden md:block" /> RishFlow sorts the rest — and every move can be undone.
            </p>
          </motion.div>

          {/* Route: source → destination */}
          <motion.div
            className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <FolderStation
              label="Source"
              icon={FolderOpen}
              path={sourceFolder}
              stats={folderStats.source}
              fallbackCount={files.length}
              loading={loading === 'source'}
              onPick={handleBrowseSource}
              onClear={() => {
                setSourceFolder(null);
                setFiles([]);
                setFolderStats((prev) => ({ ...prev, source: null }));
              }}
            />
            <div className="hidden items-center justify-center sm:flex">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white shadow-lg">
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
            <FolderStation
              label="Destination"
              icon={FolderInput}
              path={destFolder}
              stats={folderStats.dest}
              loading={loading === 'dest'}
              onPick={handleBrowseDest}
              onClear={() => {
                setDestFolder(null);
                setFolderStats((prev) => ({ ...prev, dest: null }));
              }}
            />
          </motion.div>
        </div>
      </section>

      {/* ─────────── Strategy pills ─────────── */}
      <section ref={strategyRef}>
        <h2 className="mb-1 text-2xl font-medium tracking-tight">How should we sort?</h2>
        <p className="mb-6 text-sm text-muted-foreground">Pick one strategy — you can change it before every run.</p>
        <div className="flex flex-wrap gap-2.5">
          {SORT_MODES.map((m) => {
            const active = sortMode === m.id;
            return (
              <motion.button
                key={m.id}
                layout
                onClick={() => setSortMode(m.id)}
                whileTap={{ scale: 0.96 }}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-[0_10px_30px_-12px_var(--glow)]'
                    : 'glass text-foreground hover:border-border-strong hover:bg-accent/50'
                }`}
              >
                <AnimatePresence initial={false}>
                  {active && (
                    <motion.span
                      initial={{ scale: 0, width: 0 }}
                      animate={{ scale: 1, width: 'auto' }}
                      exit={{ scale: 0, width: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className="flex"
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </motion.span>
                  )}
                </AnimatePresence>
                {m.label}
              </motion.button>
            );
          })}
        </div>

        <div className="mt-5">
          <AnimatePresence mode="wait">
            {!ready ? (
              <motion.p
                key="hint"
                className="text-xs italic"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
              >
                {!sourceFolder
                  ? 'Choose a source folder above to begin.'
                  : !destFolder
                    ? 'Now choose where the organized files should land.'
                    : 'This folder has no files to organize.'}
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
                <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      Ready to organize <span className="font-semibold">{files.length} files</span> by{' '}
                      <span className="font-semibold text-primary">{mode.label}</span> into{' '}
                      <span className="font-semibold">{baseName(destFolder!)}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{mode.hint}</p>
                  </div>
                  <button
                    onClick={handleOrganizeNow}
                    disabled={organizing}
                    className="group flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary disabled:opacity-50"
                  >
                    {organizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Let's Go
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ─────────── Files ─────────── */}
      {files.length > 0 && (
        <Card className="mb-24">
          <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold tracking-tight">Files to organize</h3>
              <Badge variant="default">{files.length}</Badge>
              {selectedFiles.size > 0 && <Badge variant="info">{selectedFiles.size} selected</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSortKey((k) => (k === 'name' ? 'type' : k === 'type' ? 'size' : 'name'))}
              >
                <ArrowUpDown className="h-4 w-4" />
                By {sortKey}
              </Button>
              <div className="flex rounded-xl bg-secondary/70 p-1">
                {(['list', 'grid'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setViewMode(m)}
                    className="relative flex h-8 w-8 items-center justify-center rounded-lg"
                    title={m === 'list' ? 'List view' : 'Grid view'}
                  >
                    {viewMode === m && (
                      <motion.span layoutId="view-toggle" className="absolute inset-0 rounded-lg bg-background shadow-sm" />
                    )}
                    {m === 'list' ? (
                      <List className={`relative h-4 w-4 ${viewMode === m ? 'text-primary' : 'text-muted-foreground'}`} />
                    ) : (
                      <LayoutGrid className={`relative h-4 w-4 ${viewMode === m ? 'text-primary' : 'text-muted-foreground'}`} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="p-3 pt-0 sm:p-6 sm:pt-0">
            <FileGrid
              files={sortedFiles}
              viewMode={viewMode}
              selectedFiles={selectedFiles}
              onToggleSelection={toggleFileSelection}
              onToggleSelectAll={toggleSelectAll}
              onPreviewFile={onPreviewFile}
            />
          </div>
        </Card>
      )}

      {/* ─────────── Floating action dock ─────────── */}
      <AnimatePresence>
        {files.length > 0 && !strategyInView && (
          <motion.div
            className="sticky bottom-6 z-20 mx-auto max-w-3xl"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          >
            <div className="glass-strong edge-light flex items-center justify-between gap-6 rounded-2xl border-border-strong p-4 pl-6 shadow-[0_30px_80px_-30px_var(--glow)]">
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-sm font-medium">
                  {selectedFiles.size > 0
                    ? `${selectedFiles.size} of ${files.length} files selected`
                    : `${files.length} files ready · by ${mode.label}`}
                </p>
                {sourceFolder && destFolder ? (
                  <span className="flex items-center gap-1 text-xs text-success">
                    <CheckCircle2 className="h-3 w-3" /> Ready to start
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-warning">
                    <AlertCircle className="h-3 w-3" /> Choose a destination folder
                  </span>
                )}
              </div>
              <Button size="lg" onClick={handleOrganizeNow} disabled={organizing || !sourceFolder || !destFolder}>
                {organizing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Starting…
                  </>
                ) : (
                  <>
                    <Waves className="h-5 w-5" /> Organize Now
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FolderStation({
  label,
  icon: Icon,
  path,
  stats,
  fallbackCount,
  loading,
  onPick,
  onClear,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string | null;
  stats: FolderStats | null;
  fallbackCount?: number;
  loading: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div
      className={`group relative min-w-0 rounded-2xl border p-4 backdrop-blur-md transition-all ${
        path ? 'border-black/10 bg-white/80 shadow-lg shadow-black/5' : 'border-dashed border-black/15 bg-white/45 hover:bg-white/70'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            path ? 'bg-black text-white' : 'bg-black/5 text-neutral-600'
          }`}
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</p>
          <p className="truncate text-sm font-medium text-neutral-900" title={path ?? undefined}>
            {path ? baseName(path) : 'Not chosen yet'}
          </p>
          {path && (
            <p className="mt-0.5 text-xs text-neutral-500">
              {statFiles(stats, fallbackCount)} files · {statSize(stats)}
            </p>
          )}
        </div>
        {path && (
          <button
            onClick={onClear}
            className="rounded-full p-1 text-neutral-400 opacity-0 transition-all hover:bg-black/5 hover:text-neutral-700 group-hover:opacity-100"
            title="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <button
        onClick={onPick}
        disabled={loading}
        className={`mt-3 w-full rounded-xl py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
          path ? 'bg-black/5 text-neutral-800 hover:bg-black/10' : 'bg-black text-white hover:bg-neutral-800'
        }`}
      >
        {path ? 'Change folder' : `Choose ${label.toLowerCase()}`}
      </button>
    </div>
  );
}
