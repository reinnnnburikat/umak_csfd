'use client';

import { useRef, useCallback } from 'react';
import { Download, FileText, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TrackableCardProps {
  requestNumber: string;
  trackingToken: string;
  type: 'service_request' | 'complaint';
  requestType?: string;
}

export function TrackableCard({ requestNumber, trackingToken, type, requestType }: TrackableCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const downloadAsImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 600;
    const height = 320;
    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Top accent bar
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#1e3a5f');
    gradient.addColorStop(1, '#f5c518');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, 6);

    // University name
    ctx.fillStyle = '#1e3a5f';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('UNIVERSITY OF MAKATI', width / 2, 40);

    ctx.fillStyle = '#6b7280';
    ctx.font = '11px Arial, sans-serif';
    ctx.fillText('Center for Student Formation & Discipline', width / 2, 58);

    // Divider line
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 72);
    ctx.lineTo(width - 40, 72);
    ctx.stroke();

    // Type badge
    const badge = type === 'complaint' ? 'COMPLAINT' : (requestType || 'SERVICE REQUEST');
    ctx.fillStyle = '#1e3a5f';
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(badge, width / 2, 94);

    // Request Number
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Request Number', 60, 130);

    ctx.fillStyle = '#1e3a5f';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(requestNumber, 60, 162);

    // Tracking Token
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('Tracking Token', 60, 205);

    ctx.fillStyle = '#374151';
    ctx.font = '14px monospace';
    // Wrap token if too long
    const tokenText = trackingToken;
    if (ctx.measureText(tokenText).width > width - 120) {
      const halfLen = Math.ceil(tokenText.length / 2);
      ctx.fillText(tokenText.slice(0, halfLen) + '-', 60, 228);
      ctx.fillText(tokenText.slice(halfLen), 60, 248);
    } else {
      ctx.fillText(tokenText, 60, 228);
    }

    // Footer
    ctx.strokeStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.moveTo(40, 275);
    ctx.lineTo(width - 40, 275);
    ctx.stroke();

    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Keep this information safe. Use it to track your request at the CSFD portal.', width / 2, 296);
    ctx.fillText(`Generated on ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`, width / 2, 312);

    // Download
    const link = document.createElement('a');
    link.download = `${requestNumber}-tracking.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [requestNumber, trackingToken, type, requestType]);

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="hidden" />

      {/* Visual Card */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        {/* Top accent */}
        <div className="h-1.5 bg-gradient-to-r from-[#1e3a5f] to-[#f5c518]" />

        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="text-center">
            <p className="text-xs font-bold text-umak-blue dark:text-umak-gold uppercase tracking-wider">
              University of Makati
            </p>
            <p className="text-[10px] text-muted-foreground">
              Center for Student Formation &amp; Discipline
            </p>
          </div>

          {/* Type Badge */}
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-umak-blue/10 text-umak-blue dark:bg-umak-gold/10 dark:text-umak-gold border border-umak-blue/20 dark:border-umak-gold/20">
              {type === 'complaint' ? 'COMPLAINT' : (requestType || 'SERVICE REQUEST')}
            </span>
          </div>

          {/* Request Number */}
          <div className="rounded-lg bg-muted/50 border p-3">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="size-3.5 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Request Number
              </p>
            </div>
            <p className="text-lg font-bold font-mono text-umak-blue dark:text-umak-gold">
              {requestNumber}
            </p>
          </div>

          {/* Tracking Token */}
          <div className="rounded-lg bg-muted/50 border p-3">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound className="size-3.5 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Tracking Token
              </p>
            </div>
            <p className="text-xs font-mono break-all text-foreground">
              {trackingToken}
            </p>
          </div>

          {/* Footer */}
          <p className="text-[10px] text-center text-muted-foreground">
            Keep this information safe. Use it to track your request.
          </p>
        </div>
      </div>

      {/* Download Button */}
      <Button
        onClick={downloadAsImage}
        variant="outline"
        className="w-full gap-2"
      >
        <Download className="size-4" />
        Download as Image
      </Button>
    </div>
  );
}
