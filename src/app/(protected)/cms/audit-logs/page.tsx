'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import {
  ScrollText,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface AuditLogEntry {
  id: string;
  performedBy: string | null;
  performerName: string | null;
  performerRole: string | null;
  actionType: string;
  module: string;
  recordId: string | null;
  oldValue: string | null;
  newValue: string | null;
  remarks: string | null;
  createdAt: string;
}

const ACTION_TYPES = ['CREATE', 'UPDATE', 'DELETE', 'STATUS_UPDATE', 'UPSERT', 'BATCH_UPDATE'];
const MODULES = ['user', 'service_request', 'complaint', 'disciplinary', 'announcement', 'managed_list', 'cms_content', 'email_template'];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [performer, setPerformer] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (actionType !== 'all') params.set('actionType', actionType);
      if (moduleFilter !== 'all') params.set('module', moduleFilter);
      if (performer) params.set('performer', performer);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      params.set('page', page.toString());
      params.set('limit', '20');

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data);
        setTotalPages(json.pagination.totalPages);
        setTotal(json.pagination.total);
      }
    } catch (err) {
      // Failed to fetch audit logs
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [search, actionType, moduleFilter, performer, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.error('No logs to export');
      return;
    }

    const headers = ['Timestamp', 'Performer', 'Role', 'Action', 'Module', 'Record ID', 'Details'];
    const rows = logs.map(log => [
      new Date(log.createdAt).toISOString(),
      log.performerName || 'System',
      log.performerRole || '-',
      log.actionType,
      log.module,
      log.recordId || '-',
      log.remarks || '-',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Audit logs exported');
  };

  const actionBadgeColor = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40';
      case 'UPDATE':
      case 'UPSERT':
      case 'BATCH_UPDATE':
        return 'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/40';
      case 'DELETE':
        return 'bg-red-500/15 text-red-600 border-red-500/30 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40';
      case 'STATUS_UPDATE':
        return 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/40';
      default:
        return 'bg-gray-500/15 text-gray-600 border-gray-500/30 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/40';
    }
  };

  const parseJsonSafe = (str: string | null) => {
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  };

  const renderDiff = (oldVal: unknown, newVal: unknown) => {
    if (!oldVal && !newVal) return null;
    const oldObj = typeof oldVal === 'string' ? parseJsonSafe(oldVal) : oldVal;
    const newObj = typeof newVal === 'string' ? parseJsonSafe(newVal) : newVal;

    if (!oldObj && newObj) {
      return (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">New Value:</p>
          <pre className="text-xs bg-emerald-500/5 p-3 rounded-lg overflow-auto max-h-60 border border-emerald-500/20">
            {JSON.stringify(newObj, null, 2)}
          </pre>
        </div>
      );
    }

    if (oldObj && !newObj) {
      return (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-red-600 dark:text-red-400">Old Value:</p>
          <pre className="text-xs bg-red-500/5 p-3 rounded-lg overflow-auto max-h-60 border border-red-500/20">
            {JSON.stringify(oldObj, null, 2)}
          </pre>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-red-600 dark:text-red-400">Old Value:</p>
          <pre className="text-xs bg-red-500/5 p-3 rounded-lg overflow-auto max-h-60 border border-red-500/20">
            {JSON.stringify(oldObj, null, 2)}
          </pre>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">New Value:</p>
          <pre className="text-xs bg-emerald-500/5 p-3 rounded-lg overflow-auto max-h-60 border border-emerald-500/20">
            {JSON.stringify(newObj, null, 2)}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-umak-gold/15 flex items-center justify-center">
            <ScrollText className="size-5 text-umak-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AUDIT LOGS</h1>
            <p className="text-sm text-muted-foreground">{total} total entries</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleExportCSV}
        >
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      {/* Search & Filters */}
      <Card className="glass border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by performer, action, module, or remarks..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              className="gap-2 shrink-0"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="size-4" />
              Filters
              {showFilters ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-border">
              <Select value={actionType} onValueChange={(v) => { setActionType(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Action Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {ACTION_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  {MODULES.map(mod => (
                    <SelectItem key={mod} value={mod}>{mod}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Filter by performer"
                value={performer}
                onChange={(e) => { setPerformer(e.target.value); setPage(1); }}
              />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                placeholder="From date"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                placeholder="To date"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="glass border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center">
              <ScrollText className="size-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No audit logs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 w-8"></th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Timestamp</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Performer</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Action</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">Module</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Record ID</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const isExpanded = expandedId === log.id;
                    return (
                      <Fragment key={log.id}>
                        <tr
                          className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        >
                          <td className="px-4 py-3">
                            {isExpanded ? (
                              <ChevronUp className="size-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="size-4 text-muted-foreground" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-medium">{log.performerName || 'System'}</p>
                              {log.performerRole && (
                                <p className="text-xs text-muted-foreground capitalize">{log.performerRole}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`text-xs ${actionBadgeColor(log.actionType)}`}>
                              {log.actionType}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm hidden md:table-cell">{log.module}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground font-mono hidden lg:table-cell">
                            {log.recordId ? `${log.recordId.slice(0, 8)}...` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
                            {log.remarks || '-'}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${log.id}-expanded`} className="border-b border-border/50 bg-muted/10">
                            <td colSpan={7} className="px-6 py-4">
                              <div className="space-y-3">
                                {log.recordId && (
                                  <p className="text-xs">
                                    <span className="font-semibold">Record ID:</span>{' '}
                                    <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{log.recordId}</code>
                                  </p>
                                )}
                                {log.remarks && (
                                  <p className="text-xs">
                                    <span className="font-semibold">Remarks:</span> {log.remarks}
                                  </p>
                                )}
                                {renderDiff(log.oldValue, log.newValue)}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({total} entries)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
