'use client';

import { useEffect, useState, useCallback } from 'react';
import { Settings, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface CmsContentItem {
  id: string;
  key: string;
  label: string;
  value: string;
}

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const settingsConfig = [
    { key: 'system_name', label: 'System Name', placeholder: 'iCSFD+' },
    { key: 'logo_url', label: 'Logo URL', placeholder: 'https://example.com/logo.png' },
    { key: 'contact_email', label: 'Contact Email', placeholder: 'csfd@umak.edu.ph' },
    { key: 'contact_phone', label: 'Contact Phone', placeholder: '+63 2 8888 0000' },
    { key: 'address', label: 'Address', placeholder: 'University of Makati, Makati City' },
  ];

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cms');
      if (res.ok) {
        const json = await res.json();
        const settingsMap: Record<string, string> = {};
        const labelsMap: Record<string, string> = {};
        json.data.forEach((item: CmsContentItem) => {
          settingsMap[item.key] = item.value;
          labelsMap[item.key] = item.label;
        });
        setSettings(settingsMap);
        setLabels(labelsMap);
      }
    } catch (err) {
      // Failed to fetch settings
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const items = settingsConfig.map(cfg => ({
        key: cfg.key,
        label: labels[cfg.key] || cfg.label,
        value: settings[cfg.key] || '',
      }));

      const res = await fetch('/api/cms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (!res.ok) throw new Error('Failed to save settings');
      toast.success('System settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-gray-500/15 dark:bg-gray-500/20 flex items-center justify-center">
          <Settings className="size-5 text-gray-500 dark:text-gray-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SYSTEM SETTINGS</h1>
          <p className="text-sm text-muted-foreground">Configure system name, logo, and contact information</p>
        </div>
      </div>

      {/* Settings Form */}
      <Card className="glass border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-bold tracking-wider">GENERAL SETTINGS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : (
            settingsConfig.map((cfg) => (
              <div key={cfg.key} className="space-y-2">
                <Label htmlFor={cfg.key}>{labels[cfg.key] || cfg.label}</Label>
                <Input
                  id={cfg.key}
                  value={settings[cfg.key] || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, [cfg.key]: e.target.value })
                  }
                  placeholder={cfg.placeholder}
                />
              </div>
            ))
          )}

          <div className="flex justify-end pt-4 border-t border-border">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy gap-2"
            >
              <Save className="size-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
