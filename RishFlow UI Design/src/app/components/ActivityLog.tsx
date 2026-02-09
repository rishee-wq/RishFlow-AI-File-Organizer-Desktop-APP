import React, { useState } from 'react';
import {
  ArrowRight,
  Undo2,
  FileText,
  Image,
  FileSpreadsheet,
  Music,
  Video,
  Calendar,
  Filter,
  File
} from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle } from './Card';
import { Button } from './Button';
import { Badge } from './Badge';
import { ProgressBar } from './ProgressBar';
import { useData } from '@/app/contexts/DataContext';
import { pythonAPI } from '@/api/pywebview';

export function ActivityLog() {
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const { activities, stats, refreshData } = useData();

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

  // Group activity by date
  const groupedActivities = activities.reduce((acc: Record<string, any[]>, activity: any) => {
    if (!acc[activity.date]) {
      acc[activity.date] = [];
    }
    acc[activity.date].push(activity);
    return acc;
  }, {} as Record<string, any[]>);

  const totalActivities = activities.length;
  const todayActivities = activities.filter((a: any) => a.date === new Date().toLocaleDateString()).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl mb-2 text-foreground">Activity Logs</h1>
          <p className="text-muted-foreground">
            Track all file organization actions and their history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button variant="secondary">
            <Calendar className="w-4 h-4 mr-2" />
            Date Range
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Actions', value: totalActivities.toString(), change: '+0%' },
          { label: 'Today', value: todayActivities.toString(), change: '+0%' },
          { label: 'This Week', value: activities.length.toString(), change: '+0%' },
          { label: 'Accuracy', value: stats.avgConfidence + '%', change: '0%' },
        ].map((stat, idx) => (
          <Card key={idx}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
                <Badge variant="success" className="text-xs">
                  {stat.change}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="text-center py-12">
              <File className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No activities yet. Start organizing files to see activity logs.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedActivities).map(([date, items]) => (
                <div key={date}>
                  {/* Date Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary" />
                    <h3 className="text-sm font-semibold text-foreground">{date}</h3>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* Activity Items */}
                  <div className="space-y-3 ml-5">
                    {(items as any[]).map((activity: any) => {
                      const Icon = getIconForFile(activity.fileName);

                      return (
                        <div
                          key={activity.id}
                          className="relative pl-6 pb-3 border-l-2 border-border last:border-l-0 last:pb-0"
                        >
                          {/* Timeline Dot */}
                          <div
                            className="absolute left-[-5px] top-2 w-2 h-2 rounded-full border-2 border-background"
                            style={{ backgroundColor: activity.color }}
                          />

                          {/* Content */}
                          <div className="bg-card rounded-lg border border-border p-4 hover:border-primary/30 transition-colors">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                {/* Icon */}
                                <div
                                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: `${activity.color}15` }}
                                >
                                  <Icon className="w-5 h-5" style={{ color: activity.color }} />
                                </div>

                                {/* File Info */}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-foreground mb-1 truncate">
                                    {activity.fileName}
                                  </p>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span className="truncate">{activity.fromPath}</span>
                                    <ArrowRight className="w-4 h-4 flex-shrink-0" />
                                    <span className="truncate">{activity.toPath}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Time */}
                              <span className="text-xs text-muted-foreground flex-shrink-0 ml-4">
                                {activity.timestamp}
                              </span>
                            </div>

                            {/* Meta Info */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Badge variant="info">{activity.category}</Badge>
                                <div className="flex items-center gap-2">
                                  <ProgressBar value={activity.confidence} size="sm" className="w-20" />
                                  <span className="text-xs text-muted-foreground">
                                    {activity.confidence}%
                                  </span>
                                </div>
                              </div>

                              {/* Undo Button */}
                              <Button variant="ghost" size="sm">
                                <Undo2 className="w-4 h-4 mr-1" />
                                Undo
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Load More */}
          {activities.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border text-center">
              <Button variant="secondary">
                Load More Activity
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Sticky Undo Button */}
      {activities.length > 0 && (
        <div className="sticky bottom-4 z-20 mx-auto max-w-md shadow-lg rounded-xl overflow-hidden animate-in slide-in-from-bottom-5">
          <Button
            variant="destructive"
            size="lg"
            className="w-full gap-2 shadow-md hover:shadow-lg transition-all"
            onClick={async () => {
              if (confirm('Are you sure you want to undo the last organization action? This will move files back to their original locations.')) {
                try {
                  await pythonAPI.revertLast();
                  await refreshData();
                  // Optional: Show success toast
                } catch (error) {
                  console.error('Undo failed:', error);
                  alert('Failed to undo last action');
                }
              }
            }}
          >
            <Undo2 className="w-5 h-5" />
            Undo Last Action
          </Button>
        </div>
      )}
    </div>
  );
}
