import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ScanSearch, FolderOpen, Loader2, RefreshCw, Search, FileSearch, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/app/contexts/DataContext';
import { pythonAPI } from '@/api/pywebview';
import { getIconForFile, getColorForFile, parentName } from '../lib/files';
import { Card } from './Card';
import { Button } from './Button';
import { Input } from './Input';
import { ProgressBar } from './ProgressBar';
import { PageHeader } from './PageHeader';

interface IndexStatus {
  in_progress?: boolean;
  total?: number;
  done?: number;
  folder?: string;
}

interface SearchResult {
  name: string;
  path: string;
  snippet: string;
}

const POLL_MS = 500;

const norm = (p: string) => p.replace(/[\\/]+$/, '').replace(/\//g, '\\').toLowerCase();
const samePath = (a?: string | null, b?: string | null) => !!a && !!b && norm(a) === norm(b);

/** Wrap every case-insensitive occurrence of `query` in a highlight. */
function highlight(text: string, query: string) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.split(new RegExp(`(${escaped})`, 'ig')).map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="rounded bg-primary/25 px-0.5 text-foreground">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function AISearch() {
  const { selectedSourceFolder, selectedDestFolder } = useData();
  const [folder, setFolder] = useState<string | null>(selectedDestFolder || selectedSourceFolder);
  const [status, setStatus] = useState<IndexStatus>({});
  const [query, setQuery] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const pollRef = useRef<number | null>(null);

  const indexing = !!status.in_progress && samePath(status.folder, folder);
  const indexed = !status.in_progress && samePath(status.folder, folder);

  const stopPolling = () => {
    if (pollRef.current !== null) window.clearInterval(pollRef.current);
    pollRef.current = null;
  };

  const startPolling = () => {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      try {
        const s: IndexStatus = await pythonAPI.getAIIndexStatus();
        setStatus(s || {});
        if (!s?.in_progress) stopPolling();
      } catch {
        stopPolling();
      }
    }, POLL_MS);
  };

  // Pick up an index that is already built or still running
  useEffect(() => {
    if (!pythonAPI.available) return;
    pythonAPI
      .getAIIndexStatus()
      .then((s: IndexStatus) => {
        setStatus(s || {});
        if (s?.in_progress) startPolling();
      })
      .catch(() => {});
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once indexing finishes, re-run the last search so content matches show up
  const wasIndexing = useRef(false);
  useEffect(() => {
    if (wasIndexing.current && indexed && lastQuery) runSearch(lastQuery);
    wasIndexing.current = indexing;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexing, indexed]);

  const chooseFolder = async () => {
    try {
      const picked = await pythonAPI.browseFolder('Select Folder to Search');
      setFolder(picked);
      setResults(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg !== 'No folder selected') toast.error('Could not select folder', { description: msg });
    }
  };

  const buildIndex = async () => {
    if (!folder) return;
    try {
      const res = await pythonAPI.startIndexForAI(folder);
      if (res?.error) throw new Error(res.error);
      if (res?.status === 'already_indexing' && !samePath(status.folder, folder)) {
        toast.info('Another folder is still being indexed', { description: 'Try again when it finishes.' });
      }
      setStatus({ in_progress: true, total: 0, done: 0, folder });
      startPolling();
    } catch (error) {
      toast.error('Could not start indexing', { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const runSearch = async (q: string) => {
    if (!folder || !q.trim()) return;
    setSearching(true);
    setLastQuery(q.trim());
    try {
      const res = await pythonAPI.queryAI(folder, q.trim());
      if (res?.error) throw new Error(res.error);
      setResults(res?.results ?? []);
      if (res?.in_progress) {
        setStatus({ in_progress: true, total: res.total, done: res.done, folder });
        startPolling();
      }
    } catch (error) {
      toast.error('Search failed', { description: error instanceof Error ? error.message : String(error) });
    } finally {
      setSearching(false);
    }
  };

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      toast.success('Path copied');
    } catch {
      toast.error('Could not copy path');
    }
  };

  const header = (
    <PageHeader
      eyebrow="Find"
      title="AI Search"
      subtitle="Search inside your text files and PDFs. Everything is read and searched on this computer."
    />
  );

  if (!pythonAPI.available) {
    return (
      <div className="space-y-8">
        {header}
        <Card>
          <div className="flex flex-col items-center py-14 text-center">
            <ScanSearch className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">AI Search runs in the RishFlow desktop app.</p>
          </div>
        </Card>
      </div>
    );
  }

  const pct = status.total ? ((status.done ?? 0) / status.total) * 100 : 0;

  return (
    <div className="space-y-8">
      {header}

      {/* Folder + index */}
      <Card>
        <div className="flex flex-wrap items-center gap-5 p-6 sm:p-8">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <FolderOpen className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">Folder</p>
            <p className="truncate text-lg font-semibold tracking-tight" title={folder ?? ''}>
              {folder || 'No folder chosen'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {indexing
                ? `Reading documents… ${status.done ?? 0} of ${status.total ?? 0}`
                : indexed
                  ? `Indexed ${status.total ?? 0} document${status.total === 1 ? '' : 's'} (.txt, .md, .csv, .log, .pdf)`
                  : 'Not indexed yet. Until it is, only file names are searched.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={chooseFolder} disabled={indexing}>
              <FolderOpen className="h-4 w-4" />
              {folder ? 'Change' : 'Choose folder'}
            </Button>
            <Button onClick={buildIndex} disabled={!folder || indexing}>
              {indexing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {indexed ? 'Re-index' : 'Index folder'}
            </Button>
          </div>
          {indexing && <ProgressBar value={pct} className="basis-full" />}
        </div>
      </Card>

      {/* Query */}
      <form
        className="flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(query);
        }}
      >
        <Input
          icon={<Search className="h-4 w-4" />}
          placeholder={folder ? 'Search for a word or phrase…' : 'Choose a folder first'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={!folder}
        />
        <Button type="submit" disabled={!folder || !query.trim() || searching}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
          Search
        </Button>
      </form>

      {/* Results */}
      {results !== null && (
        <Card>
          <div className="p-4 sm:p-6">
            {results.length === 0 ? (
              <div className="flex flex-col items-center py-14 text-center">
                <FileSearch className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nothing matches “{lastQuery}”.</p>
              </div>
            ) : (
              <>
                <p className="mb-3 px-1 text-xs text-muted-foreground">
                  {results.length} result{results.length === 1 ? '' : 's'} for “{lastQuery}”
                </p>
                <ol className="space-y-1">
                  {results.map((r, i) => {
                    const Icon = getIconForFile(r.name);
                    const color = getColorForFile(r.name);
                    return (
                      <motion.li
                        key={r.path}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i, 15) * 0.03 }}
                        className="group flex items-start gap-4 rounded-xl border border-transparent p-3 transition-colors hover:border-border hover:bg-accent/30"
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                          style={{ backgroundColor: `${color}1f`, color }}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium" title={r.path}>
                            {highlight(r.name, lastQuery)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground" title={r.path}>
                            {parentName(r.path)}
                          </p>
                          {r.snippet && (
                            <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">…{highlight(r.snippet, lastQuery)}…</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyPath(r.path)}
                          title="Copy path"
                          className="opacity-0 group-hover:opacity-100"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </motion.li>
                    );
                  })}
                </ol>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
