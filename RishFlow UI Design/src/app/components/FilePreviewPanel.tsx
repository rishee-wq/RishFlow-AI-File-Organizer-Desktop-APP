import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, CheckCircle2, Sparkles, Edit2, FolderInput, Loader2 } from 'lucide-react';
import { pythonAPI } from '@/api/pywebview';
import { Button } from './Button';
import { Input } from './Input';
import { Badge } from './Badge';
import { ProgressBar } from './ProgressBar';

interface FilePreviewPanelProps {
  file: {
    id: string;
    name: string;
    type: string;
    size: string;
    category: string;
    confidence: number;
    tags: string[];
    icon: React.ComponentType<any>;
    color: string;
    path?: string;
  };
  onClose: () => void;
  onApprove: () => void;
  onChange: () => void;
}

export function FilePreviewPanel({ file, onClose, onApprove, onChange }: FilePreviewPanelProps) {
  const [suggestedName, setSuggestedName] = useState(file.name);
  const [suggestedFolder, setSuggestedFolder] = useState(`/${file.category}`);
  const [localTags, setLocalTags] = useState<string[]>(file.tags || []);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    setLocalTags(file.tags || []);
    if (!pythonAPI.available) return;

    const target = file.path || file.name;
    const lower = file.name.toLowerCase();
    const isText = file.type === 'Document' || lower.endsWith('.txt');
    const isImage = file.type === 'Image' || /\.(jpe?g|png)$/.test(lower);
    if (!isText && !isImage) return;

    let cancelled = false;
    (async () => {
      setAnalyzing(true);
      try {
        if (isText) {
          const res = await pythonAPI.getSmartKeywords(target);
          if (!cancelled && res?.keywords) setLocalTags((prev) => Array.from(new Set([...prev, ...res.keywords])));
        }
        if (isImage) {
          const res = await pythonAPI.getDominantColor(target);
          if (!cancelled && res?.color && res.color !== 'unknown') {
            setLocalTags((prev) => Array.from(new Set([...prev, `Color: ${res.color}`])));
          }
        }
      } catch (err) {
        console.error('Local AI Error:', err);
      } finally {
        if (!cancelled) setAnalyzing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file.name, file.type, file.path, file.tags]);

  const Icon = file.icon;
  const verdict =
    file.confidence >= 90 ? 'Very high confidence' : file.confidence >= 70 ? 'Good confidence' : 'Moderate confidence — worth a look';

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        className="glass-strong fixed bottom-3 right-3 top-3 z-50 flex w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-3xl shadow-2xl"
        initial={{ x: '110%' }}
        animate={{ x: 0 }}
        exit={{ x: '110%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 34 }}
      >
        {/* Header */}
        <div className="relative overflow-hidden border-b border-border p-6">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-40 blur-3xl" style={{ background: file.color }} />
          <div className="relative mb-5 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">File details</p>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="relative flex items-start gap-4">
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${file.color}22`, color: file.color, boxShadow: `0 12px 34px -14px ${file.color}` }}
            >
              <Icon className="h-8 w-8" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 break-words text-base font-semibold leading-snug" title={file.name}>
                {file.name}
              </p>
              <div className="flex items-center gap-2">
                <Badge>{file.type}</Badge>
                <span className="text-xs text-muted-foreground">{file.size}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Local AI analysis</h3>
              {analyzing && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <div className="rounded-2xl border border-primary/15 bg-primary/[0.06] p-4">
              <p className="text-sm leading-relaxed text-foreground/90">
                Detected as a <strong>{file.type.toLowerCase()}</strong> and matched to{' '}
                <strong>{file.category}</strong>. Tags below come from on-device analysis — nothing leaves your computer.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {localTags.map((tag, idx) => (
                  <motion.span
                    key={tag}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.04 }}
                    className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary"
                  >
                    {tag}
                  </motion.span>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Confidence</h3>
              <span className="text-sm font-semibold tabular-nums text-primary">{file.confidence}%</span>
            </div>
            <ProgressBar value={file.confidence} size="lg" />
            <p className="mt-2 text-xs text-muted-foreground">{verdict}</p>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Edit2 className="h-3.5 w-3.5" /> Suggested name
            </label>
            <Input value={suggestedName} onChange={(e) => setSuggestedName(e.target.value)} placeholder="Enter new file name" />
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <FolderInput className="h-3.5 w-3.5" /> Destination folder
            </label>
            <Input value={suggestedFolder} onChange={(e) => setSuggestedFolder(e.target.value)} placeholder="Enter folder path" />
            {file.path && (
              <p className="mt-2 truncate text-xs text-muted-foreground" title={file.path}>
                Currently at {file.path}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 border-t border-border p-4">
          <Button variant="secondary" onClick={onChange}>
            Close
          </Button>
          <Button onClick={onApprove}>
            <CheckCircle2 className="h-4 w-4" /> Looks good
          </Button>
        </div>
      </motion.aside>
    </>
  );
}
