'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, X, FileText, ImageIcon, Film, Music, Loader2, Download, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { getServeFileUrl, openFileUrl } from '@/lib/file-url';

export interface UploadedFile {
  name: string;
  size: number;
  type: string;
  url?: string; // server URL after upload
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string;
}

interface FileUploadProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  acceptedTypes?: string;
  maxFileSize?: number;
  maxFiles?: number;
  required?: boolean;
  label?: string;
  hint?: string;
  error?: string;
  multiple?: boolean;
}

// Allowed file extensions for client-side validation AFTER selection
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.txt', '.rtf'];

function isAllowedFile(fileName: string): boolean {
  const ext = '.' + fileName.split('.').pop()?.toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <ImageIcon className="size-4 text-blue-500" />;
  if (type.startsWith('video/')) return <Film className="size-4 text-purple-500" />;
  if (type.startsWith('audio/')) return <Music className="size-4 text-pink-500" />;
  return <FileText className="size-4 text-amber-500" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function FileUpload({
  files,
  onFilesChange,
  acceptedTypes = '.pdf,.doc,.docx,.jpg,.jpeg,.png',
  maxFileSize = 10 * 1024 * 1024,
  maxFiles = 10,
  required = false,
  label = 'Supporting Documents',
  hint,
  error,
  multiple = true,
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use refs to always have the latest values without stale closure issues
  const filesRef = useRef<UploadedFile[]>(files);
  const onFilesChangeRef = useRef(onFilesChange);
  const maxFileSizeRef = useRef(maxFileSize);

  // Keep refs in sync with props
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    onFilesChangeRef.current = onFilesChange;
  }, [onFilesChange]);

  useEffect(() => {
    maxFileSizeRef.current = maxFileSize;
  }, [maxFileSize]);

  // Stable upload function that uses refs to avoid stale closures
  const uploadFile = useCallback(async (file: File, index: number) => {
    // Update status to uploading
    const currentFiles = [...filesRef.current];
    if (index < currentFiles.length) {
      currentFiles[index] = { ...currentFiles[index], status: 'uploading' as const };
    }
    filesRef.current = currentFiles;
    onFilesChangeRef.current(currentFiles);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const done = [...filesRef.current];
        if (index < done.length) {
          done[index] = { ...done[index], status: 'uploaded' as const, url: data.url };
        }
        filesRef.current = done;
        onFilesChangeRef.current(done);
      } else {
        let errorMsg = 'Upload failed';
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch {
          // Response body not JSON
        }
        const failed = [...filesRef.current];
        if (index < failed.length) {
          failed[index] = { ...failed[index], status: 'error' as const, error: errorMsg };
        }
        filesRef.current = failed;
        onFilesChangeRef.current(failed);
      }
    } catch {
      const errored = [...filesRef.current];
      if (index < errored.length) {
        errored[index] = { ...errored[index], status: 'error' as const, error: 'Network error' };
      }
      filesRef.current = errored;
      onFilesChangeRef.current(errored);
    }
  }, []); // No dependencies — uses refs for all mutable values

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const currentFiles = filesRef.current;
    const currentMaxFileSize = maxFileSizeRef.current;
    const remainingSlots = Math.max(0, maxFiles - currentFiles.length);
    if (remainingSlots === 0) return;

    // Build new file entries and track which original File objects to upload
    const newEntries: UploadedFile[] = [];
    const filesToUpload: { file: File; targetIndex: number }[] = [];

    for (let i = 0; i < Math.min(fileList.length, remainingSlots); i++) {
      const file = fileList[i];
      const targetIndex = currentFiles.length + newEntries.length;

      if (!isAllowedFile(file.name)) {
        newEntries.push({
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'error',
          error: `File type not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
        });
      } else if (file.size > currentMaxFileSize) {
        newEntries.push({
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'error',
          error: `File exceeds ${formatFileSize(currentMaxFileSize)} limit`,
        });
      } else {
        newEntries.push({
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'pending',
        });
        filesToUpload.push({ file, targetIndex });
      }
    }

    const updatedFiles = [...currentFiles, ...newEntries];
    filesRef.current = updatedFiles;
    onFilesChangeRef.current(updatedFiles);

    // Upload each valid file
    for (const { file, targetIndex } of filesToUpload) {
      uploadFile(file, targetIndex);
    }

    // Reset input so the same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [maxFiles, uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    const currentFiles = filesRef.current;
    const currentMaxFileSize = maxFileSizeRef.current;
    const remainingSlots = Math.max(0, maxFiles - currentFiles.length);
    if (remainingSlots === 0) return;

    const filesToProcess = droppedFiles.slice(0, remainingSlots);
    const newEntries: UploadedFile[] = [];
    const filesToUpload: { file: File; targetIndex: number }[] = [];

    filesToProcess.forEach((file) => {
      const targetIndex = currentFiles.length + newEntries.length;

      if (!isAllowedFile(file.name)) {
        newEntries.push({
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'error',
          error: `File type not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
        });
      } else if (file.size > currentMaxFileSize) {
        newEntries.push({
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'error',
          error: `File exceeds ${formatFileSize(currentMaxFileSize)} limit`,
        });
      } else {
        newEntries.push({
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'pending',
        });
        filesToUpload.push({ file, targetIndex });
      }
    });

    const updatedFiles = [...currentFiles, ...newEntries];
    filesRef.current = updatedFiles;
    onFilesChangeRef.current(updatedFiles);

    // Upload each valid file
    for (const { file, targetIndex } of filesToUpload) {
      uploadFile(file, targetIndex);
    }
  }, [maxFiles, uploadFile]);

  const removeFile = useCallback((index: number) => {
    const updated = filesRef.current.filter((_, i) => i !== index);
    filesRef.current = updated;
    onFilesChangeRef.current(updated);
  }, []);

  const hasUploading = files.some(f => f.status === 'uploading');
  const uploadedCount = files.filter(f => f.status === 'uploaded').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <div className="space-y-2">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>

      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50'
        } ${hasUploading ? 'opacity-80 pointer-events-none' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !hasUploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !hasUploading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label="Click to upload files or drag and drop"
      >
        {hasUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="size-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Uploading files...</p>
          </div>
        ) : (
          <>
            <Upload className="size-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              {hint || `PDF, DOC, DOCX, JPG, PNG (max ${formatFileSize(maxFileSize)} each)`}
            </p>
          </>
        )}
        {/* Visually hidden file input - triggered by drop zone click */}
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes}
          onChange={handleFileChange}
          className="sr-only"
          disabled={hasUploading}
          tabIndex={-1}
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2 mt-3 max-h-40 overflow-y-auto">
          {files.map((file, idx) => (
            <div
              key={`${file.name}-${file.size}-${idx}`}
              className={`flex items-center justify-between p-2 rounded-md border ${
                file.status === 'error'
                  ? 'bg-destructive/5 border-destructive/20'
                  : file.status === 'uploaded'
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/30'
                  : 'bg-muted/50 border-border/40'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {file.status === 'uploading' ? (
                  <Loader2 className="size-4 text-primary animate-spin shrink-0" />
                ) : file.status === 'uploaded' ? (
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                ) : file.status === 'error' ? (
                  <X className="size-4 text-destructive shrink-0" />
                ) : (
                  getFileIcon(file.type)
                )}
                <span className="text-sm truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  ({formatFileSize(file.size)})
                </span>
                {file.status === 'uploading' && (
                  <span className="text-xs text-primary shrink-0 ml-1">
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="size-3 animate-spin" />
                      Uploading...
                    </span>
                  </span>
                )}
                {file.status === 'uploaded' && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 shrink-0 ml-1">
                    Uploaded
                  </span>
                )}
                {file.status === 'error' && (
                  <span className="text-xs text-destructive shrink-0 ml-1">
                    {file.error || 'Upload failed'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {file.status === 'uploaded' && file.url && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-primary hover:bg-primary/10"
                    onClick={() => openFileUrl(file.url)}
                    aria-label={`Download ${file.name}`}
                    title="Download file"
                    type="button"
                  >
                    <Download className="size-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-destructive hover:bg-destructive/10"
                  onClick={() => removeFile(idx)}
                  aria-label={`Remove ${file.name}`}
                  type="button"
                >
                  <X className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {files.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{files.length}/{maxFiles} files</span>
          {uploadedCount > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400">
              {uploadedCount} uploaded
            </span>
          )}
          {hasUploading && (
            <span className="text-primary">
              Uploading...
            </span>
          )}
          {errorCount > 0 && (
            <span className="text-destructive">
              {errorCount} failed
            </span>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
