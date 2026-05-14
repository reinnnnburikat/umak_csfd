'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Eye, ClipboardCheck, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useComplaints, type Complaint } from '@/hooks/use-complaints';
import { useQueryInvalidation } from '@/hooks/use-data-refresh';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

// ComplaintRecord replaced by Complaint from @/hooks/use-complaints

interface PersonInfo {
  givenName: string;
  surname: string;
  middleName?: string;
  extensionName?: string;
  sex: string;
  studentNumber: string;
  collegeInstitute: string;
  email: string;
  yearLevel: string;
}

function getCategoryClass(category: string | null): string {
  switch (category) {
    case 'MAJOR':
      return 'status-major';
    case 'MINOR':
      return 'status-minor';
    case 'OTHERS':
      return 'status-others';
    default:
      return 'status-pending';
  }
}

function getMainComplainant(complainantsJson: unknown): PersonInfo | null {
  try {
    const list: PersonInfo[] = JSON.parse(complainantsJson as string);
    return list[0] || null;
  } catch {
    return null;
  }
}

function ComplaintCard({
  complaint,
  onEvaluate,
}: {
  complaint: Complaint;
  onEvaluate: (id: string) => void;
}) {
  const main = getMainComplainant(complaint.complainants);
  const router = useRouter();

  return (
    <Card className="card-hover">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-sm">{complaint.complaintNumber}</span>
                {complaint.category && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${getCategoryClass(complaint.category)}`}>
                    {complaint.category}
                  </span>
                )}
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${complaint.caseStatus === 'Resolved' ? 'status-approved' : complaint.caseStatus === 'Pending' ? 'status-pending' : 'status-minor'}`}>
                  {complaint.caseStatus}
                </span>
              </div>
              <h3 className="font-semibold text-sm truncate">{complaint.subject}</h3>
            </div>
          </div>

          {main && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>
                <span className="font-medium">Complainant:</span>{' '}
                {main.givenName} {main.middleName ? main.middleName + ' ' : ''}{main.surname}
                {main.extensionName ? ' ' + main.extensionName : ''}
              </p>
              <p><span className="font-medium">College:</span> {main.collegeInstitute}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Date Filed:</span>{' '}
            {new Date(complaint.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="text-umak-gold hover:text-umak-gold-hover"
              onClick={() => router.push(`/complaints/${complaint.id}`)}
            >
              <Eye className="size-3.5 mr-1" />
              View Details
            </Button>
            {!complaint.category && (
              <Button
                size="sm"
                className="bg-umak-gold text-umak-navy hover:bg-umak-gold-hover font-semibold"
                onClick={() => onEvaluate(complaint.id)}
              >
                <ClipboardCheck className="size-3.5 mr-1" />
                Evaluate
              </Button>
            )}
            {complaint.category && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEvaluate(complaint.id)}
              >
                <ClipboardCheck className="size-3.5 mr-1" />
                Evaluate
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterPills({
  subFilter,
  activeTab,
  onFilterChange,
}: {
  subFilter: string;
  activeTab: string;
  onFilterChange: (filter: string) => void;
}) {
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {['ALL', 'MAJOR', 'MINOR', 'OTHERS'].map((filter) => {
        const isActive = subFilter === filter;
        const colorClass =
          filter === 'MAJOR'
            ? 'status-major'
            : filter === 'MINOR'
              ? 'status-minor'
              : filter === 'OTHERS'
                ? 'status-others'
                : 'status-pending';
        return (
          <button
            key={filter}
            onClick={() => onFilterChange(filter)}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              isActive ? colorClass : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {activeTab === 'pending' ? `All Pending` : activeTab === 'resolved' ? `All Resolved` : filter === 'ALL' ? 'All' : filter}
            {filter !== 'ALL' && isActive ? ` ${filter}` : ''}
          </button>
        );
      })}
    </div>
  );
}

export default function ComplaintsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('all');
  const [subFilter, setSubFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const status = activeTab === 'pending' ? 'PENDING' : activeTab === 'resolved' ? 'RESOLVED' : undefined;
  const { data: response, isLoading: loading, refetch } = useComplaints({ status, search });

  // Real-time data refresh via Socket.IO + React Query invalidation
  useQueryInvalidation(['complaints']);

  const complaints = response?.data ?? [];

  const filteredComplaints = complaints.filter((c) => {
    if (subFilter === 'ALL') return true;
    return c.category === subFilter;
  });

  const handleEvaluate = (id: string) => {
    router.push(`/complaints/${id}/evaluate`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight uppercase">
          <AlertTriangle className="inline-block mr-2 size-6 text-umak-gold" />
          List of Complaints
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {complaints.length} total complaint{complaints.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by complaint number or subject..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSubFilter('ALL'); }}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="all">All Complaints</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No complaints found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredComplaints.map((c) => (
                <ComplaintCard key={c.id} complaint={c} onEvaluate={handleEvaluate} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          <FilterPills subFilter={subFilter} activeTab={activeTab} onFilterChange={setSubFilter} />
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No pending complaints.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredComplaints.map((c) => (
                <ComplaintCard key={c.id} complaint={c} onEvaluate={handleEvaluate} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="resolved" className="mt-4">
          <FilterPills subFilter={subFilter} activeTab={activeTab} onFilterChange={setSubFilter} />
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No resolved complaints.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredComplaints.map((c) => (
                <ResolvedComplaintCard key={c.id} complaint={c} onRefresh={refetch} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResolvedComplaintCard({
  complaint,
  onRefresh,
}: {
  complaint: Complaint;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const [reopening, setReopening] = useState(false);
  const main = getMainComplainant(complaint.complainants);

  const handleReopen = async () => {
    setReopening(true);
    try {
      const res = await fetch(`/api/complaints/${complaint.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseStatus: 'Reopened',
          saveModification: true,
          modifiedBy: 'Staff',
        }),
      });
      if (res.ok) {
        toast('Case reopened successfully', { description: `${complaint.complaintNumber} has been reopened.` });
        onRefresh();
      }
    } catch {
      // Error handled silently
    } finally {
      setReopening(false);
    }
  };

  return (
    <Card className="card-hover">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-sm">{complaint.complaintNumber}</span>
                {complaint.category && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${getCategoryClass(complaint.category)}`}>
                    {complaint.category}
                  </span>
                )}
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold status-approved">
                  Resolved
                </span>
              </div>
              <h3 className="font-semibold text-sm truncate">{complaint.subject}</h3>
            </div>
          </div>

          {main && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>
                <span className="font-medium">Complainant:</span>{' '}
                {main.givenName} {main.middleName ? main.middleName + ' ' : ''}{main.surname}
              </p>
              <p><span className="font-medium">College:</span> {main.collegeInstitute}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="text-umak-gold hover:text-umak-gold-hover"
              onClick={() => router.push(`/complaints/${complaint.id}`)}
            >
              <Eye className="size-3.5 mr-1" />
              View Details
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleReopen}
              disabled={reopening}
            >
              Re-open Case
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
