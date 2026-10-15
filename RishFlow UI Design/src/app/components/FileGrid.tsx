import React from 'react';
import { motion } from 'motion/react';
import { Check, Eye, Minus } from 'lucide-react';
import { Badge } from './Badge';
import { ProgressBar } from './ProgressBar';

export interface FileItem {
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
}

interface FileGridProps {
  files: FileItem[];
  viewMode: 'list' | 'grid';
  selectedFiles: Set<string>;
  onToggleSelection: (id: string) => void;
  onToggleSelectAll: () => void;
  onPreviewFile: (file: FileItem) => void;
  showSelectionControls?: boolean;
}

// Only the first rows get an entrance animation — big folders stay snappy
const ANIMATED = 36;

function Checkbox({ state, onClick }: { state: 'on' | 'off' | 'some'; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      aria-checked={state === 'on'}
      role="checkbox"
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-all ${
        state === 'off'
          ? 'border-border-strong bg-transparent hover:border-primary'
          : 'border-primary bg-primary text-primary-foreground shadow-[0_0_12px_-2px_var(--glow)]'
      }`}
    >
      {state === 'on' && <Check className="h-3 w-3" strokeWidth={3.5} />}
      {state === 'some' && <Minus className="h-3 w-3" strokeWidth={3.5} />}
    </button>
  );
}

export function FileGrid({
  files,
  viewMode,
  selectedFiles,
  onToggleSelection,
  onToggleSelectAll,
  onPreviewFile,
  showSelectionControls = true,
}: FileGridProps) {
  const allState = selectedFiles.size === 0 ? 'off' : selectedFiles.size === files.length ? 'on' : 'some';

  if (viewMode === 'list') {
    return (
      <div>
        <div className="mb-1 flex items-center gap-4 rounded-xl bg-secondary/50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {showSelectionControls && <Checkbox state={allState} onClick={onToggleSelectAll} />}
          <span className="flex-1">File</span>
          <span className="hidden w-28 sm:block">Type</span>
          <span className="hidden w-32 md:block">Category</span>
          <span className="hidden w-32 lg:block">Confidence</span>
          <span className="w-9" />
        </div>

        <div className="divide-y divide-border/60">
          {files.map((file, i) => {
            const Icon = file.icon;
            const isSelected = selectedFiles.has(file.id);
            return (
              <motion.div
                key={file.id}
                initial={i < ANIMATED ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, ANIMATED) * 0.018, duration: 0.35 }}
                onClick={() => showSelectionControls && onToggleSelection(file.id)}
                className={`group flex items-center gap-4 rounded-xl px-4 py-3 transition-colors ${
                  showSelectionControls ? 'cursor-pointer' : ''
                } ${isSelected ? 'bg-primary/[0.07]' : 'hover:bg-accent/40'}`}
              >
                {showSelectionControls && (
                  <Checkbox
                    state={isSelected ? 'on' : 'off'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelection(file.id);
                    }}
                  />
                )}
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105"
                    style={{ backgroundColor: `${file.color}1f`, color: file.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{file.size}</p>
                  </div>
                </div>
                <div className="hidden w-28 sm:block">
                  <Badge>{file.type}</Badge>
                </div>
                <div className="hidden w-32 md:block">
                  <Badge variant="info">{file.category}</Badge>
                </div>
                <div className="hidden w-32 items-center gap-2 lg:flex">
                  <ProgressBar value={file.confidence} size="sm" />
                  <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{file.confidence}%</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreviewFile(file);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  title="Preview"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {files.map((file, i) => {
        const Icon = file.icon;
        const isSelected = selectedFiles.has(file.id);
        return (
          <motion.div
            key={file.id}
            initial={i < ANIMATED ? { opacity: 0, scale: 0.94 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(i, ANIMATED) * 0.02, duration: 0.35 }}
            onClick={() => showSelectionControls && onToggleSelection(file.id)}
            className={`group relative cursor-pointer rounded-2xl border p-4 transition-all duration-300 ${
              isSelected
                ? 'border-primary/60 bg-primary/[0.07] shadow-[0_12px_40px_-20px_var(--glow)]'
                : 'border-border bg-secondary/30 hover:-translate-y-0.5 hover:border-border-strong'
            }`}
          >
            {showSelectionControls && (
              <div className={`absolute left-3 top-3 z-10 transition-opacity ${isSelected ? '' : 'opacity-0 group-hover:opacity-100'}`}>
                <Checkbox
                  state={isSelected ? 'on' : 'off'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelection(file.id);
                  }}
                />
              </div>
            )}
            <div className="flex flex-col items-center space-y-3 pt-2 text-center">
              <span
                className="flex h-16 w-16 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${file.color}1f`, color: file.color, boxShadow: `0 10px 30px -14px ${file.color}` }}
              >
                <Icon className="h-8 w-8" />
              </span>
              <div className="w-full">
                <p className="w-full truncate text-sm font-medium text-foreground" title={file.name}>
                  {file.name}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{file.size}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPreviewFile(file);
                }}
                className="w-full rounded-lg border-t border-border/60 pt-2 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                Preview
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
