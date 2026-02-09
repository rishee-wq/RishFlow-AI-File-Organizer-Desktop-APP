import React, { useState } from 'react';
import { Search, FolderTree, Plus, Edit2, Trash2, X, Eye, FileText, Image, FileSpreadsheet, Music, Video, File } from 'lucide-react';
import { Card, CardContent } from './Card';
import { Button } from './Button';
import { useData, Category, FileItem as ContextFileItem } from '@/app/contexts/DataContext';
import { FileGrid, FileItem as GridFileItem } from './FileGrid';

export function CategoriesView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6');
  const [newCategoryIcon, setNewCategoryIcon] = useState('📁');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editIcon, setEditIcon] = useState('');

  // New state for viewing category details
  const [viewingCategory, setViewingCategory] = useState<Category | null>(null);

  const { categories, addCategory, updateCategory, deleteCategory, files } = useData();

  const EMOJI_LIST = ['📁', '📂', '📄', '📝', '📊', '📉', '📷', '🎬', '🎵', '💼', '💰', '🏠', '🎓', '🎁', '🛒', '🎮', '✈️', '🍔', '💪', '❤️', '⭐', '🔥', '💡', '🔒'];

  const filteredCategories = categories.filter((cat: Category) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const getCategoryFiles = (category: Category | null): GridFileItem[] => {
    if (!category) return [];
    return files
      .filter((f: ContextFileItem) => f.category === category.name)
      .map((f: ContextFileItem) => ({
        ...f,
        icon: getIconForFile(f.name)
      }));
  };

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      addCategory(newCategoryName, newCategoryColor, newCategoryIcon);
      setNewCategoryName('');
      setNewCategoryColor('#3b82f6');
      setNewCategoryIcon('📁');
      setShowNewCategory(false);
    }
  };

  const handleUpdateCategory = (id: string) => {
    if (editName.trim()) {
      updateCategory(id, editName, editColor, editIcon);
      setEditingId(null);
      setEditName('');
      setEditColor('');
      setEditIcon('');
    }
  };

  const colors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#06b6d4', '#f43f5e', '#14b8a6',
    '#6366f1', '#a855f7', '#d946ef', '#ea580c'
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl mb-2 text-foreground">Categories</h1>
          <p className="text-muted-foreground">
            Manage and organize your file categories ({categories.length} total)
          </p>
        </div>
        <Button onClick={() => setShowNewCategory(true)}>
          <Plus className="w-5 h-5 mr-2" />
          New Category
        </Button>
      </div>

      {/* New Category Form */}
      {showNewCategory && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create New Category</h3>
              <button onClick={() => setShowNewCategory(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Category Name</label>
                <input
                  type="text"
                  placeholder="e.g., Archive, Backup, etc."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-input-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Icon</label>
                <div className="flex items-center gap-2 flex-wrap p-2 bg-muted/20 rounded-lg">
                  {EMOJI_LIST.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setNewCategoryIcon(emoji)}
                      className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${newCategoryIcon === emoji ? 'bg-primary text-primary-foreground shadow-sm scale-110' : 'hover:bg-muted'
                        }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewCategoryColor(color)}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${newCategoryColor === color ? 'border-foreground scale-110' : 'border-border'
                        }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button onClick={handleAddCategory} className="flex-1">
                  Create Category
                </Button>
                <Button variant="secondary" onClick={() => setShowNewCategory(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & Filter */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
        </div>
      </div>

      {/* Categories Grid */}
      {filteredCategories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCategories.map((category) => (
            <Card key={category.id} hover className="group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: `${category.color}15` }}
                  >
                    {category.icon}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingId(category.id);
                        setEditName(category.name);
                        setEditColor(category.color);
                        setEditIcon(category.icon);
                      }}
                      className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center"
                    >
                      <Edit2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => deleteCategory(category.id)}
                      className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold mb-2 text-foreground">{category.name}</h3>

                <div className="mb-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full text-xs h-8"
                    onClick={() => setViewingCategory(category)}
                  >
                    <Eye className="w-3 h-3 mr-2" />
                    View Files
                  </Button>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FolderTree className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {category.fileCount} files
                    </span>
                  </div>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Updated {category.lastModified}
                </p>

                {/* Progress Bar */}
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Files</span>
                    <span className="text-xs font-medium text-foreground">
                      {category.fileCount}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        backgroundColor: category.color,
                        width: `${Math.min((category.fileCount / 100) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">
              {categories.length === 0 ? 'No categories yet' : 'No categories found'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {categories.length === 0
                ? 'Create a new category to get started'
                : 'Try adjusting your search query'}
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                if (categories.length === 0) {
                  setShowNewCategory(true);
                } else {
                  setSearchQuery('');
                }
              }}
            >
              {categories.length === 0 ? 'Create Category' : 'Clear Search'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Edit Category</h3>
                <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-input-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">Icon</label>
                  <div className="flex items-center gap-2 flex-wrap p-2 bg-muted/20 rounded-lg">
                    {EMOJI_LIST.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => setEditIcon(emoji)}
                        className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${editIcon === emoji ? 'bg-primary text-primary-foreground shadow-sm scale-110' : 'hover:bg-muted'
                          }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">Color</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setEditColor(color)}
                        className={`w-8 h-8 rounded-lg border-2 transition-all ${editColor === color ? 'border-foreground scale-110' : 'border-border'
                          }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button onClick={() => handleUpdateCategory(editingId)} className="flex-1">
                    Save Changes
                  </Button>
                  <Button variant="secondary" onClick={() => setEditingId(null)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category Details Modal */}
      {viewingCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <Card className="w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                  style={{ backgroundColor: `${viewingCategory.color}15` }}
                >
                  {viewingCategory.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{viewingCategory.name}</h3>
                  <p className="text-sm text-muted-foreground">{getCategoryFiles(viewingCategory).length} files sorted</p>
                </div>
              </div>
              <button
                onClick={() => setViewingCategory(null)}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-muted/10">
              {getCategoryFiles(viewingCategory).length > 0 ? (
                <FileGrid
                  files={getCategoryFiles(viewingCategory)}
                  viewMode="list"
                  selectedFiles={new Set()}
                  onToggleSelection={() => { }}
                  onToggleSelectAll={() => { }}
                  onPreviewFile={() => { }}
                  showSelectionControls={false}
                />
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                  <div className="w-16 h-16 rounded-2xl bg-muted/20 flex items-center justify-center mb-4">
                    <FolderTree className="w-8 h-8 opacity-50" />
                  </div>
                  <p>No files found in this category yet.</p>
                  <p className="text-sm opacity-70 mt-1">Files organized into this category will appear here.</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border bg-card flex justify-end">
              <Button onClick={() => setViewingCategory(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
