'use client';

import { useState, useCallback } from 'react';
import {
  Search, FileText, AlertCircle, CheckCircle2, Clock, Loader2,
  Download, MapPin, CalendarDays, PackageCheck, Send, Settings2,
  Hand, XCircle, RotateCcw, ShieldCheck, UserCheck,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ServiceUnavailableOverlay } from '@/components/shared/service-unavailable-overlay';

/* ─── Types ─── */

interface TimelineStage {
  stage: string;
  timestamp: string | null;
}

interface TrackResult {
  type: 'service_request' | 'complaint';
  number: string;
  requestType?: string;
  requestorName?: string;
  subject?: string;
  status: string;
  caseStatus?: string;
  remarks?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  issuedByName?: string;
  issuedAt?: string;
  certificatePdfUrl?: string | null;
  category?: string;
  complaintCategory?: string;
  progressUpdates?: Array<{ id: string; subject: string; date: string; details: string; asOf?: string }>;
  createdAt: string;
  updatedAt: string;
  stages: string[];
  currentStageIndex: number;
  timeline?: TimelineStage[];
  estimatedCompletion?: string | null;
  claimLocation?: string;
}

/* ─── Status Badge Colors (per task spec) ─── */

function getStatusBadgeStyle(status: string): string {
  switch (status) {
    case 'New':
    case 'Pending':
    case 'Submitted':
      return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
    case 'Processing':
    case 'Under Review':
    case 'For Review':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
    case 'For Issuance':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
    case 'Issued':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
    case 'Ready for Pickup':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
    case 'Released':
    case 'Resolved':
      return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    case 'Hold':
    case 'On Hold':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
    case 'Rejected':
    case 'Dismissed':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
    case 'Reopened':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

/* ─── Type Badge Colors ─── */

function getTypeBadgeColor(type: string): string {
  switch (type) {
    case 'GMC':
      return 'bg-umak-blue/10 text-umak-blue dark:bg-umak-gold/10 dark:text-umak-gold border-umak-blue/20 dark:border-umak-gold/20';
    case 'UER':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800';
    case 'CDC':
      return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200 dark:border-teal-800';
    case 'CAC':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800';
    case 'CMP':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

/* ─── Timeline Icons ─── */

function getTimelineIcon(stage: string) {
  switch (stage) {
    case 'Submitted':
      return Send;
    case 'Processing':
    case 'Under Review':
    case 'For Review':
      return Settings2;
    case 'For Issuance':
    case 'Ready for Pickup':
    case 'Resolution':
      return PackageCheck;
    case 'Issued':
    case 'Released':
    case 'Resolved':
      return ShieldCheck;
    default:
      return Clock;
  }
}

/* ─── Date Formatting ─── */

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/* ─── Status Labels for special states ─── */

function getStatusMeta(status: string): { label: string; icon: typeof AlertCircle; color: string } {
  switch (status) {
    case 'Hold':
      return { label: 'On Hold', icon: Hand, color: 'text-yellow-500' };
    case 'Rejected':
      return { label: 'Rejected', icon: XCircle, color: 'text-red-500' };
    case 'Dismissed':
      return { label: 'Dismissed', icon: XCircle, color: 'text-red-500' };
    case 'Reopened':
      return { label: 'Reopened', icon: RotateCcw, color: 'text-yellow-500' };
    default:
      return { label: status, icon: Clock, color: 'text-umak-blue dark:text-umak-gold' };
  }
}

/* ─── Timeline Stage Components ─── */

interface TimelineStageProps {
  stage: string;
  index: number;
  isCompleted: boolean;
  isActive: boolean;
  isFuture: boolean;
  isLast: boolean;
  timestamp: string | null;
  isSpecialStatus: boolean;
  specialMeta?: { label: string; icon: typeof AlertCircle; color: string };
  animationDelay: number;
  icon: React.ComponentType<{ className?: string }>;
}

/* Vertical timeline item (mobile) */
function TimelineStageItem({
  stage,
  isCompleted,
  isActive,
  isFuture,
  isLast,
  timestamp,
  isSpecialStatus,
  specialMeta,
  animationDelay,
  icon: Icon,
}: TimelineStageProps) {
  return (
    <div
      className="flex gap-4 animate-slide-up"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Timeline line + circle */}
      <div className="flex flex-col items-center">
        <div
          className={`
            relative z-10 flex items-center justify-center rounded-full size-10 shrink-0
            transition-all duration-500
            ${isCompleted
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
              : isActive
                ? isSpecialStatus
                  ? 'bg-umak-blue text-umak-gold shadow-lg shadow-umak-blue/30 ring-2 ring-umak-gold/40 ring-offset-2 ring-offset-background'
                  : 'bg-umak-blue text-white shadow-lg shadow-umak-blue/30 ring-2 ring-umak-gold/30 ring-offset-2 ring-offset-background'
                : 'bg-muted text-muted-foreground border-2 border-muted-foreground/20'
            }
          `}
        >
          {isCompleted ? (
            <CheckCircle2 className="size-5" />
          ) : isActive && isSpecialStatus && specialMeta ? (
            <specialMeta.icon className="size-5" />
          ) : isActive ? (
            <Icon className="size-5 animate-pulse-soft" />
          ) : (
            <Icon className="size-4 opacity-40" />
          )}
        </div>
        {/* Connector line */}
        {!isLast && (
          <div
            className={`
              w-0.5 min-h-[48px] flex-1 transition-all duration-700
              ${isCompleted
                ? 'bg-emerald-400 dark:bg-emerald-500'
                : isActive
                  ? 'bg-gradient-to-b from-umak-blue/60 to-muted-foreground/20'
                  : 'bg-muted-foreground/15'
              }
            `}
          />
        )}
      </div>

      {/* Content */}
      <div className={`pb-8 ${isFuture ? 'opacity-40' : ''}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`
              text-sm font-semibold
              ${isCompleted
                ? 'text-emerald-600 dark:text-emerald-400'
                : isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }
            `}
          >
            {stage}
          </span>
          {isActive && isSpecialStatus && specialMeta && (
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-5 ${getStatusBadgeStyle(specialMeta.label === 'On Hold' ? 'Hold' : specialMeta.label === 'Rejected' ? 'Rejected' : specialMeta.label === 'Dismissed' ? 'Dismissed' : 'Reopened')}`}
            >
              {specialMeta.label}
            </Badge>
          )}
        </div>
        {timestamp && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatShortDate(timestamp)}
          </p>
        )}
        {isActive && !isSpecialStatus && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-umak-gold opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-umak-gold" />
            </span>
            <span className="text-xs text-umak-gold font-medium">Current Stage</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* Horizontal timeline item (desktop) */
function DesktopTimelineItem({
  stage,
  index,
  isCompleted,
  isActive,
  isFuture,
  isLast,
  timestamp,
  isSpecialStatus,
  specialMeta,
  animationDelay,
  icon: Icon,
  totalItems,
}: TimelineStageProps & { totalItems: number }) {
  return (
    <div
      className={`flex-1 flex flex-col items-center relative animate-slide-up ${isFuture ? 'opacity-40' : ''}`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Connector line */}
      {index > 0 && (
        <div
          className={`absolute top-5 -left-1/2 w-full h-0.5 transition-colors duration-700 ${
            isCompleted || (isActive && !isSpecialStatus)
              ? 'bg-emerald-400 dark:bg-emerald-500'
              : isActive && isSpecialStatus
                ? 'bg-gradient-to-r from-emerald-400 to-umak-blue'
                : 'bg-muted-foreground/20'
          }`}
        />
      )}

      {/* Circle */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`
                relative z-10 flex items-center justify-center rounded-full size-10 shrink-0 mb-2
                transition-all duration-500
                ${isCompleted
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : isActive
                    ? isSpecialStatus
                      ? 'bg-umak-blue text-umak-gold shadow-lg shadow-umak-blue/30 ring-2 ring-umak-gold/40 ring-offset-2 ring-offset-background'
                      : 'bg-umak-blue text-white shadow-lg shadow-umak-blue/30 ring-2 ring-umak-gold/30 ring-offset-2 ring-offset-background'
                    : 'bg-muted text-muted-foreground border-2 border-muted-foreground/20'
                }
              `}
            >
              {isCompleted ? (
                <CheckCircle2 className="size-5" />
              ) : isActive && isSpecialStatus && specialMeta ? (
                <specialMeta.icon className="size-5" />
              ) : isActive ? (
                <Icon className="size-5 animate-pulse-soft" />
              ) : (
                <Icon className="size-4 opacity-50" />
              )}
            </div>
          </TooltipTrigger>
          {timestamp && (
            <TooltipContent>
              <p>{formatShortDate(timestamp)}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      {/* Active pulse indicator */}
      {isActive && (
        <span className="absolute top-0 z-20 flex size-10">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-umak-gold/30 opacity-75" />
        </span>
      )}

      {/* Label */}
      <span
        className={`
          text-[11px] sm:text-xs text-center leading-tight max-w-[80px] sm:max-w-[100px]
          ${isActive
            ? 'font-semibold text-foreground'
            : isCompleted
              ? 'font-medium text-emerald-600 dark:text-emerald-400'
              : 'text-muted-foreground'
          }
        `}
      >
        {stage}
      </span>

      {/* Timestamp */}
      {timestamp && (
        <span className="text-[10px] text-muted-foreground/60 mt-0.5 text-center">
          {formatShortDate(timestamp)}
        </span>
      )}

      {/* Active indicator text */}
      {isActive && (
        <span className="text-[10px] text-umak-gold font-medium mt-0.5 flex items-center gap-1">
          <span className="relative flex size-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-umak-gold" />
            <span className="relative inline-flex rounded-full size-1.5 bg-umak-gold" />
          </span>
          Current
        </span>
      )}
    </div>
  );
}

/* ─── Auto-detect type from number prefix ─── */

function detectTypeFromNumber(num: string): 'service_request' | 'complaint' | null {
  const upper = num.toUpperCase().trim();
  if (upper.startsWith('CMP-')) return 'complaint';
  if (/^(GMC|UER|CDC|CAC)-/.test(upper)) return 'service_request';
  return null;
}

/* ─── Main Page ─── */

export default function TrackPage() {
  const [trackType, setTrackType] = useState<'service_request' | 'complaint'>('service_request');
  const [requestNumber, setRequestNumber] = useState('');
  const [trackingToken, setTrackingToken] = useState('');
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const handleNumberChange = useCallback((value: string) => {
    setRequestNumber(value);
    if (error) setError('');
    // Auto-detect type from prefix and switch tabs
    const detected = detectTypeFromNumber(value);
    if (detected && detected !== trackType) {
      setTrackType(detected);
    }
  }, [error, trackType]);

  const handleTokenChange = useCallback((value: string) => {
    setTrackingToken(value);
    if (error) setError('');
  }, [error]);

  const handleTrack = useCallback(async () => {
    const num = requestNumber.trim();
    const tok = trackingToken.trim();

    // Both number and tracking token are required for all lookups
    if (!num) {
      setError(trackType === 'service_request'
        ? 'Please enter your request number (e.g., GMC-2025-00001).'
        : 'Please enter your complaint number (e.g., CMP-2025-00001).');
      return;
    }
    if (!tok) {
      setError('Please enter your tracking token. This was sent to your email when you submitted your request.');
      return;
    }

    // Auto-detect type from number prefix (overrides tab selection)
    const detectedType = detectTypeFromNumber(num) || trackType;

    setLoading(true);
    setError('');
    setResult(null);
    setShowResult(false);

    try {
      const params = new URLSearchParams();
      params.set('type', detectedType);
      params.set('number', num);
      params.set('token', tok);

      const res = await fetch(`/api/track?${params}`);

      if (res.status === 404) {
        const data = await res.json();
        setError(data.error || 'No record found. Please check your input and try again.');
        return;
      }

      if (res.status === 400) {
        const data = await res.json();
        setError(data.error || 'Please provide a valid tracking number and token.');
        return;
      }

      if (!res.ok) {
        setError('Something went wrong. Please try again later.');
        return;
      }

      const data = await res.json();
      setResult(data);
      // Small delay for animation
      setTimeout(() => setShowResult(true), 100);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [requestNumber, trackingToken, trackType]);

  const currentStatus = result
    ? result.type === 'service_request'
      ? result.status
      : result.caseStatus || ''
    : '';

  const specialMeta = result ? getStatusMeta(currentStatus) : null;
  const isSpecialStatus = ['Hold', 'Rejected', 'Dismissed', 'Reopened'].includes(currentStatus);

  // Get timeline data
  const timeline: TimelineStage[] = result?.timeline ?? result?.stages?.map((s, i) => ({
    stage: s,
    timestamp: i === 0 ? result?.createdAt ?? null : i <= (result?.currentStageIndex ?? 0) ? result?.updatedAt ?? null : null,
  })) ?? [];

  const currentStageIndex = result?.currentStageIndex ?? 0;

  const downloadTrackingImage = useCallback(() => {
    if (!result) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 600;
    // Dynamic canvas height based on number of timeline stages
    const headerHeight = 260; // Content before timeline (accent bar, header, number, status, divider, label)
    const footerHeight = 60;  // Claim location section + footer
    const extraPadding = 20;
    const stageSpacing = 44;
    const minHeight = 460;
    const height = Math.max(minHeight, headerHeight + (timeline.length * stageSpacing) + footerHeight + extraPadding);
    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Top accent bar
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#111c4e');
    gradient.addColorStop(1, '#ffc400');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, 6);

    // University name
    ctx.fillStyle = '#111c4e';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('UNIVERSITY OF MAKATI', width / 2, 36);
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px Arial, sans-serif';
    ctx.fillText('Center for Student Formation & Discipline', width / 2, 54);

    // Divider
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 68);
    ctx.lineTo(width - 40, 68);
    ctx.stroke();

    // Type badge
    const badge = result.type === 'complaint' ? 'COMPLAINT' : (result.requestType || 'SERVICE REQUEST');
    ctx.fillStyle = '#111c4e';
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(badge, width / 2, 88);

    // Number label (changes based on type)
    const numberLabel = result.type === 'complaint' ? 'Complaint Number' : 'Request Number';
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(numberLabel, 50, 118);
    ctx.fillStyle = '#111c4e';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(result.number, 50, 146);

    // Current Status
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('Current Status', 50, 176);
    ctx.fillStyle = '#111c4e';
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillText(currentStatus, 50, 198);

    // Timeline
    ctx.strokeStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.moveTo(40, 216);
    ctx.lineTo(width - 40, 216);
    ctx.stroke();

    ctx.fillStyle = '#6b7280';
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('PROGRESS TIMELINE', 50, 236);

    // Draw timeline stages
    const stageY = 260;
    timeline.forEach((ts, i) => {
      const y = stageY + i * stageSpacing;
      const isCompleted = i < currentStageIndex;
      const isActive = i === currentStageIndex;

      // Circle
      ctx.beginPath();
      ctx.arc(66, y, 8, 0, Math.PI * 2);
      if (isCompleted) {
        ctx.fillStyle = '#10b981';
      } else if (isActive) {
        ctx.fillStyle = '#111c4e';
      } else {
        ctx.fillStyle = '#d1d5db';
      }
      ctx.fill();

      // Checkmark for completed
      if (isCompleted) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('✓', 66, y + 3);
      }

      // Connector line
      if (i < timeline.length - 1) {
        ctx.strokeStyle = isCompleted ? '#10b981' : '#d1d5db';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(66, y + 8);
        ctx.lineTo(66, y + stageSpacing - 8);
        ctx.stroke();
      }

      // Stage label
      ctx.textAlign = 'left';
      ctx.fillStyle = isCompleted ? '#10b981' : isActive ? '#111c4e' : '#9ca3af';
      ctx.font = `${isActive ? 'bold ' : ''}12px Arial, sans-serif`;
      ctx.fillText(ts.stage, 84, y + 4);

      // Timestamp
      if (ts.timestamp) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px Arial, sans-serif';
        const dateStr = formatShortDate(ts.timestamp);
        ctx.fillText(dateStr, width - 50 - ctx.measureText(dateStr).width, y + 4);
      }
    });

    // Claim Location
    const claimY = stageY + timeline.length * stageSpacing + 16;
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, claimY - 8);
    ctx.lineTo(width - 40, claimY - 8);
    ctx.stroke();

    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Claim Location: CSFD Office, 2nd Floor, Admin Building', 50, claimY + 8);

    // Footer
    ctx.fillStyle = '#9ca3af';
    ctx.font = '9px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `Generated on ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      width / 2,
      height - 12
    );

    const link = document.createElement('a');
    link.download = `${result.number}-tracking.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [result, currentStatus, timeline, currentStageIndex]);

  return (
    <ServiceUnavailableOverlay serviceKey="DISCIPLINARY">
    <div className="flex flex-col min-h-screen">
      {/* Header Section */}
      <section className="relative overflow-hidden gradient-primary text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(245,197,24,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.04),transparent_50%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center justify-center size-20 rounded-2xl bg-white/10 border border-white/20 mb-6 animate-fade-in">
            <Search className="size-10 text-umak-gold" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3 animate-slide-up">
            TRACK YOUR REQUEST
          </h1>
          <p className="text-lg text-white/70 max-w-xl mx-auto animate-slide-up delay-100">
            Track your service request or complaint using your reference number and tracking token
          </p>
        </div>
      </section>

      {/* Search Form Section */}
      <section className="py-10 sm:py-14 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Card className="glass border-border/40 bg-card/80 max-w-lg mx-auto">
            <CardContent className="p-6 sm:p-8">
              <div className="space-y-5">
                {/* Track Type Tabs */}
                <div className="flex rounded-lg bg-muted p-1">
                  <button
                    type="button"
                    onClick={() => { setTrackType('service_request'); setError(''); }}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all cursor-pointer ${
                      trackType === 'service_request'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <FileText className="size-4" />
                    Service Request
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTrackType('complaint'); setError(''); }}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all cursor-pointer ${
                      trackType === 'complaint'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <AlertCircle className="size-4" />
                    Complaint
                  </button>
                </div>

                {/* Number Input — label changes based on type */}
                <div className="space-y-2">
                  <label htmlFor="track-number" className="text-sm font-medium">
                    {trackType === 'service_request' ? 'Request Number' : 'Complaint Number'}
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="track-number"
                      placeholder={trackType === 'service_request'
                        ? 'e.g. GMC-2025-00001, UER-2025-00001'
                        : 'e.g. CMP-2025-00001'}
                      value={requestNumber}
                      onChange={(e) => handleNumberChange(e.target.value)}
                      className="pl-9"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleTrack();
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {trackType === 'service_request'
                      ? 'Enter the request number you received when you submitted your GMC, UER, CDC, or CAC request.'
                      : 'Enter the complaint number you received when you filed your complaint.'}
                  </p>
                  {/* Show auto-detected type indicator */}
                  {requestNumber.trim() && detectTypeFromNumber(requestNumber.trim()) && (
                    <div className="flex items-center gap-1.5">
                      <Badge
                        className={`text-[10px] px-1.5 py-0 h-5 border ${getTypeBadgeColor(
                          detectTypeFromNumber(requestNumber.trim()) === 'complaint' ? 'CMP' : requestNumber.trim().substring(0, 3).toUpperCase()
                        )}`}
                      >
                        {detectTypeFromNumber(requestNumber.trim()) === 'complaint' ? 'CMP' : requestNumber.trim().substring(0, 3).toUpperCase()}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">Auto-detected</span>
                    </div>
                  )}
                </div>

                {/* Tracking Token Input — required for both types */}
                <div className="space-y-2">
                  <label htmlFor="track-token" className="text-sm font-medium">
                    Tracking Token <span className="text-amber-600 dark:text-amber-400 font-normal">(required)</span>
                  </label>
                  <Input
                    id="track-token"
                    placeholder="Paste the tracking token sent to your email"
                    value={trackingToken}
                    onChange={(e) => handleTokenChange(e.target.value)}
                    className="border-amber-300 dark:border-amber-700 focus-visible:ring-amber-400"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTrack();
                    }}
                  />
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    Your tracking token was sent to your email when you submitted your {trackType === 'service_request' ? 'request' : 'complaint'}. This is required for security.
                  </p>
                </div>

                <Button
                  onClick={handleTrack}
                  disabled={loading || !requestNumber.trim() || !trackingToken.trim()}
                  className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy font-semibold w-full"
                  size="default"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : (
                    <Search className="size-4 mr-2" />
                  )}
                  {trackType === 'service_request' ? 'Track Request' : 'Track Complaint'}
                </Button>
                {error && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                    <AlertCircle className="size-3" />
                    {error}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Results Section */}
      {result && (
        <section className="pb-16 sm:pb-20 bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div
              className={`max-w-2xl mx-auto transition-all duration-700 ${showResult ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              {/* Top Result Card */}
              <Card className="glass border-border/40 bg-card/80 overflow-hidden">
                {/* Accent top bar */}
                <div className="h-1.5 bg-gradient-to-r from-umak-blue via-umak-blue/70 to-umak-gold" />

                <CardContent className="p-6 sm:p-8">
                  {/* Header row: badge + number + status */}
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <Badge
                      className={`text-xs font-semibold border ${getTypeBadgeColor(
                        result.type === 'service_request'
                          ? result.requestType || ''
                          : 'CMP'
                      )}`}
                    >
                      {result.type === 'service_request'
                        ? result.requestType
                        : 'CMP'}
                    </Badge>
                    <span className="text-lg font-bold tracking-tight">{result.number}</span>
                  </div>

                  {/* Current Status Badge */}
                  <div className="flex items-center gap-2 mb-6">
                    <span className="text-sm text-muted-foreground">Current Status:</span>
                    <Badge className={`text-xs font-semibold border px-3 py-1 ${getStatusBadgeStyle(currentStatus)}`}>
                      {currentStatus}
                    </Badge>
                  </div>

                  <Separator className="mb-6" />

                  {/* ─── Timeline Visualization ─── */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Sparkles className="size-3.5 text-umak-gold" />
                      Progress Timeline
                    </h3>

                    {/* Desktop: Horizontal Timeline */}
                    <div className="hidden sm:block">
                      <div className="flex items-start w-full">
                        {timeline.map((ts, index) => (
                          <DesktopTimelineItem
                            key={ts.stage}
                            stage={ts.stage}
                            index={index}
                            isCompleted={index < currentStageIndex}
                            isActive={index === currentStageIndex}
                            isFuture={index > currentStageIndex}
                            isLast={index === timeline.length - 1}
                            timestamp={ts.timestamp}
                            isSpecialStatus={index === currentStageIndex && isSpecialStatus}
                            specialMeta={specialMeta ?? undefined}
                            animationDelay={index * 100}
                            icon={getTimelineIcon(ts.stage)}
                            totalItems={timeline.length}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Mobile: Vertical Timeline */}
                    <div className="sm:hidden">
                      {timeline.map((ts, index) => {
                        const isCompleted = index < currentStageIndex;
                        const isActive = index === currentStageIndex;
                        const isFuture = index > currentStageIndex;
                        const isLast = index === timeline.length - 1;

                        return (
                          <TimelineStageItem
                            key={ts.stage}
                            stage={ts.stage}
                            index={index}
                            isCompleted={isCompleted}
                            isActive={isActive}
                            isFuture={isFuture}
                            isLast={isLast}
                            timestamp={ts.timestamp}
                            isSpecialStatus={isActive && isSpecialStatus}
                            specialMeta={specialMeta ?? undefined}
                            animationDelay={index * 100}
                            icon={getTimelineIcon(ts.stage)}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <Separator className="mb-6" />

                  {/* ─── Details Grid ─── */}
                  <div className="space-y-4">
                    {/* Type */}
                    <div className="flex items-start gap-3">
                      <FileText className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Type</p>
                        <p className="text-sm font-medium">
                          {result.type === 'service_request'
                            ? 'Service Request'
                            : 'Complaint'}
                        </p>
                      </div>
                    </div>

                    {/* Date Filed */}
                    <div className="flex items-start gap-3">
                      <Clock className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Date Filed</p>
                        <p className="text-sm font-medium">{formatDate(result.createdAt)}</p>
                      </div>
                    </div>

                    {/* Last Updated */}
                    <div className="flex items-start gap-3">
                      <CalendarDays className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Last Updated</p>
                        <p className="text-sm font-medium">{formatDateTime(result.updatedAt)}</p>
                      </div>
                    </div>

                    {/* Estimated Completion */}
                    {result.estimatedCompletion && (
                      <div className="flex items-start gap-3">
                        <CalendarDays className="size-4 text-umak-gold mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Estimated Completion</p>
                          <p className="text-sm font-medium text-umak-blue dark:text-umak-gold">
                            {formatDate(result.estimatedCompletion)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Business days estimate</p>
                        </div>
                      </div>
                    )}

                    {/* Claim Location */}
                    {result.claimLocation && currentStageIndex >= 2 && (
                      <div className="flex items-start gap-3">
                        <MapPin className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Claim Location</p>
                          <p className="text-sm font-medium">{result.claimLocation}</p>
                        </div>
                      </div>
                    )}

                    {/* Issued By */}
                    {result.issuedByName && (
                      <div className="flex items-start gap-3">
                        <UserCheck className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Issued By</p>
                          <p className="text-sm font-medium">{result.issuedByName}</p>
                          {result.issuedAt && (
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(result.issuedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Remarks */}
                    {result.remarks && (
                      <div className="flex items-start gap-3">
                        <AlertCircle className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Remarks</p>
                          <p className="text-sm">{result.remarks}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ─── Complaint Progress Updates ─── */}
                  {result.type === 'complaint' && result.progressUpdates && result.progressUpdates.length > 0 && (
                    <>
                      <Separator className="my-6" />
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                          <FileText className="size-3.5 text-umak-gold" />
                          Updates
                        </h3>
                        <div className="relative">
                          {/* Timeline line */}
                          <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-umak-gold/30" />
                          <div className="space-y-4">
                            {result.progressUpdates.map((pu) => (
                              <div key={pu.id} className="flex gap-4 relative">
                                {/* Timeline dot */}
                                <div className="w-6 h-6 rounded-full bg-umak-gold flex items-center justify-center shrink-0 z-10 mt-0.5">
                                  <CheckCircle2 className="size-3.5 text-umak-navy" />
                                </div>
                                <div className="flex-1 min-w-0 pb-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <h4 className="font-semibold text-sm">{pu.subject}</h4>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(pu.date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{pu.details}</p>
                                  {pu.asOf && (
                                    <p className="text-xs text-umak-blue dark:text-umak-gold font-medium mt-1.5 italic">
                                      As of {pu.asOf}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Always show claim location info card when request is not yet completed */}
                  {currentStageIndex < (timeline.length - 1) && result.claimLocation && (
                    <>
                      <Separator className="my-6" />
                      <div className="rounded-lg bg-umak-blue/5 dark:bg-umak-gold/5 border border-umak-blue/10 dark:border-umak-gold/10 p-4">
                        <div className="flex items-start gap-3">
                          <MapPin className="size-4 text-umak-blue dark:text-umak-gold mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-umak-blue dark:text-umak-gold">Pickup Location</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              When your request is ready, claim it at: <span className="font-medium text-foreground">{result.claimLocation}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Download as Image Button */}
                  <div className="mt-6 pt-4 border-t">
                    <Button
                      onClick={downloadTrackingImage}
                      variant="outline"
                      className="w-full gap-2"
                    >
                      <Download className="size-4" />
                      Download Tracking Info as Image
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Help card */}
              <div className="mt-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Need help? Visit the <span className="font-medium">CSFD Office, 2nd Floor, Admin Building</span> or contact us during office hours.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Error State */}
      {error && !result && (
        <section className="pb-16 sm:pb-20 bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Card className="glass border-border/40 bg-card/80 max-w-lg mx-auto animate-slide-up">
              <CardContent className="p-6 sm:p-8 text-center">
                <div className="inline-flex items-center justify-center size-14 rounded-full bg-red-50 dark:bg-red-900/20 mb-4">
                  <AlertCircle className="size-7 text-red-500" />
                </div>
                <p className="text-sm text-muted-foreground">{error}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Make sure you entered the correct reference number and tracking token.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </div>
    </ServiceUnavailableOverlay>
  );
}
