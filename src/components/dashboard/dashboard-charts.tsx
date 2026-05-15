'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import {
  TrendingUp,
  Activity,
  AlertTriangle,
  ListTodo,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';

// ── Chart configs ──
const trendChartConfig: ChartConfig = {
  GMC: { label: 'GMC', color: '#4299E1' },
  UER: { label: 'UER', color: '#38A169' },
  CDC: { label: 'CDC', color: '#9F7AEA' },
  CAC: { label: 'CAC', color: '#ED8936' },
  total: { label: 'Total', color: '#111c4e' },
};

const pieChartConfig: ChartConfig = {
  GMC: { label: 'GMC', color: '#4299E1' },
  UER: { label: 'UER', color: '#38A169' },
  CDC: { label: 'CDC', color: '#9F7AEA' },
  CAC: { label: 'CAC', color: '#ED8936' },
};

const PIE_COLORS = ['#4299E1', '#38A169', '#9F7AEA', '#ED8936'];

const comparisonChartConfig: ChartConfig = {
  requests: { label: 'Service Requests', color: '#4299E1' },
  complaints: { label: 'Complaints', color: '#E53E3E' },
  disciplinary: { label: 'Disciplinary', color: '#ED8936' },
};

const complaintCategoryConfig: ChartConfig = {
  count: { label: 'Count', color: '#111c4e' },
};

const CATEGORY_COLORS = ['#111c4e', '#4299E1', '#38A169', '#ED8936', '#9F7AEA', '#E53E3E', '#DD6B20', '#D69E2E'];

// ── Props ──
export interface DashboardChartsProps {
  trendData: { month: string; GMC: number; UER: number; CDC: number; CAC: number; total: number }[];
  pieData: { name: string; value: number }[];
  comparisonData: { period: string; requests: number; complaints: number; disciplinary: number }[];
  complaintCategoryData: { name: string; count: number }[];
}

export default function DashboardCharts({
  trendData,
  pieData,
  comparisonData,
  complaintCategoryData,
}: DashboardChartsProps) {
  return (
    <>
      {/* ═══ Charts Row: Trends + Distribution ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service Request Trends (Line Chart) */}
        <Card className="lg:col-span-2 glass border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <TrendingUp className="size-4 text-blue-500" />
              </div>
              <CardTitle className="text-sm font-bold tracking-wider">SERVICE REQUEST TRENDS</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={trendChartConfig} className="h-[260px] w-full" style={{ aspectRatio: undefined }}>
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line type="monotone" dataKey="GMC" stroke="var(--color-GMC)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="UER" stroke="var(--color-UER)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="CDC" stroke="var(--color-CDC)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="CAC" stroke="var(--color-CAC)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="total" stroke="var(--color-total)" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 3 }} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Request Type Distribution (Pie/Donut Chart) */}
        <Card className="glass border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
                <Activity className="size-4 text-purple-500" />
              </div>
              <CardTitle className="text-sm font-bold tracking-wider">TYPE DISTRIBUTION</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col items-center">
            <ChartContainer config={pieChartConfig} className="h-[200px] w-full" style={{ aspectRatio: undefined }}>
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                >
                  {pieData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                  <div className="size-2.5 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                  <span className="text-muted-foreground">{entry.name}: <span className="font-semibold text-foreground">{entry.value}</span></span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Charts Row: Complaint Categories + Monthly Comparison ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Complaint Category Breakdown (Bar Chart) */}
        <Card className="glass border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-red-500/15 flex items-center justify-center">
                <AlertTriangle className="size-4 text-red-500" />
              </div>
              <CardTitle className="text-sm font-bold tracking-wider">COMPLAINT CATEGORIES</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {(complaintCategoryData && complaintCategoryData.length > 0) ? (
              <ChartContainer config={complaintCategoryConfig} className="h-[220px] w-full" style={{ aspectRatio: undefined }}>
                <BarChart
                  data={complaintCategoryData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={90}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    {complaintCategoryData.map((_entry, index) => (
                      <Cell key={`bar-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                No complaint data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Comparison (Bar Chart) */}
        <Card className="glass border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <ListTodo className="size-4 text-emerald-500" />
              </div>
              <CardTitle className="text-sm font-bold tracking-wider">MONTHLY COMPARISON</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={comparisonChartConfig} className="h-[220px] w-full" style={{ aspectRatio: undefined }}>
              <BarChart data={comparisonData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="requests" fill="var(--color-requests)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="complaints" fill="var(--color-complaints)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="disciplinary" fill="var(--color-disciplinary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
