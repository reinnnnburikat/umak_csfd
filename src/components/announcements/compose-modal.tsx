'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Calendar, Upload, Pencil, Loader2, Download, CheckCircle2, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getServeFileUrl, openFileUrl } from '@/lib/file-url';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AnnouncementData {
  id: string;
  title: string;
  body: string;
  postedFrom: string;
  postedTo: string;
  visibility: string;
  isPinned: boolean;
  fileUrl: string | null;
}

interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  editAnnouncement?: AnnouncementData | null;
}

export function ComposeModal({ open, onClose, onCreated, editAnnouncement }: ComposeModalProps) {
  const isEditing = !!editAnnouncement;

  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [postedFrom, setPostedFrom] = useState(new Date().toISOString().split('T')[0]);
  const [postedTo, setPostedTo] = useState('');
  const [visibility, setVisibility] = useState('All');
  const [isPinned, setIsPinned] = useState(false);
  const [posting, setPosting] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill form when editing
  useEffect(() => {
    if (editAnnouncement) {
      setSubject(editAnnouncement.title);
      setDetails(editAnnouncement.body);
      setPostedFrom(new Date(editAnnouncement.postedFrom).toISOString().split('T')[0]);
      setPostedTo(new Date(editAnnouncement.postedTo).toISOString().split('T')[0]);
      setVisibility(editAnnouncement.visibility);
      setIsPinned(editAnnouncement.isPinned);
      setUploadedFileUrl(editAnnouncement.fileUrl || null);
      setFileName(editAnnouncement.fileUrl ? editAnnouncement.fileUrl.split('/').pop() || null : null);
    } else {
      setSubject('');
      setDetails('');
      setPostedFrom(new Date().toISOString().split('T')[0]);
      setPostedTo('');
      setVisibility('All');
      setIsPinned(false);
      setUploadedFileUrl(null);
      setFileName(null);
    }
  }, [editAnnouncement, open]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max — matching backend limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB.');
      return;
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF, DOC, DOCX, JPG, and PNG files are allowed.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setUploadedFileUrl(data.url);
        setFileName(file.name);
        toast.success('File uploaded successfully.');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to upload file.');
      }
    } catch {
      toast.error('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = () => {
    // Clean up the uploaded file from disk to prevent orphaned files
    if (uploadedFileUrl) {
      fetch('/api/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: uploadedFileUrl }),
      }).catch(() => {
        // Best-effort cleanup — silently ignore failures
      });
    }
    setUploadedFileUrl(null);
    setFileName(null);
  };

  const handleSubmit = async () => {
    if (!subject.trim()) {
      toast.error('Subject is required.');
      return;
    }
    if (!details.trim()) {
      toast.error('Details are required.');
      return;
    }
    if (!postedFrom) {
      toast.error('Posted from date is required.');
      return;
    }
    if (!postedTo) {
      toast.error('Posted to date is required.');
      return;
    }

    setPosting(true);
    try {
      if (isEditing && editAnnouncement) {
        // UPDATE existing announcement
        const res = await fetch(`/api/announcements/${editAnnouncement.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: subject,
            body: details,
            // Send dates with timezone so server interprets correctly
            postedFrom: `${postedFrom}T00:00:00+08:00`,
            postedTo: `${postedTo}T23:59:59+08:00`,
            visibility,
            isPinned,
            fileUrl: uploadedFileUrl,
          }),
        });

        if (res.ok) {
          toast.success('Announcement updated successfully!');
          onCreated();
          onClose();
        } else {
          const data = await res.json();
          toast.error(data.error || 'Failed to update announcement.');
        }
      } else {
        // CREATE new announcement
        const res = await fetch('/api/announcements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: subject,
            body: details,
            // Send dates with timezone so server interprets correctly
            // postedFrom = start of day in PHT (UTC+8), postedTo = end of day in PHT
            postedFrom: `${postedFrom}T00:00:00+08:00`,
            postedTo: `${postedTo}T23:59:59+08:00`,
            visibility,
            isPinned,
            fileUrl: uploadedFileUrl,
          }),
        });

        if (res.ok) {
          toast.success('Announcement posted successfully!');
          onCreated();
          onClose();
        } else {
          const data = await res.json();
          toast.error(data.error || 'Failed to post announcement.');
        }
      }
    } catch {
      toast.error('An error occurred. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const handleClose = () => {
    if (!isEditing) {
      setSubject('');
      setDetails('');
      setPostedFrom(new Date().toISOString().split('T')[0]);
      setPostedTo('');
      setVisibility('All');
      setIsPinned(false);
      setUploadedFileUrl(null);
      setFileName(null);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            {isEditing ? (
              <>
                <Pencil className="size-5 text-umak-gold" />
                Edit Announcement
              </>
            ) : (
              'Compose Announcement'
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 pb-4 overflow-y-auto flex-1 min-h-0 overscroll-contain">
          {/* Subject */}
          <div className="space-y-2">
            <Label>
              Subject <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Announcement subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Details */}
          <div className="space-y-2">
            <Label>
              Details <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Write the announcement details..."
              rows={6}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Posted From <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={postedFrom}
                  onChange={(e) => setPostedFrom(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Posted To <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={postedTo}
                  onChange={(e) => setPostedTo(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Visibility */}
          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Students">Students</SelectItem>
                <SelectItem value="Staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pin Toggle */}
          <div className="flex items-center justify-between">
            <Label>Pin Announcement</Label>
            <Switch
              checked={isPinned}
              onCheckedChange={setIsPinned}
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <Label>Attachments (Optional)</Label>
            {uploadedFileUrl && fileName ? (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/30">
                <div className="flex items-center gap-2 min-w-0">
                  <Paperclip className="size-4 text-emerald-500 shrink-0" />
                  <span className="text-sm truncate font-medium">{fileName}</span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 shrink-0">✓ Uploaded</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary hover:bg-primary/10 h-7"
                    onClick={() => openFileUrl(uploadedFileUrl)}
                    title="View file"
                  >
                    <Download className="size-3.5 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 h-7"
                    onClick={handleRemoveFile}
                  >
                    <X className="size-3.5 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center text-muted-foreground text-sm hover:border-umak-gold/50 hover:bg-umak-gold/5 transition-colors cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={() => !uploading && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    if (fileInputRef.current) {
                      fileInputRef.current.files = dt.files;
                      fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                aria-label="Click to upload file or drag and drop"
              >
                <Upload className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="flex items-center justify-center gap-2">
                  {uploading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Uploading file...
                    </>
                  ) : (
                    'Click to upload or drag & drop'
                  )}
                </p>
                <p className="text-xs mt-1">PDF, DOC, DOCX, JPG, PNG (max 10MB each)</p>
              </div>
            )}
            {/* Hidden file input - triggered programmatically */}
            {/* Note: No accept attribute - validation is done client-side in handleFileUpload */}
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </div>
        </div>

        {/* Sticky footer buttons */}
        <div className="flex gap-3 px-6 py-4 border-t border-border/40 shrink-0">
          <Button
            onClick={handleSubmit}
            disabled={posting || uploading}
            className="bg-umak-gold text-umak-navy hover:bg-umak-gold-hover font-semibold"
          >
            {posting
              ? isEditing ? 'Updating...' : 'Posting...'
              : isEditing ? 'UPDATE' : 'POST'}
          </Button>
          <Button
            variant="outline"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleClose}
          >
            <X className="size-4 mr-1" />
            CANCEL
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
