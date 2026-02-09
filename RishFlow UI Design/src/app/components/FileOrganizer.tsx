import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileText,
  Image,
  FileSpreadsheet,
  Music,
  Video,
  File,
  Filter,
  ArrowUpDown,
  CheckSquare,
  Square,
  Eye,
  Trash2,
  Loader,
  FolderOpen,
  ArrowRight,
  FolderPlus,
  X,
  CheckCircle,
  AlertCircle,
  HardDrive
} from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle } from './Card';
import { Button } from './Button';
import { Badge } from './Badge';
import { Tag } from './Tag';
import { ProgressBar } from './ProgressBar';
import { pythonAPI } from '@/api/pywebview';
import { useData } from '@/app/contexts/DataContext';
import { FileGrid, FileItem } from './FileGrid';

interface FileOrganizerProps {
  onPreviewFile: (file: FileItem) => void;
}

export function FileOrganizer({ onPreviewFile }: FileOrganizerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourceFolder, setSourceFolder] = useState<string | null>(null);
  const [destFolder, setDestFolder] = useState<string | null>(null);
  const [selectedSortMode, setSelectedSortMode] = useState('File Extension');
  const [folderStats, setFolderStats] = useState<{ source: any; dest: any }>({ source: null, dest: null });
  const [organizationStarted, setOrganizationStarted] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const { selectedSourceFolder, setSelectedSourceFolder, selectedDestFolder, setSelectedDestFolder, categories, refreshData } = useData();

  // Sync local state with global state on mount
  useEffect(() => {
    if (selectedSourceFolder && !sourceFolder) {
      setSourceFolder(selectedSourceFolder);
      // fetch stats...
      pythonAPI.getFolderStats(selectedSourceFolder).then(stats => {
        setFolderStats(prev => ({ ...prev, source: stats }));
      });
      // scan files...
      pythonAPI.scanSource(selectedSourceFolder).then(result => {
        if (result.files && Array.isArray(result.files)) {
          const scannedFiles: FileItem[] = result.files.map((f: any, idx: number) => ({
            id: `file_${idx}_${Date.now()}`,
            name: f.name,
            type: getTypeForFile(f.name),
            size: formatFileSize(f.size || 0),
            category: 'Uncategorized',
            confidence: 75,
            tags: [getTypeForFile(f.name).toLowerCase()],
            icon: getIconForFile(f.name),
            color: getColorForFile(f.name),
            path: f.path,
          }));
          setFiles(scannedFiles);
        }
      });
    }
    if (selectedDestFolder && !destFolder) {
      setDestFolder(selectedDestFolder);
      pythonAPI.getFolderStats(selectedDestFolder).then(stats => {
        setFolderStats(prev => ({ ...prev, dest: stats }));
      });
    }
  }, [selectedSourceFolder, selectedDestFolder]);

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

  const getIconForFile = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return FileText;
    if (['doc', 'docx', 'txt'].includes(ext)) return FileText;
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext)) return Image;
    if (['xlsx', 'xls', 'csv'].includes(ext)) return FileSpreadsheet;
    if (['mp3', 'wav', 'flac'].includes(ext)) return Music;
    if (['mp4', 'avi', 'mov'].includes(ext)) return Video;
    return File;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + ' ' + sizes[i];
  };

  const handleBrowseFiles = async () => {
    try {
      setLoading(true);
      console.log('Browsing folder...');
      const folder = await pythonAPI.browseFolder('Select Folder to Organize');
      console.log('Selected folder:', folder);

      if (folder && typeof folder === 'string') {
        setSourceFolder(folder);
        setSelectedSourceFolder(folder);

        // Get folder stats
        const stats = await pythonAPI.getFolderStats(folder);
        setFolderStats(prev => ({ ...prev, source: stats }));

        // Scan the folder for files
        const result = await pythonAPI.scanSource(folder);

        if (result.files && Array.isArray(result.files)) {
          const scannedFiles: FileItem[] = result.files.map((f: any, idx: number) => ({
            id: `file_${idx}_${Date.now()}`,
            name: f.name,
            type: getTypeForFile(f.name),
            size: formatFileSize(f.size || 0),
            category: 'Uncategorized',
            confidence: 75,
            tags: [getTypeForFile(f.name).toLowerCase()],
            icon: getIconForFile(f.name),
            color: getColorForFile(f.name),
            path: f.path,
          }));

          setFiles(scannedFiles);
          setSelectedFiles(new Set());
        }
      } else {
        console.warn('Folder selection cancelled or failed', folder);
      }
    } catch (error) {
      console.error('Error browsing folder:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Error selecting folder: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSetDestination = async () => {
    try {
      const folder = await pythonAPI.browseFolder('Select Destination Folder');

      if (folder && typeof folder === 'string') {
        setDestFolder(folder);
        setSelectedDestFolder(folder);
        const stats = await pythonAPI.getFolderStats(folder);
        setFolderStats(prev => ({ ...prev, dest: stats }));
      }
    } catch (error) {
      console.error('Error selecting destination:', error);
      alert('Error selecting destination folder. Please try again.');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Handle file drop
  };

  const toggleFileSelection = (fileId: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(f => f.id)));
    }
  };

  const handleOrganizeNow = async () => {
    if (!sourceFolder) {
      alert('Please select a source folder first');
      return;
    }

    if (!destFolder) {
      alert('Please select a destination folder first');
      return;
    }

    try {
      setLoading(true);
      setOrganizationStarted(true);

      const result = await pythonAPI.startOrganizing(
        sourceFolder,
        destFolder || sourceFolder, // Default to source if no dest
        selectedSortMode,
        categories // Pass user categories for AI matching
      );

      if (result.status === 'organizing') {
        alert('File organization started!');
        setFiles([]);
        setSourceFolder(null);
        setDestFolder(null);
        setSelectedFiles(new Set());
        setOrganizationStarted(false);

        // Refresh data after a delay
        setTimeout(() => {
          refreshData();
        }, 2000);
      }
    } catch (error) {
      console.error('Error organizing files:', error);
      alert('Error organizing files. Please try again.');
      setOrganizationStarted(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl mb-2 text-foreground">Organize Files</h1>
        <p className="text-muted-foreground">
          Select source and destination folders, then let AI automatically sort and categorize your files
        </p>
      </div>

      {/* Folder Selection Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        {/* Source Folder */}
        <Card className={`transition-all border-2 ${sourceFolder ? 'border-green-500/30 bg-green-500/5' : 'border-border hover:border-primary/50'}`}>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-blue-500" />
                  Source Folder
                </label>
                {sourceFolder && (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
              </div>

              {sourceFolder ? (
                <div className="space-y-3">
                  <div className="p-3 bg-muted/50 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Path:</p>
                    <p className="text-sm font-medium text-foreground truncate" title={sourceFolder}>
                      {sourceFolder}
                    </p>
                  </div>

                  {folderStats.source && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-blue-500/10 rounded border border-blue-500/20">
                        <p className="text-muted-foreground">Files</p>
                        <p className="font-semibold text-foreground">{folderStats.source.file_count || files.length}</p>
                      </div>
                      <div className="p-2 bg-purple-500/10 rounded border border-purple-500/20">
                        <p className="text-muted-foreground">Size</p>
                        <p className="font-semibold text-foreground">{folderStats.source.total_size_mb || 'N/A'}</p>
                      </div>
                    </div>
                  )}

                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={handleBrowseFiles}
                    disabled={loading}
                  >
                    Change Folder
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={() => {
                      setSourceFolder(null);
                      setFiles([]);
                      setFolderStats(prev => ({ ...prev, source: null }));
                    }}
                  >
                    <X className="w-3 h-3 mr-2" />
                    Clear
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleBrowseFiles}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Browsing...
                    </>
                  ) : (
                    <>
                      <FolderOpen className="w-4 h-4 mr-2" />
                      Select Source
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Arrow */}
        <div className="flex justify-center mb-0">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>

        {/* Destination Folder */}
        <Card className={`transition-all border-2 ${destFolder ? 'border-purple-500/30 bg-purple-500/5' : 'border-border hover:border-primary/50'}`}>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FolderPlus className="w-4 h-4 text-purple-500" />
                  Destination Folder
                </label>
                {destFolder && (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
              </div>

              {destFolder ? (
                <div className="space-y-3">
                  <div className="p-3 bg-muted/50 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Path:</p>
                    <p className="text-sm font-medium text-foreground truncate" title={destFolder}>
                      {destFolder}
                    </p>
                  </div>

                  {folderStats.dest && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-blue-500/10 rounded border border-blue-500/20">
                        <p className="text-muted-foreground">Files</p>
                        <p className="font-semibold text-foreground">{folderStats.dest.file_count || 0}</p>
                      </div>
                      <div className="p-2 bg-purple-500/10 rounded border border-purple-500/20">
                        <p className="text-muted-foreground">Size</p>
                        <p className="font-semibold text-foreground">{folderStats.dest.total_size_mb || 'N/A'}</p>
                      </div>
                    </div>
                  )}

                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={handleSetDestination}
                  >
                    Change Folder
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={() => {
                      setDestFolder(null);
                      setFolderStats(prev => ({ ...prev, dest: null }));
                    }}
                  >
                    <X className="w-3 h-3 mr-2" />
                    Clear
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleSetDestination}
                  className="w-full"
                  disabled={!sourceFolder}
                >
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Select Destination
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sort Mode Selection and Quick Actions */}
      {sourceFolder && files.length > 0 && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="text-base">Organization Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Organization Strategy</label>
                <select
                  value={selectedSortMode}
                  onChange={(e) => setSelectedSortMode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-input-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option>File Extension</option>
                  <option>File Name</option>
                  <option>Date Modified</option>
                  <option>Size Category</option>
                  <option>AI-based Content</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">Choose how files will be organized</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Files Ready</label>
                <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{files.length} files</span>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File List/Grid */}
      {files.length > 0 && (
        <Card className="mb-20"> {/* Add margin bottom for sticky footer */}
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>Files to Organize ({files.length})</CardTitle>
                {selectedFiles.size > 0 && (
                  <Badge variant="info">{selectedFiles.size} selected</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-muted/50 rounded-lg p-1 mr-2">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Filter className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
                <Button variant="ghost" size="sm">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  Sort
                </Button>
                {selectedFiles.size > 0 && (
                  <>
                    <Button variant="secondary" size="sm">
                      Organize Selected
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <FileGrid
              files={files}
              viewMode={viewMode}
              selectedFiles={selectedFiles}
              onToggleSelection={toggleFileSelection}
              onToggleSelectAll={toggleSelectAll}
              onPreviewFile={onPreviewFile}
            />
          </CardContent>
        </Card>
      )}

      {/* Sticky Organize Button */}
      {files.length > 0 && (
        <div className="sticky bottom-4 z-20 mx-auto max-w-2xl shadow-lg rounded-xl overflow-hidden animate-in slide-in-from-bottom-5">
          <div className="bg-card/90 backdrop-blur-md border border-primary/20 p-4 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">
                {selectedFiles.size > 0
                  ? `${selectedFiles.size} of ${files.length} files selected`
                  : `${files.length} files ready to organize`}
              </p>
              <div className="flex items-center gap-2 text-xs">
                {sourceFolder && destFolder ? (
                  <span className="text-green-500 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Ready to start
                  </span>
                ) : (
                  <span className="text-amber-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Missing details
                  </span>
                )}
              </div>
            </div>

            <Button
              size="lg"
              onClick={handleOrganizeNow}
              disabled={loading || !sourceFolder || !destFolder || organizationStarted}
              className="gap-2 shadow-md hover:shadow-lg transition-all"
            >
              {organizationStarted ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Organizing...
                </>
              ) : loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Organize Now
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
