import React, { useState } from 'react';
import { X, FileText, CheckCircle, XCircle, Edit2, Sparkles } from 'lucide-react';
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
  };
  onClose: () => void;
  onApprove: () => void;
  onChange: () => void;
}

export function FilePreviewPanel({ file, onClose, onApprove, onChange }: FilePreviewPanelProps) {
  const [suggestedName, setSuggestedName] = useState(file.name);
  const [suggestedFolder, setSuggestedFolder] = useState(`/Documents/${file.category}`);

  const Icon = file.icon;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">File Details</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* File Icon & Basic Info */}
        <div className="flex items-start gap-4">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${file.color}15` }}
          >
            <Icon className="w-8 h-8" style={{ color: file.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate mb-1">{file.name}</p>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="default">{file.type}</Badge>
              <span className="text-xs text-muted-foreground">{file.size}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {file.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Preview Window */}
        <div>
          <h3 className="text-sm font-medium mb-3 text-foreground">Preview</h3>
          <div className="aspect-video bg-muted/30 rounded-lg border border-border flex items-center justify-center">
            <FileText className="w-12 h-12 text-muted-foreground" />
          </div>
        </div>

        {/* AI Reasoning */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">AI Analysis</h3>
          </div>
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-sm text-foreground leading-relaxed">
              This file appears to be a <strong>{file.type.toLowerCase()}</strong> document
              related to <strong>{file.category.toLowerCase()}</strong>. The content
              analysis shows high relevance to financial reporting and business operations.
              The suggested categorization has a confidence score of{' '}
              <strong>{file.confidence}%</strong>.
            </p>
          </div>
        </div>

        {/* Confidence Score */}
        <div>
          <h3 className="text-sm font-medium mb-3 text-foreground">Confidence Score</h3>
          <ProgressBar value={file.confidence} showLabel size="lg" />
          <p className="text-xs text-muted-foreground mt-2">
            {file.confidence >= 90
              ? 'Very high confidence - highly recommended'
              : file.confidence >= 70
              ? 'Good confidence - recommended'
              : 'Moderate confidence - review suggested'}
          </p>
        </div>

        {/* Suggested Rename */}
        <div>
          <label className="text-sm font-medium mb-3 block text-foreground flex items-center gap-2">
            <Edit2 className="w-4 h-4" />
            Suggested Rename
          </label>
          <Input
            value={suggestedName}
            onChange={(e) => setSuggestedName(e.target.value)}
            placeholder="Enter new file name"
          />
        </div>

        {/* Suggested Folder */}
        <div>
          <label className="text-sm font-medium mb-3 block text-foreground">
            Destination Folder
          </label>
          <Input
            value={suggestedFolder}
            onChange={(e) => setSuggestedFolder(e.target.value)}
            placeholder="Enter folder path"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Category: <strong>{file.category}</strong>
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 border-t border-border space-y-3">
        <Button onClick={onApprove} className="w-full" size="lg">
          <CheckCircle className="w-5 h-5 mr-2" />
          Approve & Organize
        </Button>
        <Button onClick={onChange} variant="secondary" className="w-full">
          <XCircle className="w-5 h-5 mr-2" />
          Change Category
        </Button>
      </div>
    </div>
  );
}
