'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search, BookOpen, ChevronLeft, ChevronRight, Plus,
  ShieldAlert, CheckCircle2, AlertTriangle,
  Filter, Users,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { getOffenseColor, getOffenseContrastText, getCategoryLabel, getColorProgression } from '@/lib/offense-colors';
import { useDisciplinaryCases, type DisciplinaryCase } from '@/hooks/use-disciplinary';
import { useQueryInvalidation } from '@/hooks/use-data-refresh';

export default function DisciplinaryRecordsPage() {
  const router = useRouter();
  const [category, setCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading } = useDisciplinaryCases({
    page,
    category: category !== 'All' ? category : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: search || undefined,
  });

  // Real-time data refresh via Socket.IO
  useQueryInvalidation(['disciplinary']);

  const cases = data?.data ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const total = data?.pagination?.total ?? 0;

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  // Count statistics — use the API total for the "All" count
  const stats = {
    total,
    active: cases.filter(c => !c.isCleared && !c.isEndorsed).length,
    cleared: cases.filter(c => c.isCleared).length,
    endorsed: cases.filter(c => c.isEndorsed).length,
    major: cases.filter(c => {
      const colorInfo = getOffenseColor(c.violationCategory, c.offenseCount);
      return colorInfo.isMajor;
    }).length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight uppercase">
            <BookOpen className="inline-block mr-2 size-6 text-umak-gold" />
            Disciplinary Records
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} total record{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          asChild
          className="bg-umak-gold text-umak-navy hover:bg-umak-gold-hover font-semibold"
        >
          <Link href="/disciplinary/new">
            <Plus className="size-4 mr-2" />
            Encode Violation
          </Link>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card
          className={`p-3 cursor-pointer transition-all border-l-4 ${statusFilter === 'all' ? 'border-l-umak-gold ring-1 ring-umak-gold/30' : 'border-l-muted hover:border-l-muted-foreground/50'}`}
          onClick={() => handleStatusFilterChange('all')}
        >
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">All</span>
          </div>
          <p className="text-xl font-bold mt-1">{stats.total}</p>
        </Card>
        <Card
          className={`p-3 cursor-pointer transition-all border-l-4 ${statusFilter === 'active' ? 'border-l-amber-500 ring-1 ring-amber-500/30' : 'border-l-muted hover:border-l-muted-foreground/50'}`}
          onClick={() => handleStatusFilterChange('active')}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Active</span>
          </div>
          <p className="text-xl font-bold mt-1">{stats.active}</p>
        </Card>
        <Card
          className={`p-3 cursor-pointer transition-all border-l-4 ${statusFilter === 'cleared' ? 'border-l-emerald-500 ring-1 ring-emerald-500/30' : 'border-l-muted hover:border-l-muted-foreground/50'}`}
          onClick={() => handleStatusFilterChange('cleared')}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Cleared</span>
          </div>
          <p className="text-xl font-bold mt-1">{stats.cleared}</p>
        </Card>
        <Card
          className={`p-3 cursor-pointer transition-all border-l-4 ${statusFilter === 'endorsed' ? 'border-l-rose-500 ring-1 ring-rose-500/30' : 'border-l-muted hover:border-l-muted-foreground/50'}`}
          onClick={() => handleStatusFilterChange('endorsed')}
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-rose-500" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Endorsed</span>
          </div>
          <p className="text-xl font-bold mt-1">{stats.endorsed}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:w-52">
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger>
                <Filter className="size-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Categories</SelectItem>
                <SelectItem value="MINOR">Minor Offense</SelectItem>
                <SelectItem value="MAJOR">Major Offense</SelectItem>
                <SelectItem value="LATE_FACULTY_EVALUATION">Late Faculty Evaluation</SelectItem>
                <SelectItem value="LATE_ACCESS_ROG">Late Access of ROG</SelectItem>
                <SelectItem value="LATE_PAYMENT">Late Payment</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, student number, or email..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12">#</TableHead>
                <TableHead>Student No.</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Violation</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Offense Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Infraction Date</TableHead>
                <TableHead className="w-20">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : cases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <BookOpen className="size-8 text-muted-foreground/40" />
                      <p>No disciplinary records found.</p>
                      {(search || category !== 'All' || statusFilter !== 'all') && (
                        <p className="text-xs">Try adjusting your filters.</p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                cases.map((c, i) => {
                  const colorInfo = getOffenseColor(c.violationCategory, c.offenseCount);
                  const contrastText = getOffenseContrastText(colorInfo.hex);
                  return (
                    <TableRow
                      key={c.id}
                      className={`hover:bg-muted/30 transition-colors cursor-pointer group ${c.isCleared ? 'opacity-70' : ''}`}
                      style={{ borderLeftWidth: '4px', borderLeftColor: colorInfo.hex }}
                      onClick={() => router.push(`/disciplinary/${c.id}`)}
                    >
                      <TableCell className="text-muted-foreground text-sm">
                        {(page - 1) * limit + i + 1}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium">
                        {c.studentNumber}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {c.studentName}
                      </TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate" title={c.violationType}>
                        {c.violationType}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-xs gap-1"
                          style={{
                            borderColor: c.violationCategory === 'MAJOR' ? '#dc2626' : c.violationCategory === 'MINOR' ? '#eab308' : '#94a3b8',
                            color: c.violationCategory === 'MAJOR' ? '#dc2626' : c.violationCategory === 'MINOR' ? '#eab308' : '#94a3b8',
                          }}
                        >
                          {c.violationCategory === 'MAJOR' && <ShieldAlert className="size-3" />}
                          {c.violationCategory === 'MINOR' && <AlertTriangle className="size-3" />}
                          {getCategoryLabel(c.violationCategory)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center justify-center size-7 rounded-full text-xs font-bold"
                            style={{
                              backgroundColor: colorInfo.hex,
                              color: contrastText === 'text-white' ? '#fff' : '#0f172a',
                            }}
                          >
                            {c.offenseCount}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {colorInfo.label}
                          </span>
                          {colorInfo.action && !c.isCleared && (
                            <span className="text-[10px] text-muted-foreground/70 hidden lg:inline">
                              · {colorInfo.action}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {c.isCleared && (
                            <Badge
                              className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0"
                            >
                              <CheckCircle2 className="size-3 mr-0.5" />
                              Cleared
                            </Badge>
                          )}
                          {c.isEndorsed && (
                            <Badge
                              className="text-[10px] px-1.5 py-0 bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-0"
                            >
                              <ShieldAlert className="size-3 mr-0.5" />
                              Endorsed
                            </Badge>
                          )}
                          {!c.isCleared && !c.isEndorsed && colorInfo.isMajor && (
                            <Badge
                              className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-0"
                            >
                              <ShieldAlert className="size-3 mr-0.5" />
                              Major
                            </Badge>
                          )}
                          {!c.isCleared && !c.isEndorsed && !colorInfo.isMajor && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                            >
                              Active
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.dateOfInfraction
                          ? new Date(c.dateOfInfraction).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-umak-gold hover:text-umak-gold-hover opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/disciplinary/${c.id}`);
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="size-4 mr-1" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Color Legend */}
      <Card className="p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Offense Color Legend &amp; Actions
        </h3>
        <div className="space-y-3">
          <div>
            <span className="text-xs text-muted-foreground font-medium">MINOR (per same violation): </span>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {getColorProgression('MINOR').map((color, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <div
                    className="size-4 rounded-sm"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="text-xs text-muted-foreground">{color.label} — {color.action}</span>
                  {color.isMajor && <AlertTriangle className="size-3 text-red-500" />}
                </div>
              ))}
            </div>
          </div>
          <Separator />
          <div>
            <span className="text-xs text-muted-foreground font-medium">MAJOR (across all major offenses): </span>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {getColorProgression('MAJOR').slice(0, 3).map((color, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <div
                    className="size-4 rounded-sm"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="text-xs text-muted-foreground">{color.label} — {color.action}</span>
                </div>
              ))}
              <span className="text-xs text-muted-foreground">…4th-5th: Director&apos;s decision</span>
            </div>
          </div>
          <Separator />
          <div>
            <span className="text-xs text-muted-foreground font-medium">OTHER/LATE (respective counting): </span>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {getColorProgression('LATE_PAYMENT').slice(0, 3).map((color, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <div
                    className="size-4 rounded-sm"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="text-xs text-muted-foreground">{color.label} — {color.action}</span>
                </div>
              ))}
              <span className="text-xs text-muted-foreground">…4th-5th: Director&apos;s decision</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
