import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { toast } from 'sonner';
import { pythonAPI } from '../../api/pywebview';
import { getColorForFile, getTypeForFile, formatFileSize, baseName } from '../lib/files';

export interface FileItem {
  id: string;
  name: string;
  type: string;
  size: string;
  category: string;
  confidence: number;
  tags: string[];
  color: string;
  path?: string;
}

export interface Category {
  id: string;
  name: string;
  fileCount: number;
  color: string;
  icon: string;
  lastModified: string;
}

export interface ActivityItem {
  id: string;
  fileName: string;
  fromPath: string;
  toPath: string;
  category: string;
  confidence: number;
  timestamp: string;
  date: string;
  time: number;
  status: string;
  color: string;
}

interface DataContextType {
  files: FileItem[];
  categories: Category[];
  activities: ActivityItem[];
  loading: boolean;
  refreshData: (overrideDest?: string) => Promise<void>;
  addCategory: (name: string, color: string, icon: string) => void;
  updateCategory: (id: string, name: string, color: string, icon: string) => void;
  deleteCategory: (id: string) => void;
  selectedSourceFolder: string | null;
  setSelectedSourceFolder: (path: string | null) => void;
  selectedDestFolder: string | null;
  setSelectedDestFolder: (path: string | null) => void;
  stats: {
    totalFiles: number;
    totalCategories: number;
    avgConfidence: number;
    sortedToday: number;
    lastActivity: number | null;
  };
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Documents', fileCount: 0, color: '#38bdf8', icon: '📄', lastModified: 'just now' },
  { id: '2', name: 'Audio', fileCount: 0, color: '#fbbf24', icon: '🎵', lastModified: 'just now' },
];

declare global {
  interface Window {
    onOrganizeComplete?: (source: string, summary?: { moved: number; skipped: number; failed: number }) => void;
    onRevertComplete?: () => void;
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSourceFolder, _setSelectedSourceFolder] = useState<string | null>(null);
  const [selectedDestFolder, _setSelectedDestFolder] = useState<string | null>(null);

  // User-created categories survive periodic rescans (and app restarts).
  const customCategories = useRef<Category[]>([]);
  const hiddenCategories = useRef<Set<string>>(new Set());
  const destRef = useRef<string | null>(null);

  const persistCustom = () => {
    if (pythonAPI.available) {
      pythonAPI
        .saveState('user_categories', {
          custom: customCategories.current,
          hidden: Array.from(hiddenCategories.current),
        })
        .catch(() => {});
    }
  };

  const setSelectedSourceFolder = (path: string | null) => {
    _setSelectedSourceFolder(path);
    if (path && pythonAPI.available) pythonAPI.saveState('last_source_folder', path).catch(() => {});
  };

  const setSelectedDestFolder = (path: string | null) => {
    _setSelectedDestFolder(path);
    destRef.current = path;
    if (path) {
      if (pythonAPI.available) pythonAPI.saveState('last_dest_folder', path).catch(() => {});
      refreshData(path);
    }
  };

  const refreshData = async (overrideDest?: string) => {
    try {
      setLoading(true);
      await pythonAPI.initialize();
      if (!pythonAPI.available) return;

      if (!selectedSourceFolder) {
        const savedSource = await pythonAPI.loadState('last_source_folder');
        if (savedSource?.value) _setSelectedSourceFolder(savedSource.value);
      }

      let destFolder = overrideDest || destRef.current;
      if (!destFolder) {
        const savedDest = await pythonAPI.loadState('last_dest_folder');
        if (savedDest?.value) {
          destFolder = savedDest.value;
          destRef.current = destFolder;
          _setSelectedDestFolder(destFolder);
        }
      }

      // 1. Activity log
      const logs = await pythonAPI.getLogs();
      if (Array.isArray(logs)) {
        const items: ActivityItem[] = [];
        logs.forEach((log: any, index: number) => {
          if (log.action.includes('Moved to') || log.action.includes('Failed') || log.action.includes('Reverted')) {
            const fileName = log.source_file ? baseName(log.source_file) : 'Unknown';
            const when = new Date(log.timestamp);
            items.push({
              id: `activity_${index}`,
              fileName,
              fromPath: log.source_file || '',
              toPath: log.destination || '',
              category: log.action.replace('Moved to ', '').trim(),
              confidence: 85,
              timestamp: when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              date: when.toLocaleDateString(),
              time: when.getTime(),
              status: log.status || 'success',
              color: getColorForFile(fileName),
            });
          }
        });
        setActivities(items.slice(0, 500));
      }

      // 2. Real file state from the destination folder
      const filesMap = new Map<string, FileItem>();
      const categoriesMap = new Map<string, Category>();

      [...DEFAULT_CATEGORIES, ...customCategories.current].forEach((cat) => {
        if (!hiddenCategories.current.has(cat.name)) categoriesMap.set(cat.name, { ...cat, fileCount: 0 });
      });

      if (destFolder) {
        const scanResult = await pythonAPI.scanOrganizedFiles(destFolder);
        if (scanResult?.files) {
          scanResult.files.forEach((f: any, index: number) => {
            const fileId = `file_${f.name}_${index}`;
            const categoryName = f.category || 'Uncategorized';

            filesMap.set(fileId, {
              id: fileId,
              name: f.name,
              type: f.type === 'file' ? getTypeForFile(f.name) : f.type.charAt(0).toUpperCase() + f.type.slice(1),
              size: formatFileSize(f.size),
              category: categoryName,
              confidence: 100,
              tags: [categoryName.toLowerCase()],
              color: getColorForFile(f.name),
              path: f.path,
            });

            const existing = categoriesMap.get(categoryName);
            if (existing) {
              existing.fileCount += 1;
            } else if (!hiddenCategories.current.has(categoryName)) {
              categoriesMap.set(categoryName, {
                id: `cat_${categoryName}`,
                name: categoryName,
                fileCount: 1,
                color: getColorForFile(f.name),
                icon: '📁',
                lastModified: new Date(f.modified * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              });
            }
          });
        }
      }

      setFiles(Array.from(filesMap.values()));
      setCategories(Array.from(categoriesMap.values()));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addCategory = (name: string, color: string, icon: string = '📁') => {
    const cat: Category = { id: `cat_${Date.now()}`, name, fileCount: 0, color, icon, lastModified: 'just now' };
    customCategories.current = [...customCategories.current.filter((c) => c.name !== name), cat];
    hiddenCategories.current.delete(name);
    setCategories((prev) => [...prev.filter((c) => c.name !== name), cat]);
    persistCustom();
  };

  const updateCategory = (id: string, name: string, color: string, icon: string) => {
    setCategories((prev) => {
      const next = prev.map((cat) => (cat.id === id ? { ...cat, name, color, icon, lastModified: 'just now' } : cat));
      const updated = next.find((c) => c.id === id);
      const original = prev.find((c) => c.id === id);
      if (updated) {
        if (original && original.name !== name) hiddenCategories.current.add(original.name);
        customCategories.current = [
          ...customCategories.current.filter((c) => c.id !== id && c.name !== original?.name),
          { ...updated, fileCount: 0 },
        ];
        persistCustom();
      }
      return next;
    });
  };

  const deleteCategory = (id: string) => {
    setCategories((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target) {
        customCategories.current = customCategories.current.filter((c) => c.id !== id);
        hiddenCategories.current.add(target.name);
        persistCustom();
      }
      return prev.filter((cat) => cat.id !== id);
    });
  };

  const todayKey = new Date().toLocaleDateString();
  const activityTimes = activities.map((a) => a.time).filter((t) => !Number.isNaN(t));
  const stats = {
    totalFiles: files.length,
    totalCategories: categories.length,
    avgConfidence: files.length > 0 ? Math.round(files.reduce((sum, f) => sum + f.confidence, 0) / files.length) : 0,
    sortedToday: activities.filter((a) => a.date === todayKey && a.status !== 'error').length,
    lastActivity: activityTimes.length ? Math.max(...activityTimes) : null,
  };

  useEffect(() => {
    let cancelled = false;

    // Load persisted custom categories before the first scan
    pythonAPI
      .initialize()
      .then(() => (pythonAPI.available ? pythonAPI.loadState('user_categories') : null))
      .then((res) => {
        const v = res?.value;
        if (v && !cancelled) {
          customCategories.current = Array.isArray(v.custom) ? v.custom : [];
          hiddenCategories.current = new Set(Array.isArray(v.hidden) ? v.hidden : []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) refreshData();
      });

    // Python calls these via evaluate_js when background work finishes
    window.onOrganizeComplete = (_source, summary) => {
      const moved = summary?.moved ?? 0;
      const left = (summary?.skipped ?? 0) + (summary?.failed ?? 0);
      toast.success('Organization complete', {
        description: `${moved} file${moved === 1 ? '' : 's'} moved${left ? ` · ${left} left in place` : ''}.`,
      });
      if (summary?.failed) {
        toast.warning(`${summary.failed} file${summary.failed === 1 ? '' : 's'} couldn't be moved`, {
          description: 'They may be open in another app. Details are in Activity Logs.',
        });
      }
      refreshData();
    };
    // The undo button that triggers a revert reports the result itself
    window.onRevertComplete = () => refreshData();

    const interval = setInterval(() => refreshData(), 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      delete window.onOrganizeComplete;
      delete window.onRevertComplete;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DataContext.Provider
      value={{
        files,
        categories,
        activities,
        loading,
        refreshData,
        addCategory,
        updateCategory,
        deleteCategory,
        selectedSourceFolder,
        setSelectedSourceFolder,
        selectedDestFolder,
        setSelectedDestFolder,
        stats,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
}
