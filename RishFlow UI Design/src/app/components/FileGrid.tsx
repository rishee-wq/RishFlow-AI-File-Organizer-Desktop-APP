import React from 'react';
import {
    FileText,
    Image,
    FileSpreadsheet,
    Music,
    Video,
    File,
    CheckSquare,
    Square,
    Eye,
    Filter,
} from 'lucide-react';
import { Button } from './Button';
import { Badge } from './Badge';
import { Tag } from './Tag';
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

export function FileGrid({
    files,
    viewMode,
    selectedFiles,
    onToggleSelection,
    onToggleSelectAll,
    onPreviewFile,
    showSelectionControls = true,
}: FileGridProps) {
    if (viewMode === 'list') {
        return (
            <div className="space-y-2">
                {/* Table Header */}
                <div className="mb-2 px-4 py-2 bg-muted/30 rounded-lg">
                    <div className="grid grid-cols-12 gap-4 text-xs font-medium text-muted-foreground">
                        {showSelectionControls && (
                            <div className="col-span-1 flex items-center">
                                <button
                                    onClick={onToggleSelectAll}
                                    className="hover:text-foreground transition-colors"
                                >
                                    {files.length > 0 && selectedFiles.size === files.length ? (
                                        <CheckSquare className="w-4 h-4" />
                                    ) : (
                                        <Square className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        )}
                        <div className={showSelectionControls ? "col-span-4" : "col-span-5"}>File Name</div>
                        <div className="col-span-2">Type</div>
                        <div className="col-span-2">Category</div>
                        <div className="col-span-2">Confidence</div>
                        <div className="col-span-1">Actions</div>
                    </div>
                </div>

                {/* Table Rows */}
                <div className="space-y-2">
                    {files.map((file) => {
                        const Icon = file.icon;
                        const isSelected = selectedFiles.has(file.id);

                        return (
                            <div
                                key={file.id}
                                className={`px-4 py-3 rounded-lg transition-all ${isSelected
                                        ? 'bg-primary/5 border-2 border-primary/30'
                                        : 'bg-card hover:bg-accent/50 border-2 border-transparent'
                                    }`}
                            >
                                <div className="grid grid-cols-12 gap-4 items-center">
                                    {/* Checkbox */}
                                    {showSelectionControls && (
                                        <div className="col-span-1">
                                            <button
                                                onClick={() => onToggleSelection(file.id)}
                                                className="hover:text-primary transition-colors"
                                            >
                                                {isSelected ? (
                                                    <CheckSquare className="w-4 h-4 text-primary" />
                                                ) : (
                                                    <Square className="w-4 h-4 text-muted-foreground" />
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {/* File Name */}
                                    <div className={`${showSelectionControls ? "col-span-4" : "col-span-5"} flex items-center gap-3`}>
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ backgroundColor: `${file.color}15` }}
                                        >
                                            <Icon className="w-5 h-5" style={{ color: file.color }} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate" title={file.name}>
                                                {file.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">{file.size}</p>
                                        </div>
                                    </div>

                                    {/* Type */}
                                    <div className="col-span-2">
                                        <Badge variant="default">{file.type}</Badge>
                                    </div>

                                    {/* Category */}
                                    <div className="col-span-2">
                                        <Badge variant="info">{file.category}</Badge>
                                    </div>

                                    {/* Confidence */}
                                    <div className="col-span-2">
                                        <div className="flex items-center gap-2">
                                            <ProgressBar value={file.confidence} size="sm" />
                                            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                                                {file.confidence}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-1 flex justify-end">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onPreviewFile(file)}
                                            className="p-2"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Tags */}
                                {file.tags.length > 0 && (
                                    <div className={`mt-2 ${showSelectionControls ? "ml-14" : "ml-14"} flex gap-2`}>
                                        {file.tags.map((tag, idx) => (
                                            <Tag key={idx}>{tag}</Tag>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {files.map((file) => {
                const Icon = file.icon;
                const isSelected = selectedFiles.has(file.id);

                return (
                    <div
                        key={file.id}
                        className={`relative group p-4 rounded-xl border-2 transition-all cursor-pointer ${isSelected
                                ? 'bg-primary/5 border-primary shadow-sm'
                                : 'bg-card border-border hover:border-primary/50 hover:shadow-md'
                            }`}
                        onClick={() => showSelectionControls && onToggleSelection(file.id)}
                    >
                        {showSelectionControls && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSelection(file.id);
                                }}
                                className="absolute top-3 left-3 z-10"
                            >
                                {isSelected ? (
                                    <CheckSquare className="w-5 h-5 text-primary bg-background rounded-sm" />
                                ) : (
                                    <Square className="w-5 h-5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                                )}
                            </button>
                        )}

                        <div className="flex flex-col items-center text-center space-y-3 pt-2">
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-200"
                                style={{ backgroundColor: `${file.color}15` }}
                            >
                                <Icon className="w-8 h-8" style={{ color: file.color }} />
                            </div>

                            <div className="w-full">
                                <p className="text-sm font-medium text-foreground truncate w-full" title={file.name}>
                                    {file.name}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">{file.size}</p>
                            </div>

                            <div className="w-full flex justify-center pt-2 border-t border-border/50">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onPreviewFile(file);
                                    }}
                                    className="h-8 text-xs w-full"
                                >
                                    Preview
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
