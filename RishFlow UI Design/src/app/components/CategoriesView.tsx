import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Search, FolderTree, Plus, Edit2, Trash2, Eye, Check } from 'lucide-react';
import { useData, Category, FileItem as ContextFileItem } from '@/app/contexts/DataContext';
import { getIconForFile } from '../lib/files';
import { Card } from './Card';
import { Button } from './Button';
import { Input } from './Input';
import { Modal, useConfirm } from './Modal';
import { FileGrid, FileItem as GridFileItem } from './FileGrid';
import { PageHeader } from './PageHeader';

const EMOJI_LIST = ['📁', '📂', '📄', '📝', '📊', '📉', '📷', '🎬', '🎵', '💼', '💰', '🏠', '🎓', '🎁', '🛒', '🎮', '✈️', '🍔', '💪', '❤️', '⭐', '🔥', '💡', '🔒'];
const COLORS = ['#38bdf8', '#64cefb', '#2dd4bf', '#34d399', '#818cf8', '#a78bfa', '#f472b6', '#fb7185', '#fbbf24', '#fb923c', '#94a3b8', '#06b6d4'];

interface CategoriesViewProps {
  onPreviewFile?: (file: GridFileItem) => void;
}

export function CategoriesView({ onPreviewFile }: CategoriesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editor, setEditor] = useState<{ mode: 'new' } | { mode: 'edit'; id: string } | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState('📁');
  const [viewingCategory, setViewingCategory] = useState<Category | null>(null);
  const confirm = useConfirm();

  const { categories, addCategory, updateCategory, deleteCategory, files } = useData();

  const filtered = categories.filter((cat) => cat.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const maxCount = Math.max(1, ...categories.map((c) => c.fileCount));

  const getCategoryFiles = (category: Category | null): GridFileItem[] =>
    category
      ? files
          .filter((f: ContextFileItem) => f.category === category.name)
          .map((f: ContextFileItem) => ({ ...f, icon: getIconForFile(f.name) }))
      : [];

  const openNew = () => {
    setName('');
    setColor(COLORS[0]);
    setIcon('📁');
    setEditor({ mode: 'new' });
  };

  const openEdit = (c: Category) => {
    setName(c.name);
    setColor(c.color);
    setIcon(c.icon);
    setEditor({ mode: 'edit', id: c.id });
  };

  const save = () => {
    if (!name.trim() || !editor) return;
    if (editor.mode === 'new') addCategory(name.trim(), color, icon);
    else updateCategory(editor.id, name.trim(), color, icon);
    setEditor(null);
  };

  const remove = async (c: Category) => {
    const ok = await confirm({
      title: `Delete “${c.name}”?`,
      description: 'The category is removed from RishFlow. Files already on disk are not touched.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) deleteCategory(c.id);
  };

  const viewingFiles = getCategoryFiles(viewingCategory);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Library"
        title="Categories"
        subtitle={`Where every file finds its place — ${categories.length} streams in total.`}
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> New category
          </Button>
        }
      />

      <div className="max-w-md">
        <Input
          icon={<Search className="h-4 w-4" />}
          placeholder="Search categories…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filtered.length > 0 ? (
        <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <AnimatePresence>
            {filtered.map((category, i) => (
              <motion.div
                key={category.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.4, delay: Math.min(i, 12) * 0.04, ease: [0.22, 1, 0.36, 1] }}
              >
                <Card hover className="group h-full">
                  {/* colour bloom */}
                  <div
                    className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-40 blur-2xl transition-opacity duration-500 group-hover:opacity-70"
                    style={{ background: category.color }}
                  />
                  <div className="relative p-6">
                    <div className="mb-5 flex items-start justify-between">
                      <span
                        className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                        style={{ backgroundColor: `${category.color}22`, boxShadow: `inset 0 0 0 1px ${category.color}40` }}
                      >
                        {category.icon}
                      </span>
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => openEdit(category)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(category)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <h3 className="truncate text-lg font-semibold tracking-tight">{category.name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">Updated {category.lastModified}</p>

                    <div className="mt-5">
                      <div className="mb-2 flex items-baseline justify-between">
                        <span className="text-2xl font-semibold tabular-nums tracking-tight">{category.fileCount}</span>
                        <span className="text-xs text-muted-foreground">files</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: category.color, boxShadow: `0 0 10px ${category.color}` }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(category.fileCount / maxCount) * 100}%` }}
                          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                    </div>

                    <Button variant="secondary" size="sm" className="mt-5 w-full" onClick={() => setViewingCategory(category)}>
                      <Eye className="h-3.5 w-3.5" /> View files
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <Card>
          <div className="flex flex-col items-center p-14 text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Search className="h-6 w-6" />
            </span>
            <h3 className="text-lg font-semibold">{categories.length === 0 ? 'No categories yet' : 'Nothing matches'}</h3>
            <p className="mb-5 mt-1 text-sm text-muted-foreground">
              {categories.length === 0 ? 'Create one, or organize a folder and they will appear.' : 'Try a different search.'}
            </p>
            <Button variant="secondary" onClick={() => (categories.length === 0 ? openNew() : setSearchQuery(''))}>
              {categories.length === 0 ? 'Create category' : 'Clear search'}
            </Button>
          </div>
        </Card>
      )}

      {/* Create / edit */}
      <Modal
        open={!!editor}
        onClose={() => setEditor(null)}
        title={editor?.mode === 'edit' ? 'Edit category' : 'New category'}
        subtitle="Name it, give it an icon and a colour."
        icon={
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl"
            style={{ backgroundColor: `${color}22`, boxShadow: `inset 0 0 0 1px ${color}55` }}
          >
            {icon}
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditor(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!name.trim()}>
              {editor?.mode === 'edit' ? 'Save changes' : 'Create category'}
            </Button>
          </>
        }
      >
        <div className="space-y-5 p-6">
          <Input
            label="Name"
            placeholder="e.g. Invoices, Screenshots, Archive"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <div>
            <p className="mb-2 text-sm font-medium">Icon</p>
            <div className="grid grid-cols-8 gap-1.5 rounded-2xl bg-secondary/50 p-2">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  className={`flex aspect-square items-center justify-center rounded-xl text-lg transition-all ${
                    icon === emoji ? 'scale-110 bg-primary/20 ring-1 ring-primary' : 'hover:bg-accent'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Colour</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px var(--background), 0 0 0 4px ${c}` : undefined }}
                >
                  {color === c && <Check className="h-4 w-4 text-black/70" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Category contents */}
      <Modal
        open={!!viewingCategory}
        onClose={() => setViewingCategory(null)}
        className="max-w-5xl"
        title={viewingCategory?.name}
        subtitle={`${viewingFiles.length} files sorted here`}
        icon={
          viewingCategory && (
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl"
              style={{ backgroundColor: `${viewingCategory.color}22` }}
            >
              {viewingCategory.icon}
            </span>
          )
        }
      >
        <div className="p-4 sm:p-6">
          {viewingFiles.length > 0 ? (
            <FileGrid
              files={viewingFiles}
              viewMode="list"
              selectedFiles={new Set()}
              onToggleSelection={() => {}}
              onToggleSelectAll={() => {}}
              onPreviewFile={(f) => {
                setViewingCategory(null);
                onPreviewFile?.(f);
              }}
              showSelectionControls={false}
            />
          ) : (
            <div className="flex h-56 flex-col items-center justify-center text-center text-muted-foreground">
              <FolderTree className="mb-3 h-8 w-8 opacity-50" />
              <p className="text-sm">No files in this category yet.</p>
              <p className="mt-1 text-xs opacity-70">Files organized into it will appear here.</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
