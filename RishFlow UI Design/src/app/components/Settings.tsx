import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from './Card';
import { Switch } from './Switch';
import { Button } from './Button';
import { Bell, Lock, Database, Zap } from 'lucide-react';
import { pythonAPI } from '../../api/pywebview';
import { useData } from '../contexts/DataContext';

export function Settings() {
  const { selectedDestFolder } = useData();

  // Notification settings
  const [notifyComplete, setNotifyComplete] = useState(true);
  const [notifyAI, setNotifyAI] = useState(true);
  const [notifyWeekly, setNotifyWeekly] = useState(false);
  const [notifyCategory, setNotifyCategory] = useState(true);

  // Privacy settings
  const [twoFactor, setTwoFactor] = useState(true);
  const [shareUsage, setShareUsage] = useState(false);
  const [encryptMeta, setEncryptMeta] = useState(true);

  // AI settings
  const [autoOrganize, setAutoOrganize] = useState(true);
  const [smartTags, setSmartTags] = useState(true);
  const [aggressive, setAggressive] = useState(false);
  const [confidence, setConfidence] = useState(80);

  // Storage
  const [storageUsed, setStorageUsed] = useState('0 B');
  const [storagePercent, setStoragePercent] = useState(0);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    loadStorageStats();
  }, [selectedDestFolder]);

  const loadSettings = async () => {
    try {
      const settings = await pythonAPI.loadState('app_settings');
      if (settings && settings.value) {
        const s = settings.value;
        setNotifyComplete(s.notifyComplete ?? true);
        setNotifyAI(s.notifyAI ?? true);
        setNotifyWeekly(s.notifyWeekly ?? false);
        setNotifyCategory(s.notifyCategory ?? true);
        setTwoFactor(s.twoFactor ?? true);
        setShareUsage(s.shareUsage ?? false);
        setEncryptMeta(s.encryptMeta ?? true);
        setAutoOrganize(s.autoOrganize ?? true);
        setSmartTags(s.smartTags ?? true);
        setAggressive(s.aggressive ?? false);
        setConfidence(s.confidence ?? 80);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async () => {
    const settings = {
      notifyComplete,
      notifyAI,
      notifyWeekly,
      notifyCategory,
      twoFactor,
      shareUsage,
      encryptMeta,
      autoOrganize,
      smartTags,
      aggressive,
      confidence,
    };
    await pythonAPI.saveState('app_settings', settings);
  };

  const loadStorageStats = async () => {
    if (!selectedDestFolder) {
      setStorageUsed('0 B');
      setStoragePercent(0);
      return;
    }

    try {
      const stats = await pythonAPI.getFolderStats(selectedDestFolder);
      if (stats && stats.total_size_mb) {
        setStorageUsed(stats.total_size_mb);
        // Assuming 10 GB max for percentage calculation
        const sizeInGB = parseFloat(stats.total_size_mb.replace(' MB', '')) / 1024;
        const percent = Math.min((sizeInGB / 10) * 100, 100);
        setStoragePercent(Math.round(percent));
      }
    } catch (error) {
      console.error('Failed to load storage stats:', error);
    }
  };

  const handleManageStorage = async () => {
    if (confirm('This will clear all activity logs. Are you sure?')) {
      try {
        const result = await pythonAPI.clearActivityLogs();
        if (result.status === 'cleared') {
          alert(`Cleared ${result.count} activity log entries`);
          // Reload storage stats
          loadStorageStats();
        }
      } catch (error) {
        console.error('Failed to clear logs:', error);
        alert('Failed to clear activity logs');
      }
    }
  };

  // Auto-save when settings change
  useEffect(() => {
    saveSettings();
  }, [
    notifyComplete, notifyAI, notifyWeekly, notifyCategory,
    twoFactor, shareUsage, encryptMeta,
    autoOrganize, smartTags, aggressive, confidence
  ]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl mb-2 text-foreground">Settings</h1>
        <p className="text-muted-foreground">
          Manage your preferences and application settings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <CardTitle>Notifications</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Switch
              checked={notifyComplete}
              onChange={setNotifyComplete}
              label="File organization complete"
            />
            <Switch
              checked={notifyAI}
              onChange={setNotifyAI}
              label="New AI suggestions available"
            />
            <Switch
              checked={notifyWeekly}
              onChange={setNotifyWeekly}
              label="Weekly activity summary"
            />
            <Switch
              checked={notifyCategory}
              onChange={setNotifyCategory}
              label="Category updates"
            />
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              <CardTitle>Privacy & Security</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Switch
              checked={twoFactor}
              onChange={setTwoFactor}
              label="Two-factor authentication"
            />
            <Switch
              checked={shareUsage}
              onChange={setShareUsage}
              label="Share usage data"
            />
            <Switch
              checked={encryptMeta}
              onChange={setEncryptMeta}
              label="Encrypt file metadata"
            />
          </CardContent>
        </Card>

        {/* Storage */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              <CardTitle>Storage</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Storage Used</p>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-semibold text-foreground">{storageUsed}</span>
                <span className="text-sm text-muted-foreground">of organized files</span>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${storagePercent}%` }} />
              </div>
            </div>
            <Button variant="secondary" className="w-full" onClick={handleManageStorage}>
              Clear Activity Logs
            </Button>
          </CardContent>
        </Card>

        {/* AI Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <CardTitle>AI Behavior</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Switch
              checked={autoOrganize}
              onChange={setAutoOrganize}
              label="Auto-organize on upload"
            />
            <Switch
              checked={smartTags}
              onChange={setSmartTags}
              label="Generate smart tags"
            />
            <Switch
              checked={aggressive}
              onChange={setAggressive}
              label="Aggressive categorization"
            />
            <div className="pt-2">
              <label className="block text-sm text-muted-foreground mb-2">
                Minimum confidence threshold
              </label>
              <input
                type="range"
                min="50"
                max="100"
                value={confidence}
                onChange={(e) => setConfidence(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>50%</span>
                <span>{confidence}%</span>
                <span>100%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
