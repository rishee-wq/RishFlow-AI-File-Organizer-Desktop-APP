import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { pythonAPI } from '../../api/pywebview';

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
  };
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSourceFolder, _setSelectedSourceFolder] = useState<string | null>(null);
  const [selectedDestFolder, _setSelectedDestFolder] = useState<string | null>(null);

  const setSelectedSourceFolder = (path: string | null) => {
    _setSelectedSourceFolder(path);
    if (path) {
      pythonAPI.saveState('last_source_folder', path);
    }
  };

  const setSelectedDestFolder = (path: string | null) => {
    _setSelectedDestFolder(path);
    if (path) {
      pythonAPI.saveState('last_dest_folder', path);
      refreshData(path);
    }
  };

  const defaultCategories: Category[] = [
    { id: '1', name: 'Documents', fileCount: 0, color: '#3b82f6', icon: '📄', lastModified: 'just now' },
    { id: '2', name: 'Audio', fileCount: 0, color: '#f59e0b', icon: '🎵', lastModified: 'just now' },
  ];

  const getColorForFile = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const colors: Record<string, string> = {
      pdf: '#3b82f6',
      doc: '#8b5cf6',
      docx: '#8b5cf6',
      jpg: '#ec4899',
      jpeg: '#ec4899',
      png: '#ec4899',
      gif: '#ec4899',
      xlsx: '#10b981',
      xls: '#10b981',
      mp3: '#f59e0b',
      mp4: '#06b6d4',
      avi: '#06b6d4',
    };
    return colors[ext] || '#6b7280';
  };

  const getTypeForFile = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return 'PDF';
    if (['doc', 'docx', 'txt'].includes(ext)) return 'Document';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext)) return 'Image';
    if (['xlsx', 'xls', 'csv'].includes(ext)) return 'Spreadsheet';
    if (['mp3', 'wav', 'flac'].includes(ext)) return 'Audio';
    if (['mp4', 'avi', 'mov'].includes(ext)) return 'Video';
    return 'File';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + ' ' + sizes[i];
  };

  const refreshData = async (overrideDest?: string) => {
    try {
      setLoading(true);

      // Load persisted state if not already set
      if (!selectedSourceFolder) {
        const savedSource = await pythonAPI.loadState('last_source_folder');
        if (savedSource && savedSource.value) {
          setSelectedSourceFolder(savedSource.value);
        }
      }

      let destFolder = overrideDest || selectedDestFolder;
      if (!destFolder) {
        const savedDest = await pythonAPI.loadState('last_dest_folder');
        if (savedDest && savedDest.value) {
          destFolder = savedDest.value;
          // Only update state if we didn't have an override (avoids loop if called from setter)
          if (!overrideDest) setSelectedDestFolder(destFolder);
        }
      }

      // 1. Get Activity Logs (keep this for the Activity Log UI)
      const logs = await pythonAPI.getLogs();
      const activitiesArray: ActivityItem[] = [];

      if (Array.isArray(logs)) {
        logs.forEach((log: any, index: number) => {
          if (log.action.includes('Moved to') || log.action.includes('Failed') || log.action.includes('Reverted')) {
            const fileName = log.source_file ? log.source_file.split(/[/\\]/).pop() : 'Unknown';
            activitiesArray.push({
              id: `activity_${index}`,
              fileName: fileName,
              fromPath: log.source_file || '',
              toPath: log.destination || '',
              category: log.action.replace('Moved to ', '').trim(),
              confidence: 85,
              timestamp: new Date(log.timestamp).toLocaleTimeString(),
              date: new Date(log.timestamp).toLocaleDateString(),
              color: getColorForFile(fileName),
            });
          }
        });
        setActivities(activitiesArray.slice(0, 500));
      }

      // 2. Get Real File State from Destination Folder
      const filesMap = new Map<string, FileItem>();
      const categoriesMap = new Map<string, Category>();

      // Initialize with default categories (with 0 count)
      defaultCategories.forEach(cat => {
        categoriesMap.set(cat.name, { ...cat, fileCount: 0 });
      });

      if (destFolder) {
        console.log('[DataContext] Scanning destination:', destFolder);
        const scanResult = await pythonAPI.scanOrganizedFiles(destFolder);
        console.log('[DataContext] Scan result:', scanResult);

        if (scanResult && scanResult.files) {
          scanResult.files.forEach((f: any, index: number) => {
            const fileId = `file_${f.name}_${index}`;
            const categoryName = f.category || 'Uncategorized';

            // Add file
            filesMap.set(fileId, {
              id: fileId,
              name: f.name,
              type: f.type === 'file' ? getTypeForFile(f.name) : (f.type.charAt(0).toUpperCase() + f.type.slice(1)),
              size: formatFileSize(f.size),
              category: categoryName,
              confidence: 100, // Real file exists
              tags: [categoryName.toLowerCase()],
              color: getColorForFile(f.name),
              path: f.path
            });

            // Update Category - RESET count first to avoid accumulation
            if (!categoriesMap.has(categoryName)) {
              console.log('[DataContext] Creating new category:', categoryName);
              categoriesMap.set(categoryName, {
                id: `cat_${categoryName}`,
                name: categoryName,
                fileCount: 1,
                color: getColorForFile(f.name),
                icon: '📁',
                lastModified: new Date(f.modified * 1000).toLocaleTimeString()
              });
            } else {
              const cat = categoriesMap.get(categoryName)!;
              cat.fileCount += 1;
            }
          });
        }
      }

      setFiles(Array.from(filesMap.values()));
      setCategories(Array.from(categoriesMap.values()));

    } catch (error) {
      console.error('Failed to load data:', error);
      // Don't wipe everything on error, maybe just stop loading
    } finally {
      setLoading(false);
    }
  };

  const addCategory = (name: string, color: string, icon: string = '📁') => {
    const newCategory: Category = {
      id: `cat_${Date.now()}`,
      name,
      fileCount: 0,
      color,
      icon,
      lastModified: 'just now',
    };
    setCategories([...categories, newCategory]);
  };

  const updateCategory = (id: string, name: string, color: string, icon: string) => {
    setCategories(
      categories.map(cat =>
        cat.id === id ? { ...cat, name, color, icon, lastModified: 'just now' } : cat
      )
    );
  };

  const deleteCategory = (id: string) => {
    setCategories(categories.filter(cat => cat.id !== id));
  };

  const stats = {
    totalFiles: files.length,
    totalCategories: categories.length,
    avgConfidence: files.length > 0
      ? Math.round(files.reduce((sum, f) => sum + f.confidence, 0) / files.length)
      : 0,
  };

  // Refresh data on mount and periodically
  useEffect(() => {
    refreshData();
    // Increase interval to 30 seconds to reduce redundant scans
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

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
