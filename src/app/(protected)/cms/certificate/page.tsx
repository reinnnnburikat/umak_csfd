'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Award, Save, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { getServeFileUrl } from '@/lib/file-url';

interface CertConfig {
  certAcademicYear: string;
  certDirectorName: string;
  certDirectorTitle: string;
  certBackgroundUrl: string;
  certEsignatureUrl: string;
}

export default function CertificateConfigPage() {
  const [config, setConfig] = useState<CertConfig>({
    certAcademicYear: '2025-2026',
    certDirectorName: 'Assoc. Prof. POMPEYO C. ADAMOS III, M.A',
    certDirectorTitle: 'Director, Center for Student Formation and Discipline',
    certBackgroundUrl: '',
    certEsignatureUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/certificate-config');
      if (res.ok) {
        const json = await res.json();
        setConfig(json.data);
      }
    } catch (err) {
      // Failed to fetch certificate config
      toast.error('Failed to load certificate configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/certificate-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certAcademicYear: config.certAcademicYear,
          certDirectorName: config.certDirectorName,
          certDirectorTitle: config.certDirectorTitle,
        }),
      });

      if (!res.ok) throw new Error('Failed to save certificate configuration');
      toast.success('Certificate configuration saved successfully');
    } catch {
      toast.error('Failed to save certificate configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (file: File, type: 'background' | 'esignature') => {
    const setUploading = type === 'background' ? setUploadingBg : setUploadingSig;

    setUploading(true);
    let uploadedUrl: string | null = null;
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      const data = await res.json();
      const url = data.url;
      uploadedUrl = url;

      // Update config
      const updatePayload: Record<string, string> = {};
      if (type === 'background') {
        updatePayload.certBackgroundUrl = url;
        setConfig(prev => ({ ...prev, certBackgroundUrl: url }));
      } else {
        updatePayload.certEsignatureUrl = url;
        setConfig(prev => ({ ...prev, certEsignatureUrl: url }));
      }

      // Also save the URL to CmsContent
      const saveRes = await fetch('/api/certificate-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      if (!saveRes.ok) {
        // Step 2 failed: attempt to clean up the orphaned uploaded file
        if (uploadedUrl) {
          fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: uploadedUrl }),
          }).catch(() => {
            // Best-effort cleanup — silently ignore failures
          });
        }
        throw new Error('Failed to save uploaded file URL');
      }
      uploadedUrl = null; // Ownership transferred — no cleanup needed
      toast.success(`${type === 'background' ? 'Background image' : 'E-signature'} uploaded successfully`);
    } catch {
      toast.error(`Failed to upload ${type === 'background' ? 'background image' : 'e-signature'}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-amber-500/15 dark:bg-amber-500/20 flex items-center justify-center">
          <Award className="size-5 text-amber-500 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CERTIFICATE CONFIGURATION</h1>
          <p className="text-sm text-muted-foreground">Manage Good Moral Certificate settings and templates</p>
        </div>
      </div>

      {/* Certificate Settings */}
      <Card className="glass border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-bold tracking-wider">CERTIFICATE DETAILS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="certAcademicYear">Academic Year</Label>
                <Input
                  id="certAcademicYear"
                  value={config.certAcademicYear}
                  onChange={(e) => setConfig({ ...config, certAcademicYear: e.target.value })}
                  placeholder="e.g., 2025-2026"
                />
                <p className="text-xs text-muted-foreground">Displayed on certificates for currently enrolled students.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="certDirectorName">Director Name</Label>
                <Input
                  id="certDirectorName"
                  value={config.certDirectorName}
                  onChange={(e) => setConfig({ ...config, certDirectorName: e.target.value })}
                  placeholder="e.g., Assoc. Prof. POMPEYO C. ADAMOS III, M.A"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="certDirectorTitle">Director Title</Label>
                <Input
                  id="certDirectorTitle"
                  value={config.certDirectorTitle}
                  onChange={(e) => setConfig({ ...config, certDirectorTitle: e.target.value })}
                  placeholder="e.g., Director, Center for Student Formation and Discipline"
                />
              </div>
            </>
          )}

          <div className="flex justify-end pt-4 border-t border-border">
            <Button
              onClick={handleSave}
              disabled={saving || loading}
              className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy gap-2"
            >
              <Save className="size-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Image Uploads */}
      <Card className="glass border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-bold tracking-wider">CERTIFICATE IMAGES</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Background Image */}
          <div className="space-y-3">
            <Label>Certificate Background Image</Label>
            <p className="text-xs text-muted-foreground">
              A4-sized background image for the certificate. Replaces /public/certificates/GMC_BACKGROUND.png
            </p>
            {config.certBackgroundUrl && (
              <div className="rounded-lg border border-border overflow-hidden max-w-xs">
                <img
                  src={getServeFileUrl(config.certBackgroundUrl) ?? config.certBackgroundUrl}
                  alt="Certificate Background"
                  className="w-full h-auto object-cover"
                />
              </div>
            )}
            <div>
              <input
                ref={bgInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, 'background');
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => bgInputRef.current?.click()}
                disabled={uploadingBg}
                className="gap-2"
              >
                <Upload className="size-4" />
                {uploadingBg ? 'Uploading...' : 'Upload Background'}
              </Button>
            </div>
          </div>

          {/* E-Signature */}
          <div className="space-y-3">
            <Label>Director E-Signature</Label>
            <p className="text-xs text-muted-foreground">
              E-signature image used when e-sign preference is selected. Replaces /public/certificates/DIRECTOR_E-SIGN.png
            </p>
            {config.certEsignatureUrl && (
              <div className="rounded-lg border border-border overflow-hidden max-w-xs bg-white p-2">
                <img
                  src={getServeFileUrl(config.certEsignatureUrl) ?? config.certEsignatureUrl}
                  alt="Director E-Signature"
                  className="w-full h-auto object-contain"
                />
              </div>
            )}
            <div>
              <input
                ref={sigInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, 'esignature');
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => sigInputRef.current?.click()}
                disabled={uploadingSig}
                className="gap-2"
              >
                <Upload className="size-4" />
                {uploadingSig ? 'Uploading...' : 'Upload E-Signature'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
