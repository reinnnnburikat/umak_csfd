'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  FileCheck,
  AlertTriangle,
  Megaphone,
  ArrowRight,
  PenLine,
  AlertCircle,
  BookOpen,
  Clock,
  FolderOpen,
  CheckCircle2,
  ShieldAlert,
  Award,
  Activity,
  ChevronRight,
  Hand,
  ClipboardCheck,
  PackageCheck,
  Sun,
  Moon,
  Sparkles,
  Paperclip,
  Eye,
  Calendar,
  Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getServeFileUrl, getIframeSrcUrl, getFileType, openFileUrl } from '@/lib/file-url';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { useQueryInvalidation } from '@/hooks/use-data-refresh';
import { useDashboardStats, type DashboardStats } from '@/hooks/use-dashboard';

// Lazy-load recharts (~200KB) out of the initial bundle
const DashboardCharts = dynamic(() => import('@/components/dashboard/dashboard-charts'), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Skeleton className="h-[340px] lg:col-span-2 rounded-xl" />
      <Skeleton className="h-[340px] rounded-xl" />
    </div>
  ),
});

// ── Status badge helper ──
function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    Submitted: 'status-new',
    'For Review': 'status-pending',
    'For Issuance': 'status-approved',
    Issued: 'status-approved',
    Hold: 'status-hold',
    Rejected: 'status-major',
    Pending: 'status-pending',
    'Under Review': 'status-minor',
    Resolved: 'status-approved',
    Dismissed: 'status-hold',
    Reopened: 'status-others',
  };
  return map[status] || 'status-pending';
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getRoleLabel(role: string) {
  switch (role) {
    case 'superadmin': return 'Super Admin';
    case 'admin': return 'Director';
    case 'staff': return 'Admin Staff';
    default: return role;
  }
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ════════════════════════════════════════════════════════════
// Main Dashboard Page
// ════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { data, isLoading, isFetching } = useDashboardStats();
  const { user: authUser } = useAuth();

  // Real-time data refresh via Socket.IO → React Query invalidation
  useQueryInvalidation(['dashboard', 'service-requests', 'complaints', 'announcements', 'disciplinary']);

  const dashboardRefreshing = isFetching && !isLoading;

  // Pie chart data — hooks must be called before any conditional returns
  const pieData = useMemo(() => [
    { name: 'GMC', value: data?.requestTypeCounts.GMC ?? 0 },
    { name: 'UER', value: data?.requestTypeCounts.UER ?? 0 },
    { name: 'CDC', value: data?.requestTypeCounts.CDC ?? 0 },
    { name: 'CAC', value: data?.requestTypeCounts.CAC ?? 0 },
  ].filter(d => d.value > 0), [data?.requestTypeCounts]);

  // Pipeline data
  const pipeline = useMemo(() => [
    { label: 'Submitted', count: data?.statusCounts.Submitted ?? 0, color: 'bg-blue-500', textColor: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500/10 dark:bg-blue-500/15' },
    { label: 'For Review', count: data?.statusCounts['For Review'] ?? 0, color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10 dark:bg-amber-500/15' },
    { label: 'For Issuance', count: data?.statusCounts['For Issuance'] ?? 0, color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/15' },
    { label: 'Issued', count: data?.statusCounts.Issued ?? 0, color: 'bg-green-600', textColor: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-500/10 dark:bg-green-500/15' },
  ], [data?.statusCounts]);


  // Staff announcement preview dialog
  const [previewAnnouncement, setPreviewAnnouncement] = useState<DashboardStats['staffAnnouncements'][number] | null>(null);


  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const dashboardUser = data?.user || authUser;
  const userName = dashboardUser?.fullName || 'Staff';
  const userRole = dashboardUser?.role || '';
  const userImage = dashboardUser?.profileImageUrl;



  return (
    <div className="space-y-6 animate-fade-in">
      {/* ═══ Welcome Header ═══ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-4 flex-1">
          <Avatar className="size-14 border-2 border-umak-gold/30 shadow-md">
            {userImage ? (
              <AvatarImage src={getServeFileUrl(userImage) ?? undefined} alt={userName} />
            ) : null}
            <AvatarFallback className="bg-umak-blue/10 text-umak-blue font-bold text-lg">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {getGreeting()}, {userName.split(' ')[0]}!
              {dashboardRefreshing && (
                <span className="size-2 rounded-full bg-umak-gold animate-pulse inline-block ml-2 align-middle" />
              )}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-xs border-umak-gold/40 text-umak-gold">
                {getRoleLabel(userRole)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/service-requests">
            <Button size="sm" className="gap-1.5 bg-umak-blue hover:bg-umak-blue/90">
              <FileCheck className="size-4" />
              View Requests
            </Button>
          </Link>
          <Link href="/announcements">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Megaphone className="size-4" />
              Announcements
            </Button>
          </Link>
        </div>
      </div>

      {/* ═══ Attention Cards ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link href="/service-requests?status=Submitted" className="block group">
          <Card className="border-blue-500/20 hover:shadow-md hover:border-blue-500/40 transition-all duration-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-11 rounded-xl bg-blue-500/10 dark:bg-blue-500/15 flex items-center justify-center shrink-0">
                <Clock className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{data?.counters.pendingRequests ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Pending Requests</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/service-requests?status=For+Issuance" className="block group">
          <Card className="border-emerald-500/20 hover:shadow-md hover:border-emerald-500/40 transition-all duration-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-11 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 flex items-center justify-center shrink-0">
                <ClipboardCheck className="size-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{data?.counters.forIssuancePending ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">For Issuance</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/service-requests?status=Hold" className="block group">
          <Card className="border-yellow-500/20 hover:shadow-md hover:border-yellow-500/40 transition-all duration-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-11 rounded-xl bg-yellow-500/10 dark:bg-yellow-500/15 flex items-center justify-center shrink-0">
                <Hand className="size-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{data?.counters.onHoldRequests ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">On Hold</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/complaints" className="block group">
          <Card className="border-red-500/20 hover:shadow-md hover:border-red-500/40 transition-all duration-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-11 rounded-xl bg-red-500/10 dark:bg-red-500/15 flex items-center justify-center shrink-0">
                <ShieldAlert className="size-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{data?.counters.activeComplaints ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Active Complaints</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ═══ Status Pipeline ═══ */}
      <Card className="glass border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-umak-blue/10 flex items-center justify-center">
              <Sparkles className="size-3.5 text-umak-blue" />
            </div>
            <CardTitle className="text-sm font-bold tracking-wider">REQUEST PIPELINE</CardTitle>
            <span className="ml-auto text-xs text-muted-foreground">
              {data?.totalRequests ?? 0} total requests
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-0 overflow-x-auto pb-1">
            {pipeline.map((stage, idx) => (
              <div key={stage.label} className="flex items-center">
                <Link
                  href={`/service-requests?status=${encodeURIComponent(stage.label)}`}
                  className="block group"
                >
                  <div className={`flex flex-col items-center min-w-[100px] p-3 rounded-xl transition-all duration-200 group-hover:${stage.bgColor}`}>
                    <div className={`size-10 rounded-full ${stage.bgColor} flex items-center justify-center mb-1.5`}>
                      <span className={`text-lg font-bold ${stage.textColor}`}>{stage.count}</span>
                    </div>
                    <span className="text-xs font-medium text-center">{stage.label}</span>
                  </div>
                </Link>
                {idx < pipeline.length - 1 && (
                  <ChevronRight className="size-5 text-muted-foreground/30 mx-1 shrink-0" />
                )}
              </div>
            ))}
            {/* Hold & Rejected as side indicators */}
            <div className="ml-4 pl-4 border-l border-border flex items-center gap-4">
              <div className="flex flex-col items-center min-w-[70px]">
                <div className="size-8 rounded-full bg-yellow-500/10 dark:bg-yellow-500/15 flex items-center justify-center mb-1">
                  <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{data?.statusCounts.Hold ?? 0}</span>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">Hold</span>
              </div>
              <div className="flex flex-col items-center min-w-[70px]">
                <div className="size-8 rounded-full bg-red-500/10 dark:bg-red-500/15 flex items-center justify-center mb-1">
                  <span className="text-sm font-bold text-red-600 dark:text-red-400">{data?.statusCounts.Rejected ?? 0}</span>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">Rejected</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ Today + This Month Quick Stats ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Today's New", value: data?.counters.todayNewRequests ?? 0, icon: FolderOpen, color: 'text-blue-500', bg: 'bg-blue-500/10 dark:bg-blue-500/15' },
          { label: 'Issued Today', value: data?.counters.issuedToday ?? 0, icon: Award, color: 'text-green-500', bg: 'bg-green-500/10 dark:bg-green-500/15' },
          { label: 'Disciplinary (Month)', value: data?.counters.disciplinaryThisMonth ?? 0, icon: BookOpen, color: 'text-orange-500', bg: 'bg-orange-500/10 dark:bg-orange-500/15' },
          { label: 'Monthly Issued', value: data?.monthlySummary.issued ?? 0, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10 dark:bg-emerald-500/15' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass rounded-xl p-3 flex items-center gap-3">
              <div className={`size-9 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`size-4 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold leading-none">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ Staff Announcements ═══ */}
      <Card className="glass border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-umak-blue/15 flex items-center justify-center">
                <Megaphone className="size-4 text-umak-blue" />
              </div>
              <CardTitle className="text-sm font-bold tracking-wider">STAFF ANNOUNCEMENTS</CardTitle>
            </div>
            <Link href="/announcements">
              <Button variant="outline" size="sm" className="h-7 text-xs border-umak-blue/40 text-umak-blue hover:bg-umak-blue/10 hover:text-umak-blue">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {data?.staffAnnouncements && data.staffAnnouncements.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {data.staffAnnouncements.map((ann) => (
                <div
                  key={ann.id}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group cursor-pointer"
                  onClick={() => setPreviewAnnouncement(ann)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setPreviewAnnouncement(ann); }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-start gap-2 min-w-0">
                      {ann.isPinned && (
                        <Badge className="text-[9px] px-1.5 py-0 bg-umak-gold/15 text-umak-gold border-umak-gold/30 hover:bg-umak-gold/25 shrink-0 mt-0.5">
                          PINNED
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 mt-0.5 border-umak-blue/30 text-umak-blue">
                        {ann.visibility}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 size-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted transition-all cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); setPreviewAnnouncement(ann); }}
                      title="Preview announcement"
                    >
                      <Eye className="size-3.5 text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-sm font-medium mt-1.5 line-clamp-2 group-hover:text-umak-blue transition-colors">{ann.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ann.body}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] text-muted-foreground/60">{formatDate(ann.createdAt)}</p>
                    {ann.fileUrl && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                        <Paperclip className="size-2.5 mr-0.5" />
                        Attachment
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Megaphone className="size-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm">No staff announcements</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Announcements with Staff or All visibility will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ Staff Announcement Preview Dialog ═══ */}
      <Dialog open={!!previewAnnouncement} onOpenChange={(open) => !open && setPreviewAnnouncement(null)}>
        <DialogContent className="sm:max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold pr-8">
              {previewAnnouncement?.title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Announcement preview
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap">
              {previewAnnouncement?.isPinned && (
                <Badge className="text-[10px] px-2 py-0.5 bg-umak-gold/15 text-umak-gold border-umak-gold/30 hover:bg-umak-gold/25">
                  ★ Pinned
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-umak-blue/30 text-umak-blue">
                <Eye className="size-3 mr-1" />
                {previewAnnouncement?.visibility}
              </Badge>
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="size-4 shrink-0" />
              <span>
                {previewAnnouncement?.postedFrom &&
                  new Date(previewAnnouncement.postedFrom).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric'
                  })
                }
                {' — '}
                {previewAnnouncement?.postedTo &&
                  new Date(previewAnnouncement.postedTo).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric'
                  })
                }
              </span>
            </div>

            {/* Full body */}
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {previewAnnouncement?.body}
            </div>

            {/* File preview */}
            {previewAnnouncement?.fileUrl && (() => {
              const fileType = getFileType(previewAnnouncement.fileUrl!);
              const fileUrl = previewAnnouncement.fileUrl!;

              if (fileType === 'image') {
                return (
                  <div className="mt-2">
                    <img
                      src={getServeFileUrl(fileUrl) || fileUrl}
                      alt={previewAnnouncement.title}
                      className="max-h-80 w-full object-contain rounded-lg bg-muted/30"
                    />
                  </div>
                );
              }

              if (fileType === 'pdf') {
                return (
                  <div className="mt-2 space-y-2">
                    <div className="rounded-lg border overflow-hidden">
                      <iframe
                        src={getIframeSrcUrl(fileUrl, '#toolbar=1&navpanes=0') || undefined}
                        className="w-full h-[500px]"
                        title="PDF Preview"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => openFileUrl(fileUrl)}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Open PDF in new tab
                    </button>
                  </div>
                );
              }

              if (fileType === 'word') {
                return (
                  <button
                    type="button"
                    onClick={() => openFileUrl(fileUrl, { download: true })}
                    className="inline-flex items-center gap-2 px-4 py-2 mt-2 rounded-lg bg-muted/50 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Download className="size-4" />
                    Download Document
                  </button>
                );
              }

              return (
                <button
                  type="button"
                  onClick={() => openFileUrl(fileUrl)}
                  className="inline-flex items-center gap-2 px-4 py-2 mt-2 rounded-lg bg-muted/50 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
                >
                  <Paperclip className="size-4" />
                  View Attachment
                </button>
              );
            })()}
          </div>

          <DialogFooter className="mt-2 shrink-0">
            <Button variant="outline" onClick={() => setPreviewAnnouncement(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Charts (lazy-loaded) ═══ */}
      <DashboardCharts
        trendData={data?.trendData ?? []}
        pieData={pieData}
        comparisonData={data?.comparisonData ?? []}
        complaintCategoryData={data?.complaintCategoryData ?? []}
      />

      {/* ═══ Quick Actions + Announcements ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="lg:col-span-1 glass border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-umak-gold/15 flex items-center justify-center">
                <PenLine className="size-4 text-umak-gold" />
              </div>
              <CardTitle className="text-sm font-bold tracking-wider">QUICK ACTIONS</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <Link href="/complaint/encode" className="block">
              <Button variant="outline" className="w-full justify-start gap-2.5 border-border hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 h-10">
                <AlertCircle className="size-4 text-red-500" />
                Encode Complaint
                <ArrowRight className="size-3.5 ml-auto" />
              </Button>
            </Link>
            <Link href="/disciplinary/new" className="block">
              <Button variant="outline" className="w-full justify-start gap-2.5 border-border hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/30 h-10">
                <BookOpen className="size-4 text-amber-500" />
                New Disciplinary
                <ArrowRight className="size-3.5 ml-auto" />
              </Button>
            </Link>
            <Link href="/service-requests" className="block">
              <Button variant="outline" className="w-full justify-start gap-2.5 border-border hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/30 h-10">
                <FileCheck className="size-4 text-blue-500" />
                Service Requests
                <ArrowRight className="size-3.5 ml-auto" />
              </Button>
            </Link>
            <Link href="/service-requests/issued" className="block">
              <Button variant="outline" className="w-full justify-start gap-2.5 border-border hover:bg-green-500/10 hover:text-green-500 hover:border-green-500/30 h-10">
                <PackageCheck className="size-4 text-green-500" />
                Issued Requests
                <ArrowRight className="size-3.5 ml-auto" />
              </Button>
            </Link>
            <Link href="/announcements" className="block">
              <Button variant="outline" className="w-full justify-start gap-2.5 border-border hover:bg-umak-gold/10 hover:text-umak-gold hover:border-umak-gold/30 h-10">
                <Megaphone className="size-4 text-umak-gold" />
                Announcements
                <ArrowRight className="size-3.5 ml-auto" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Announcements */}
        <Card className="lg:col-span-2 glass border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-umak-gold/15 flex items-center justify-center">
                  <Megaphone className="size-4 text-umak-gold" />
                </div>
                <CardTitle className="text-sm font-bold tracking-wider">ANNOUNCEMENTS</CardTitle>
              </div>
              <Link href="/announcements">
                <Button variant="outline" size="sm" className="h-7 text-xs border-umak-gold/40 text-umak-gold hover:bg-umak-gold/10 hover:text-umak-gold">
                  + Add
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {data?.latestAnnouncements && data.latestAnnouncements.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {data.latestAnnouncements.map((ann) => (
                  <div
                    key={ann.id}
                    className="p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      {ann.isPinned && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-umak-gold/15 text-umak-gold border-umak-gold/30 hover:bg-umak-gold/25 shrink-0">
                          PINNED
                        </Badge>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{ann.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ann.body}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{formatDate(ann.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No active announcements</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Recent Activity (Tabs) ═══ */}
      <Card className="glass border-0 shadow-sm">
        <CardHeader className="pb-0">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-umak-blue/10 flex items-center justify-center">
              <Activity className="size-3.5 text-umak-blue" />
            </div>
            <CardTitle className="text-sm font-bold tracking-wider">RECENT ACTIVITY</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <Tabs defaultValue="requests" className="w-full">
            <TabsList className="w-full justify-start h-9 bg-muted/50 p-0.5">
              <TabsTrigger value="requests" className="text-xs gap-1.5 data-[state=active]:bg-background">
                <FileCheck className="size-3" />
                Service Requests
              </TabsTrigger>
              <TabsTrigger value="complaints" className="text-xs gap-1.5 data-[state=active]:bg-background">
                <AlertTriangle className="size-3" />
                Complaints
              </TabsTrigger>
              <TabsTrigger value="disciplinary" className="text-xs gap-1.5 data-[state=active]:bg-background">
                <BookOpen className="size-3" />
                Disciplinary
              </TabsTrigger>
            </TabsList>

            {/* Service Requests Tab */}
            <TabsContent value="requests" className="mt-3">
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {data?.latestServiceRequests && data.latestServiceRequests.length > 0 ? (
                  data.latestServiceRequests.map((req) => (
                    <Link key={req.id} href={`/service-requests`}>
                      <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/70 transition-colors group">
                        <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                          <FileCheck className="size-3.5 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-medium">{req.requestNumber}</span>
                            <Badge className={`text-[10px] px-1.5 py-0 ${getStatusBadge(req.status)}`}>
                              {req.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {req.requestorName} · {req.requestType}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-muted-foreground/70">{formatDate(req.createdAt)}</p>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">No recent requests</p>
                )}
              </div>
            </TabsContent>

            {/* Complaints Tab */}
            <TabsContent value="complaints" className="mt-3">
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {data?.latestComplaints && data.latestComplaints.length > 0 ? (
                  data.latestComplaints.map((comp) => (
                    <Link key={comp.id} href={`/complaints`}>
                      <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/70 transition-colors group">
                        <div className="size-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                          <AlertTriangle className="size-3.5 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-medium">{comp.complaintNumber}</span>
                            <Badge className={`text-[10px] px-1.5 py-0 ${getStatusBadge(comp.caseStatus)}`}>
                              {comp.caseStatus}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {comp.subject}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-muted-foreground/70">{comp.category || 'General'} · {formatDate(comp.createdAt)}</p>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">No recent complaints</p>
                )}
              </div>
            </TabsContent>

            {/* Disciplinary Tab */}
            <TabsContent value="disciplinary" className="mt-3">
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {data?.latestDisciplinary && data.latestDisciplinary.length > 0 ? (
                  data.latestDisciplinary.map((disc) => (
                    <Link key={disc.id} href={`/disciplinary`}>
                      <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/70 transition-colors group">
                        <div className="size-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                          <BookOpen className="size-3.5 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium truncate">{disc.studentName}</span>
                            <Badge className={`text-[10px] px-1.5 py-0 ${
                              disc.violationCategory === 'MAJOR' ? 'status-major' :
                              disc.violationCategory === 'MINOR' ? 'status-minor' :
                              'status-others'
                            }`}>
                              {disc.violationCategory}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {disc.violationType}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-muted-foreground/70">{disc.studentNumber} · {formatDate(disc.createdAt)}</p>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">No recent disciplinary records</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ═══ Daily & Monthly Summaries ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Daily Summary */}
        <Card className="glass border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <Sun className="size-4 text-blue-500" />
              </div>
              <CardTitle className="text-sm font-bold tracking-wider">TODAY&apos;S SUMMARY</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">Processed</span>
                <span className="font-semibold">
                  {data?.dailySummary.total ? data.dailySummary.total - data.dailySummary.pending : 0} / {data?.dailySummary.total ?? 0}
                </span>
              </div>
              <Progress
                value={data?.dailySummary.total ? ((data.dailySummary.total - data.dailySummary.pending) / data.dailySummary.total) * 100 : 0}
                className="h-2.5"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">Issued</span>
                <span className="font-semibold text-green-600 dark:text-green-400">{data?.dailySummary.resolvedPct ?? 0}%</span>
              </div>
              <Progress
                value={data?.dailySummary.resolvedPct ?? 0}
                className="h-2.5"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold">{data?.dailySummary.total ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{data?.dailySummary.pending ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Pending</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{data?.dailySummary.issued ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Issued</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Summary */}
        <Card className="glass border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <Moon className="size-4 text-emerald-500" />
              </div>
              <CardTitle className="text-sm font-bold tracking-wider">MONTHLY SUMMARY</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">Processed</span>
                <span className="font-semibold">
                  {data?.monthlySummary.total ? data.monthlySummary.total - data.monthlySummary.pending : 0} / {data?.monthlySummary.total ?? 0}
                </span>
              </div>
              <Progress
                value={data?.monthlySummary.total ? ((data.monthlySummary.total - data.monthlySummary.pending) / data.monthlySummary.total) * 100 : 0}
                className="h-2.5"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">Issued</span>
                <span className="font-semibold text-green-600 dark:text-green-400">{data?.monthlySummary.resolvedPct ?? 0}%</span>
              </div>
              <Progress
                value={data?.monthlySummary.resolvedPct ?? 0}
                className="h-2.5"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold">{data?.monthlySummary.total ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{data?.monthlySummary.pending ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Pending</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{data?.monthlySummary.issued ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Issued</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Dashboard Skeleton
// ════════════════════════════════════════════════════════════
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Welcome header skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div>
          <Skeleton className="h-7 w-64 mb-1" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>

      {/* Attention cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-xl p-4 flex items-center gap-3">
            <Skeleton className="size-11 rounded-xl" />
            <div>
              <Skeleton className="h-7 w-12 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline skeleton */}
      <Skeleton className="h-24 rounded-xl" />

      {/* Quick stats skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-xl p-3 flex items-center gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <div>
              <Skeleton className="h-6 w-12 mb-1" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="lg:col-span-2 h-[300px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[260px] rounded-xl" />
        <Skeleton className="h-[260px] rounded-xl" />
      </div>

      {/* Quick actions + announcements skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-[260px] rounded-xl" />
        <Skeleton className="lg:col-span-2 h-[260px] rounded-xl" />
      </div>

      {/* Recent activity skeleton */}
      <Skeleton className="h-[300px] rounded-xl" />

      {/* Summary skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Skeleton className="h-[200px] rounded-xl" />
        <Skeleton className="h-[200px] rounded-xl" />
      </div>
    </div>
  );
}
