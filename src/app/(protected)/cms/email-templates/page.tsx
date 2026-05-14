'use client';

import { useEffect, useState, useCallback } from 'react';
import { Mail, Pencil, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface EmailTemplateItem {
  id: string;
  eventType: string;
  subject: string;
  bodyHtml: string;
  variables: string | null;
  updatedAt: string;
}

const AVAILABLE_VARIABLES = [
  '{{requestor_name}}',
  '{{request_number}}',
  '{{status}}',
  '{{remarks}}',
  '{{tracking_link}}',
];

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplateItem | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);

  // Preview
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cms/email-templates');
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.data || []);
      }
    } catch (err) {
      // Failed to fetch email templates
      toast.error('Failed to load email templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleEdit = (template: EmailTemplateItem) => {
    setEditingTemplate(template);
    setEditSubject(template.subject);
    setEditBody(template.bodyHtml);
  };

  const handleSave = async () => {
    if (!editingTemplate) return;
    if (!editSubject.trim() || !editBody.trim()) {
      toast.error('Subject and body are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/cms/email-templates/${editingTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: editSubject, bodyHtml: editBody }),
      });
      if (!res.ok) throw new Error('Failed to update template');
      toast.success('Email template updated successfully');
      setEditingTemplate(null);
      fetchTemplates();
    } catch {
      toast.error('Failed to update email template');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = (template: EmailTemplateItem) => {
    let preview = template.bodyHtml;
    AVAILABLE_VARIABLES.forEach(v => {
      const varName = v.replace('{{', '').replace('}}', '');
      preview = preview.replaceAll(v, `<span class="bg-umak-gold/20 text-umak-gold px-1 rounded font-mono text-sm">[${varName}]</span>`);
    });
    setPreviewContent(preview);
    setShowPreview(true);
  };

  const eventTypeLabel = (eventType: string) => {
    return eventType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-pink-500/15 dark:bg-pink-500/20 flex items-center justify-center">
          <Mail className="size-5 text-pink-500 dark:text-pink-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">EMAIL TEMPLATES</h1>
          <p className="text-sm text-muted-foreground">Manage notification email templates</p>
        </div>
      </div>

      {/* Templates List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card className="glass border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <Mail className="size-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No email templates found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <Card key={template.id} className="glass border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-umak-gold/15 text-umak-gold border-umak-gold/30">
                      {eventTypeLabel(template.eventType)}
                    </Badge>
                    <CardTitle className="text-sm font-semibold">{template.subject}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => handlePreview(template)}
                    >
                      <Eye className="size-3.5" />
                      Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => handleEdit(template)}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                  {template.bodyHtml.replace(/<[^>]*>/g, '').slice(0, 200)}...
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_VARIABLES.map(v => (
                    <Badge key={v} variant="outline" className="text-[10px] font-mono">
                      {v}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-5 text-pink-500" />
              Edit Email Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Event Type</Label>
              <Input
                value={editingTemplate ? eventTypeLabel(editingTemplate.eventType) : ''}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                placeholder="Email subject line"
              />
            </div>
            <div className="space-y-2">
              <Label>Body HTML *</Label>
              <Textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                placeholder="Email body (HTML supported)"
                rows={12}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Available Variables</Label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_VARIABLES.map(v => (
                  <Button
                    key={v}
                    variant="outline"
                    size="sm"
                    className="text-xs font-mono h-7"
                    onClick={() => setEditBody(editBody + v)}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy"
            >
              {saving ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="size-5 text-blue-500" />
              Email Preview
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div
              className="border rounded-lg p-4 bg-white text-sm min-h-[200px] prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: previewContent }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
