import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useTicketStore } from '../store/useTicketStore';
import { useMilestoneStore } from '../store/useMilestoneStore';
import { useReleaseStore } from '../store/useReleaseStore';
import { useAdminStore } from '../store/useAdminStore';
import { useProductStore } from '../store/useProductStore';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Crown, TrendingUp, AlertTriangle, Clock, Target, Rocket,
  CalendarDays, ChevronDown, Loader2, ShieldCheck, BarChart3,
} from 'lucide-react';
import { formatHoursToTime } from '../utils/timeTracker';
import { format, subDays, differenceInDays, isAfter, parseISO } from 'date-fns';



type DateRange = '7d' | '30d' | '90d' | '6m' | '1y';
const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
];

function rangeToDays(range: DateRange): number {
  switch (range) {
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    case '6m': return 180;
    case '1y': return 365;
  }
}

export default function ExecutiveDashboard() {
  const { tickets, fetchTickets } = useTicketStore();
  const { milestones, fetchMilestones } = useMilestoneStore();
  const { releases, fetchReleases } = useReleaseStore();
  const { fetchUsers } = useAdminStore();
  const { fetchProducts } = useProductStore();

  const [range, setRange] = useState<DateRange>('30d');
  const [loading, setLoading] = useState(true);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);

  const cutoff = useMemo(() => subDays(new Date(), rangeToDays(range)), [range]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchTickets(), fetchMilestones(), fetchReleases(), fetchUsers(), fetchProducts()]);
      // Fetch time entries for velocity
      const { data } = await supabase
        .from('time_entries')
        .select('hours, created_at, technician_id')
        .eq('is_running', false)
        .gte('created_at', cutoff.toISOString());
      setTimeEntries(data || []);
      setLoading(false);
    })();
  }, [range]);

  // ─── COMPUTED METRICS ─────────────────────────────────────────

  const rangeTickets = useMemo(
    () => tickets.filter(t => isAfter(new Date(t.created_at), cutoff)),
    [tickets, cutoff]
  );

  const resolvedInRange = useMemo(
    () => tickets.filter(t => t.resolved_at && isAfter(new Date(t.resolved_at), cutoff)),
    [tickets, cutoff]
  );

  // KPIs
  const totalOpen = tickets.filter(t => t.status !== 'done' && t.status !== 'rejected').length;
  const created = rangeTickets.length;
  const resolved = resolvedInRange.length;
  const slaResponseBreached = tickets.filter(t => t.sla_response_breached && t.status !== 'done').length;
  const slaResolutionBreached = tickets.filter(t => t.sla_resolution_breached && t.status !== 'done').length;
  const totalHoursLogged = timeEntries.reduce((s, e) => s + Number(e.hours), 0);
  const avgResolutionDays = resolvedInRange.length > 0
    ? Math.round(resolvedInRange.reduce((s, t) => s + differenceInDays(new Date(t.resolved_at!), new Date(t.created_at)), 0) / resolvedInRange.length * 10) / 10
    : 0;

  // ─── TREND: Tickets Created vs Resolved (Weekly) ──────────────
  const trendData = useMemo(() => {
    const days = rangeToDays(range);
    const bucketSize = days <= 30 ? 7 : 14; // weekly or bi-weekly
    const buckets: { label: string; created: number; resolved: number }[] = [];
    const now = new Date();

    for (let i = Math.ceil(days / bucketSize) - 1; i >= 0; i--) {
      const start = subDays(now, (i + 1) * bucketSize);
      const end = subDays(now, i * bucketSize);
      const label = format(start, 'MMM d');
      const created = tickets.filter(t => {
        const d = new Date(t.created_at);
        return d >= start && d < end;
      }).length;
      const resolved = tickets.filter(t => {
        if (!t.resolved_at) return false;
        const d = new Date(t.resolved_at);
        return d >= start && d < end;
      }).length;
      buckets.push({ label, created, resolved });
    }
    return buckets;
  }, [tickets, range]);

  // ─── TEAM VELOCITY (hours/week) ───────────────────────────────
  const velocityData = useMemo(() => {
    const days = rangeToDays(range);
    const weeks = Math.ceil(days / 7);
    const now = new Date();
    const data: { label: string; hours: number; tickets: number }[] = [];

    for (let i = weeks - 1; i >= 0; i--) {
      const start = subDays(now, (i + 1) * 7);
      const end = subDays(now, i * 7);
      const label = format(start, 'MMM d');
      const hours = timeEntries
        .filter(e => { const d = new Date(e.created_at); return d >= start && d < end; })
        .reduce((s, e) => s + Number(e.hours), 0);
      const ticketsDone = tickets.filter(t => {
        if (!t.resolved_at) return false;
        const d = new Date(t.resolved_at);
        return d >= start && d < end;
      }).length;
      data.push({ label, hours: Math.round(hours * 10) / 10, tickets: ticketsDone });
    }
    return data;
  }, [tickets, timeEntries, range]);

  // ─── AGING REPORT ─────────────────────────────────────────────
  const agingBuckets = useMemo(() => {
    const open = tickets.filter(t => t.status !== 'done' && t.status !== 'rejected');
    const now = new Date();
    return {
      lt7: open.filter(t => differenceInDays(now, new Date(t.created_at)) < 7),
      d7_14: open.filter(t => { const d = differenceInDays(now, new Date(t.created_at)); return d >= 7 && d < 14; }),
      d14_30: open.filter(t => { const d = differenceInDays(now, new Date(t.created_at)); return d >= 14 && d < 30; }),
      gt30: open.filter(t => differenceInDays(now, new Date(t.created_at)) >= 30),
    };
  }, [tickets]);

  // ─── RESOLUTION BY BRANCH ────────────────────────────────────
  const branchData = useMemo(() => {
    const groups: Record<string, { total: number; days: number }> = {};
    for (const t of resolvedInRange) {
      const branch = t.branch_id || 'Unassigned';
      if (!groups[branch]) groups[branch] = { total: 0, days: 0 };
      groups[branch].total++;
      groups[branch].days += differenceInDays(new Date(t.resolved_at!), new Date(t.created_at));
    }
    return Object.entries(groups)
      .map(([name, v]) => ({ name, avgDays: Math.round(v.days / v.total * 10) / 10 }))
      .sort((a, b) => a.avgDays - b.avgDays);
  }, [resolvedInRange]);

  // ─── PRIORITY DISTRIBUTION ───────────────────────────────────
  const priorityData = useMemo(() => {
    const open = tickets.filter(t => t.status !== 'done' && t.status !== 'rejected');
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const t of open) counts[t.priority] = (counts[t.priority] || 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  const PRIORITY_COLORS: Record<string, string> = {
    critical: '#ef4444', high: '#f59e0b', medium: '#6366f1', low: '#22c55e',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="animate-spin text-primary-500" size={40} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Crown size={24} className="text-amber-500" />
            Executive Command Center
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">High-level operational overview across all FlowDesk data.</p>
        </div>
        <div className="relative">
          <select
            value={range}
            onChange={e => setRange(e.target.value as DateRange)}
            className="appearance-none pl-4 pr-10 py-2.5 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
          >
            {DATE_RANGES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* ─── KPI CARDS ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        <KpiCard label="Open Tickets" value={totalOpen} icon={<BarChart3 size={16} />} color="text-primary-500 bg-primary-50 dark:bg-primary-900/20" />
        <KpiCard label="Created" value={created} icon={<TrendingUp size={16} />} color="text-blue-500 bg-blue-50 dark:bg-blue-900/20" sub={`in ${range}`} />
        <KpiCard label="Resolved" value={resolved} icon={<ShieldCheck size={16} />} color="text-green-500 bg-green-50 dark:bg-green-900/20" sub={`in ${range}`} />
        <KpiCard label="Avg Resolution" value={`${avgResolutionDays}d`} icon={<Clock size={16} />} color="text-amber-500 bg-amber-50 dark:bg-amber-900/20" />
        <KpiCard label="Hours Logged" value={formatHoursToTime(totalHoursLogged)} icon={<Clock size={16} />} color="text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" sub={`in ${range}`} />
        <KpiCard label="SLA Response ⚠" value={slaResponseBreached} icon={<AlertTriangle size={16} />} color={slaResponseBreached > 0 ? "text-red-500 bg-red-50 dark:bg-red-900/20" : "text-green-500 bg-green-50 dark:bg-green-900/20"} />
        <KpiCard label="SLA Resolution ⚠" value={slaResolutionBreached} icon={<AlertTriangle size={16} />} color={slaResolutionBreached > 0 ? "text-red-500 bg-red-50 dark:bg-red-900/20" : "text-green-500 bg-green-50 dark:bg-green-900/20"} />
      </div>

      {/* ─── TREND CHARTS ROW ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Tickets Created vs Resolved */}
        <ChartCard title="Tickets Created vs Resolved" icon={<TrendingUp size={16} />}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e5e7eb)" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Line type="monotone" dataKey="created" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Created" />
              <Line type="monotone" dataKey="resolved" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Resolved" />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Team Velocity */}
        <ChartCard title="Team Velocity (Hours / Week)" icon={<BarChart3 size={16} />}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={velocityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e5e7eb)" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="hours" fill="#6366f1" radius={[4, 4, 0, 0]} name="Hours" />
              <Bar dataKey="tickets" fill="#22c55e" radius={[4, 4, 0, 0]} name="Tickets Closed" />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ─── MIDDLE ROW ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Priority Distribution */}
        <ChartCard title="Open by Priority" icon={<AlertTriangle size={16} />}>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={priorityData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
              >
                {priorityData.map((entry) => (
                  <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] || '#9ca3af'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: 'none' }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} formatter={(val: string) => val.charAt(0).toUpperCase() + val.slice(1)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Aging Report */}
        <ChartCard title="Ticket Aging" icon={<Clock size={16} />} className="lg:col-span-2">
          <div className="grid grid-cols-4 gap-3">
            <AgingBucket label="< 7 days" count={agingBuckets.lt7.length} color="text-green-600 bg-green-50 dark:bg-green-900/20" />
            <AgingBucket label="7–14 days" count={agingBuckets.d7_14.length} color="text-amber-600 bg-amber-50 dark:bg-amber-900/20" />
            <AgingBucket label="14–30 days" count={agingBuckets.d14_30.length} color="text-orange-600 bg-orange-50 dark:bg-orange-900/20" />
            <AgingBucket label="> 30 days" count={agingBuckets.gt30.length} color="text-red-600 bg-red-50 dark:bg-red-900/20" />
          </div>
          {agingBuckets.gt30.length > 0 && (
            <div className="mt-4 max-h-[120px] overflow-y-auto space-y-1">
              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Critical Aging ({'>'}30 days)</p>
              {agingBuckets.gt30.slice(0, 8).map(t => (
                <div key={t.id} className="flex items-center justify-between px-3 py-1.5 bg-red-50/50 dark:bg-red-900/10 rounded-lg text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-primary-600 dark:text-primary-400">{t.readable_id}</span>
                    <span className="truncate text-gray-600 dark:text-gray-400">{t.title}</span>
                  </div>
                  <span className="font-mono text-red-600 dark:text-red-400 shrink-0 ml-2">
                    {differenceInDays(new Date(), new Date(t.created_at))}d
                  </span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* ─── BOTTOM ROW ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Milestone Health */}
        <ChartCard title="Milestone Health" icon={<Target size={16} />}>
          {milestones.filter(m => m.status !== 'completed').length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">No active milestones</p>
          ) : (
            <div className="space-y-3 max-h-[250px] overflow-y-auto">
              {milestones.filter(m => m.status !== 'completed').map(m => {
                const pct = m.ticket_count ? Math.round((m.completed_count || 0) / m.ticket_count * 100) : 0;
                return (
                  <div key={m.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">{m.name}</span>
                      <span className="text-[10px] font-mono text-gray-400">{m.completed_count || 0}/{m.ticket_count || 0}</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-primary-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {m.target_date && (
                      <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                        <CalendarDays size={9} /> {format(parseISO(m.target_date), 'MMM d, yyyy')}
                        {isAfter(new Date(), parseISO(m.target_date)) && pct < 100 && (
                          <span className="text-red-500 font-bold ml-1">OVERDUE</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>

        {/* Release Pipeline */}
        <ChartCard title="Release Pipeline" icon={<Rocket size={16} />}>
          {releases.filter(r => r.status !== 'released' && r.status !== 'rolled_back').length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">No upcoming releases</p>
          ) : (
            <div className="space-y-3 max-h-[250px] overflow-y-auto">
              {releases.filter(r => r.status !== 'released' && r.status !== 'rolled_back').map(r => {
                const statusColors: Record<string, string> = {
                  planned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                  staged: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                };
                return (
                  <div key={r.id} className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-primary-600 dark:text-primary-400">{r.version}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${statusColors[r.status] || ''}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </div>
                    {r.name && <p className="text-[11px] text-gray-600 dark:text-gray-400">{r.name}</p>}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                      {r.release_date && <span className="flex items-center gap-1"><CalendarDays size={9} /> {format(parseISO(r.release_date), 'MMM d')}</span>}
                      <span>{r.ticket_count || 0} tickets</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>

        {/* Resolution Time by Branch */}
        <ChartCard title="Avg Resolution by Branch" icon={<BarChart3 size={16} />}>
          {branchData.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">No resolution data in period</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={branchData} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="#9ca3af" unit="d" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" width={80} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: 'none' }} formatter={(val: any) => [`${val} days`, 'Avg Resolution']} />
                <Bar dataKey="avgDays" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

/* ─── SUB-COMPONENTS ──────────────────────────────────────────── */

function KpiCard({ label, value, icon, color, sub }: { label: string; value: string | number; icon: React.ReactNode; color: string; sub?: string }) {
  return (
    <div className="p-4 bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color}`}>
        {icon}
      </div>
      <div className="text-xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</div>
      {sub && <div className="text-[9px] text-gray-300 dark:text-gray-600">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, icon, children, className = '' }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-gray-400">{icon}</span>
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function AgingBucket({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`p-3 rounded-xl text-center ${color}`}>
      <div className="text-2xl font-bold">{count}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</div>
    </div>
  );
}
