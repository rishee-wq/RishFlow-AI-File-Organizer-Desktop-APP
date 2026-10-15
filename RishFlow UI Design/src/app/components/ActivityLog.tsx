import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Undo2, Search, History, Loader2, ShieldCheck, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { useData, type ActivityItem } from '@/app/contexts/DataContext';
import { pythonAPI } from '@/api/pywebview';
import { getIconForFile, baseName, parentName } from '../lib/files';
import { Card } from './Card';
import { Badge } from './Badge';
import { Button } from './Button';
import { Input } from './Input';
import { useConfirm } from './Modal';
import { PageHeader } from './PageHeader';

type Range = 'all' | 'today' | 'week' | 'month';
const RANGES: Array<{ id: Range; label: string }> = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: '7 days' },
  { id: 'month', label: '30 days' },
];
const PAGE = 40;

interface ActivityLogProps {
  mode?: 'activity' | 'undo';
}

export function ActivityLog({ mode = 'activity' }: ActivityLogProps) {
  const [range, setRange] = useState<Range>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [undoing, setUndoing] = useState(false);
  const { activities, refreshData } = useData();
  const confirm = useConfirm();

  const now = Date.now();
  const todayKey = new Date().toLocaleDateString();
  const inRange = (a: ActivityItem, r: Range) => {
    if (r === 'all') return true;
    if (r === 'today') return a.date === todayKey;
    const days = r === 'week' ? 7 : 30;
    return now - a.time <= days * 86400000;
  };

  const filtered = useMemo(
    () =>
      activities.filter(
        (a) => inRange(a, range) && (!query || a.fileName.toLowerCase().includes(query.toLowerCase()) || a.category.toLowerCase().includes(query.toLowerCase())),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activities, range, query],
  );

  const visible = filtered.slice(0, limit);
  const grouped = visible.reduce<Record<string, ActivityItem[]>>((acc, a) => {
    (acc[a.date] ||= []).push(a);
    return acc;
  }, {});

  const failed = activities.filter((a) => a.status === 'error' || a.category.startsWith('Failed')).length;
  const stats = [
    { label: 'Total actions', value: activities.length },
    { label: 'Today', value: activities.filter((a) => inRange(a, 'today')).length },
    { label: 'Last 7 days', value: activities.filter((a) => inRange(a, 'week')).length },
    { label: 'Success rate', value: activities.length ? `${Math.round(((activities.length - failed) / activities.length) * 100)}%` : '—' },
  ];

  const undoLast = async () => {
    const ok = await confirm({
      title: 'Undo the last run?',
      description: 'Files from the most recent organization are moved back to their original locations.',
      confirmLabel: 'Undo run',
      destructive: true,
    });
    if (!ok) return;
    if (!pythonAPI.available) {
      toast.info('Undo runs in the RishFlow desktop app.');
      return;
    }
    try {
      setUndoing(true);
      const res = await pythonAPI.revertLast();
      if (res?.error) throw new Error(res.error);
      if (res?.status === 'no_ops') {
        toast.info('Nothing to undo', { description: 'Only the most recent run in this session can be reverted.' });
      } else {
        toast.success('Undo complete', { description: `${res?.count ?? 0} files are back where they started.` });
      }
      await refreshData();
    } catch (error) {
      toast.error('Undo failed', { description: error instanceof Error ? error.message : String(error) });
    } finally {
      setUndoing(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={mode === 'undo' ? 'Safety net' : 'History'}
        title={mode === 'undo' ? 'Undo Actions' : 'Activity Logs'}
        subtitle={
          mode === 'undo'
            ? 'Changed your mind? Send the last run back upstream.'
            : 'Every move RishFlow made, in the order it happened.'
        }
      />

      {mode === 'undo' && (
        <Card className="overflow-hidden">
          <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex flex-wrap items-center gap-6 p-6 sm:p-8">
            <span className="relative flex h-16 w-16 items-center justify-center">
              <span className="animate-ripple absolute inset-0 rounded-full border border-primary/40" />
              <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <History className="h-7 w-7" />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold tracking-tight">Revert the most recent organization</h3>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                RishFlow remembers the last run while the app is open. Undo moves those files back and tidies up any
                folders left empty.
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
                <ShieldCheck className="h-3.5 w-3.5" /> Nothing is deleted — files are only moved.
              </p>
            </div>
            <Button variant="destructive" size="lg" onClick={undoLast} disabled={undoing}>
              {undoing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Undo2 className="h-5 w-5" />}
              Undo last run
            </Button>
          </div>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
            <Card className="h-full">
              <div className="p-5">
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{s.value}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="glass flex rounded-full p-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setRange(r.id);
                setLimit(PAGE);
              }}
              className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                range === r.id ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {range === r.id && (
                <motion.span layoutId="range-pill" className="absolute inset-0 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
              )}
              <span className="relative">{r.label}</span>
            </button>
          ))}
        </div>
        <div className="w-full max-w-xs">
          <Input icon={<Search className="h-4 w-4" />} placeholder="Filter by file or category…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {/* Timeline */}
      <Card className={mode === 'activity' ? 'mb-20' : ''}>
        <div className="p-4 sm:p-6">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <Inbox className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {activities.length === 0 ? 'No activity yet. Organize a folder to see every move here.' : 'Nothing matches these filters.'}
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(grouped).map(([date, items]) => (
                <div key={date}>
                  <div className="sticky top-0 z-[1] -mx-2 mb-3 flex items-center gap-3 px-2 py-1">
                    <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" />
                    <h3 className="text-sm font-semibold">{date === todayKey ? 'Today' : date}</h3>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <ol className="relative ml-1 space-y-2 border-l border-border pl-6">
                    {items.map((a, i) => {
                      const Icon = getIconForFile(a.fileName);
                      const isFail = a.status === 'error' || a.category.startsWith('Failed');
                      return (
                        <motion.li
                          key={a.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(i, 15) * 0.03 }}
                          className="relative"
                        >
                          <span
                            className="absolute -left-[29px] top-5 h-2.5 w-2.5 rounded-full ring-4 ring-background"
                            style={{ background: isFail ? 'var(--destructive)' : a.color }}
                          />
                          <div className="flex items-center gap-4 rounded-xl border border-transparent p-3 transition-colors hover:border-border hover:bg-accent/30">
                            <span
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                              style={{ backgroundColor: `${a.color}1f`, color: a.color }}
                            >
                              <Icon className="h-5 w-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium" title={a.fileName}>
                                {a.fileName}
                              </p>
                              <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                                <span className="truncate" title={a.fromPath}>
                                  {parentName(a.fromPath) || '—'}
                                </span>
                                <ArrowRight className="h-3 w-3 shrink-0" />
                                <span className="truncate" title={a.toPath}>
                                  {baseName(a.toPath) || '—'}
                                </span>
                              </div>
                            </div>
                            <Badge variant={isFail ? 'error' : a.category.startsWith('Reverted') ? 'warning' : 'info'} className="hidden max-w-[30%] sm:inline-flex">
                              {a.category}
                            </Badge>
                            <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{a.timestamp}</span>
                          </div>
                        </motion.li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          )}

          {filtered.length > limit && (
            <div className="mt-6 border-t border-border pt-6 text-center">
              <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
                Load more · {filtered.length - limit} remaining
              </Button>
            </div>
          )}
        </div>
      </Card>

      <AnimatePresence>
        {mode === 'activity' && activities.length > 0 && (
          <motion.div
            className="sticky bottom-6 z-20 mx-auto w-fit"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
          >
            <button
              onClick={undoLast}
              disabled={undoing}
              className="glass-strong edge-light flex items-center gap-2.5 rounded-full border-destructive/30 px-6 py-3.5 text-sm font-medium text-destructive transition-all hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
            >
              {undoing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
              Undo last run
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
