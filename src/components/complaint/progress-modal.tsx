'use client';

import { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileUpload, UploadedFile } from '@/components/shared/file-upload';

interface ProgressModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (progress: { subject: string; date: string; details: string; fileUrls?: string[] }) => void;
}

export function ProgressModal({ open, onClose, onSubmit }: ProgressModalProps) {
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [details, setDetails] = useState('');
  const [posting, setPosting] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const handleSubmit = async () => {
    if (!subject.trim()) {
      toast.error('Subject is required.');
      return;
    }
    if (!date) {
      toast.error('Date is required.');
      return;
    }
    if (!details.trim()) {
      toast.error('Details are required.');
      return;
    }

    // Don't submit while files are still uploading
    const hasUploadingOrPending = files.some(f => f.status === 'uploading' || f.status === 'pending');
    if (hasUploadingOrPending) {
      toast.error('Please wait for file uploads to complete.');
      return;
    }

    // Warn about failed uploads but allow submission
    const failedFiles = files.filter(f => f.status === 'error');
    if (failedFiles.length > 0) {
      toast.warning(`${failedFiles.length} file(s) failed to upload. Progress will be saved without them.`);
    }

    setPosting(true);
    try {
      const fileUrls: string[] = files.filter(f => f.status === 'uploaded' && f.url).map(f => f.url!);
      await onSubmit({ subject, date, details, fileUrls: fileUrls.length > 0 ? fileUrls : undefined });
      setSubject('');
      setDate(new Date().toISOString().split('T')[0]);
      setDetails('');
      setFiles([]);
      onClose();
    } catch {
      toast.error('Failed to add progress.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="text-lg font-bold">Add Progress Update</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 pb-4 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Subject <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Progress subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Date <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Details <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Describe the progress update..."
              rows={5}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>

          <FileUpload
            files={files}
            onFilesChange={setFiles}
            acceptedTypes=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            maxFileSize={10 * 1024 * 1024}
            label="Attachments"
            hint="PDF, DOC, DOCX, JPG, PNG (max 10MB each)"
          />
        </div>

        {/* Sticky footer buttons */}
        <div className="flex gap-3 px-6 py-4 border-t border-border/40 shrink-0">
          <Button
            onClick={handleSubmit}
            disabled={posting || files.some(f => f.status === 'uploading' || f.status === 'pending')}
            className="bg-umak-gold text-umak-navy hover:bg-umak-gold-hover font-semibold"
          >
            {posting ? 'Posting...' : 'POST'}
          </Button>
          <Button
            variant="outline"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={onClose}
          >
            <X className="size-4 mr-1" />
            CANCEL
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
