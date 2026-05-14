'use client';

import { useEffect, useState, useCallback } from 'react';
import { LayoutTemplate, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface CmsContentItem {
  id: string;
  key: string;
  label: string;
  value: string;
}

const landingFields = [
  { key: 'hero_title', label: 'Hero Title', placeholder: 'Welcome to iCSFD+' },
  { key: 'hero_subtitle', label: 'Hero Subtitle', placeholder: 'Your partner in student conduct and discipline' },
  { key: 'hero_cta_text', label: 'Hero CTA Button Text', placeholder: 'Get Started' },
  { key: 'tagline', label: 'Tagline', placeholder: 'Integrity. Compassion. Service. Fairness. Dignity.' },
];

export default function LandingContentPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchContent = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cms');
      if (res.ok) {
        const json = await res.json();
        const map: Record<string, string> = {};
        json.data.forEach((item: CmsContentItem) => {
          map[item.key] = item.value;
        });
        setValues(map);
      }
    } catch {
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const items = landingFields.map(f => ({
        key: f.key,
        label: f.label,
        value: values[f.key] || '',
      }));

      const res = await fetch('/api/cms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (!res.ok) throw new Error('Failed to save');
      toast.success('Landing page content saved');
    } catch {
      toast.error('Failed to save content');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-blue-500/15 dark:bg-blue-500/20 flex items-center justify-center">
          <LayoutTemplate className="size-5 text-blue-500 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">LANDING PAGE CONTENT</h1>
          <p className="text-sm text-muted-foreground">Edit hero text and taglines</p>
        </div>
      </div>

      <Card className="glass border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-bold tracking-wider">HERO & TAGLINE</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : (
            landingFields.map(field => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                {field.key === 'hero_subtitle' || field.key === 'tagline' ? (
                  <Textarea
                    id={field.key}
                    value={values[field.key] || ''}
                    onChange={e => setValues({ ...values, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    rows={2}
                  />
                ) : (
                  <Input
                    id={field.key}
                    value={values[field.key] || ''}
                    onChange={e => setValues({ ...values, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                  />
                )}
              </div>
            ))
          )}
          <div className="flex justify-end pt-4 border-t border-border">
            <Button onClick={handleSave} disabled={saving} className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy gap-2">
              <Save className="size-4" />
              {saving ? 'Saving...' : 'Save Content'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
