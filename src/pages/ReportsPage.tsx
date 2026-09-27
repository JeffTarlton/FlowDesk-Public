import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useTicketStore } from '../store/useTicketStore';
import { useMilestoneStore } from '../store/useMilestoneStore';
import { useReleaseStore } from '../store/useReleaseStore';
import { useProductStore } from '../store/useProductStore';
import { useAdminStore } from '../store/useAdminStore';
import { FileText, Download, Copy, Loader2, ChevronDown, Check, CalendarDays } from 'lucide-react';
import { format, subDays, differenceInDays, isAfter, parseISO } from 'date-fns';
import { formatHoursToTime } from '../utils/timeTracker';
import toast from 'react-hot-toast';

type ReportType = 'sla_compliance' | 'team_workload' | 'milestone_progress' | 'release_history' | 'time_hours' | 'aging_tickets';

const REPORT_TYPES: { value: ReportType; label: string; desc: string }[] = [
  { value: 'sla_compliance', label: 'SLA Compliance', desc: 'Response & resolution breach rates by priority' },
  { value: 'team_workload', label: 'Team Workload', desc: 'Tickets assigned, resolved, and hours per team member' },
  { value: 'milestone_progress', label: 'Milestone Progress', desc: 'Completion % and ticket breakdown per milestone' },
  { value: 'release_history', label: 'Release History', desc: 'All releases with status, dates, and ticket counts' },
  { value: 'time_hours', label: 'Time & Hours', desc: 'Hours logged by technician and ticket' },
  { value: 'aging_tickets', label: 'Aging Tickets', desc: 'Open tickets sorted by age with priority flags' },
];

type DateRange = '7d' | '30d' | '90d' | '6m' | '1y';

export default function ReportsPage() {
  const { tickets, fetchTickets } = useTicketStore();
  const { milestones, fetchMilestones } = useMilestoneStore();
  const { releases, fetchReleases } = useReleaseStore();
  const { fetchProducts } = useProductStore();
  const { users, fetchUsers } = useAdminStore();

  const [reportType, setReportType] = useState<ReportType>('sla_compliance');
  const [range, setRange] = useState<DateRange>('30d');
  const [loading, setLoading] = useState(true);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const rangeDays = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : range === '6m' ? 180 : 365;
  const cutoff = useMemo(() => subDays(new Date(), rangeDays), [rangeDays]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchTickets(), fetchMilestones(), fetchReleases(), fetchProducts(), fetchUsers()]);
      const { data } = await supabase.from('time_entries').select('hours, created_at, technician_id, ticket_id').eq('is_running', false);
      setTimeEntries(data || []);
      setLoading(false);
    })();
  }, []);

  const generate = () => setGenerated(true);

  const handleCopy = () => {
    if (!reportRef.current) return;
    const text = reportRef.current.innerText;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePdf = async () => {
    if (!reportRef.current) return;
    const html2pdf = (await import('html2pdf.js')).default;
    const rType = REPORT_TYPES.find(r => r.value === reportType);
    await html2pdf().set({
      margin: [10, 10, 10, 10],
      filename: `FlowDesk_${rType?.label.replace(/\s/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    }).from(reportRef.current).save();
    toast.success('PDF downloaded');
  };

  // ── Report data generators ──
  const rangeTickets = useMemo(() => tickets.filter(t => isAfter(new Date(t.created_at), cutoff)), [tickets, cutoff]);
  const rangeTimeEntries = useMemo(() => timeEntries.filter(e => isAfter(new Date(e.created_at), cutoff)), [timeEntries, cutoff]);

  const renderReport = () => {
    const now = new Date();
    const thClass = 'px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700';
    const tdClass = 'px-3 py-2 text-xs text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800';

    switch (reportType) {
      case 'sla_compliance': {
        const priorities = ['critical', 'high', 'medium', 'low'];
        const rows = priorities.map(p => {
          const pt = rangeTickets.filter(t => t.priority === p);
          const respBreached = pt.filter(t => t.sla_response_breached).length;
          const resBreached = pt.filter(t => t.sla_resolution_breached).length;
          return { priority: p, total: pt.length, respBreached, resBreached, respPct: pt.length ? Math.round((1 - respBreached / pt.length) * 100) : 100, resPct: pt.length ? Math.round((1 - resBreached / pt.length) * 100) : 100 };
        });
        const totalT = rows.reduce((s, r) => s + r.total, 0);
        const totalRespB = rows.reduce((s, r) => s + r.respBreached, 0);
        const totalResB = rows.reduce((s, r) => s + r.resBreached, 0);
        return (
          <table className="w-full"><thead><tr>
            <th className={thClass}>Priority</th><th className={thClass}>Tickets</th>
            <th className={thClass}>Resp. Breached</th><th className={thClass}>Resp. Compliance</th>
            <th className={thClass}>Resol. Breached</th><th className={thClass}>Resol. Compliance</th>
          </tr></thead><tbody>
            {rows.map(r => (<tr key={r.priority}>
              <td className={`${tdClass} font-bold capitalize`}>{r.priority}</td><td className={tdClass}>{r.total}</td>
              <td className={`${tdClass} ${r.respBreached > 0 ? 'text-red-600 font-bold' : ''}`}>{r.respBreached}</td>
              <td className={`${tdClass} font-bold ${r.respPct >= 90 ? 'text-green-600' : r.respPct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{r.respPct}%</td>
              <td className={`${tdClass} ${r.resBreached > 0 ? 'text-red-600 font-bold' : ''}`}>{r.resBreached}</td>
              <td className={`${tdClass} font-bold ${r.resPct >= 90 ? 'text-green-600' : r.resPct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{r.resPct}%</td>
            </tr>))}
            <tr className="bg-gray-50 dark:bg-gray-800/50 font-bold">
              <td className={tdClass}>Total</td><td className={tdClass}>{totalT}</td>
              <td className={tdClass}>{totalRespB}</td><td className={tdClass}>{totalT ? Math.round((1 - totalRespB / totalT) * 100) : 100}%</td>
              <td className={tdClass}>{totalResB}</td><td className={tdClass}>{totalT ? Math.round((1 - totalResB / totalT) * 100) : 100}%</td>
            </tr>
          </tbody></table>
        );
      }

      case 'team_workload': {
        const staffUsers = users.filter(u => ['admin', 'developer', 'support_desk'].includes(u.role));
        const rows = staffUsers.map(u => {
          const assigned = tickets.filter(t => t.assigned_to === u.id && t.status !== 'done' && t.status !== 'rejected').length;
          const resolved = tickets.filter(t => t.assigned_to === u.id && t.resolved_at && isAfter(new Date(t.resolved_at), cutoff)).length;
          const hours = rangeTimeEntries.filter(e => e.technician_id === u.id).reduce((s: number, e: any) => s + Number(e.hours), 0);
          return { name: u.full_name || u.email, role: u.role, assigned, resolved, hours: Math.round(hours * 100) / 100 };
        }).sort((a, b) => b.resolved - a.resolved);
        return (
          <table className="w-full"><thead><tr>
            <th className={thClass}>Team Member</th><th className={thClass}>Role</th>
            <th className={thClass}>Open Assigned</th><th className={thClass}>Resolved (period)</th><th className={thClass}>Hours Logged</th>
          </tr></thead><tbody>
            {rows.map(r => (<tr key={r.name}>
              <td className={`${tdClass} font-bold`}>{r.name}</td><td className={`${tdClass} capitalize`}>{r.role.replace('_', ' ')}</td>
              <td className={tdClass}>{r.assigned}</td><td className={tdClass}>{r.resolved}</td><td className={tdClass}>{formatHoursToTime(r.hours)}</td>
            </tr>))}
          </tbody></table>
        );
      }

      case 'milestone_progress': {
        return (
          <table className="w-full"><thead><tr>
            <th className={thClass}>Milestone</th><th className={thClass}>Status</th>
            <th className={thClass}>Target Date</th><th className={thClass}>Tickets</th>
            <th className={thClass}>Completed</th><th className={thClass}>Progress</th>
          </tr></thead><tbody>
            {milestones.map(m => {
              const pct = m.ticket_count ? Math.round((m.completed_count || 0) / m.ticket_count * 100) : 0;
              const overdue = m.target_date && isAfter(now, parseISO(m.target_date)) && m.status !== 'completed';
              return (<tr key={m.id}>
                <td className={`${tdClass} font-bold`}>{m.name}</td>
                <td className={`${tdClass} capitalize`}>{m.status.replace('_', ' ')}</td>
                <td className={`${tdClass} ${overdue ? 'text-red-600 font-bold' : ''}`}>{m.target_date ? format(parseISO(m.target_date), 'MMM d, yyyy') : '—'}{overdue ? ' ⚠' : ''}</td>
                <td className={tdClass}>{m.ticket_count || 0}</td>
                <td className={tdClass}>{m.completed_count || 0}</td>
                <td className={`${tdClass} font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-gray-500'}`}>{pct}%</td>
              </tr>);
            })}
          </tbody></table>
        );
      }

      case 'release_history': {
        return (
          <table className="w-full"><thead><tr>
            <th className={thClass}>Version</th><th className={thClass}>Name</th><th className={thClass}>Status</th>
            <th className={thClass}>Release Date</th><th className={thClass}>Tickets</th>
          </tr></thead><tbody>
            {releases.map(r => (<tr key={r.id}>
              <td className={`${tdClass} font-bold text-primary-600 dark:text-primary-400`}>{r.version}</td>
              <td className={tdClass}>{r.name || '—'}</td>
              <td className={`${tdClass} capitalize font-semibold`}>{r.status.replace('_', ' ')}</td>
              <td className={tdClass}>{r.release_date ? format(parseISO(r.release_date), 'MMM d, yyyy') : '—'}</td>
              <td className={tdClass}>{r.ticket_count || 0}</td>
            </tr>))}
          </tbody></table>
        );
      }

      case 'time_hours': {
        const grouped: Record<string, { name: string; hours: number; tickets: Set<string> }> = {};
        for (const e of rangeTimeEntries) {
          if (!grouped[e.technician_id]) {
            const u = users.find(u => u.id === e.technician_id);
            grouped[e.technician_id] = { name: u?.full_name || u?.email || 'Unknown', hours: 0, tickets: new Set() };
          }
          grouped[e.technician_id].hours += Number(e.hours);
          grouped[e.technician_id].tickets.add(e.ticket_id);
        }
        const rows = Object.values(grouped).map(g => ({ ...g, ticketCount: g.tickets.size, hours: Math.round(g.hours * 100) / 100 })).sort((a, b) => b.hours - a.hours);
        const totalH = rows.reduce((s, r) => s + r.hours, 0);
        return (
          <table className="w-full"><thead><tr>
            <th className={thClass}>Technician</th><th className={thClass}>Hours Logged</th><th className={thClass}>Tickets Worked</th><th className={thClass}>Avg Hours/Ticket</th>
          </tr></thead><tbody>
            {rows.map(r => (<tr key={r.name}>
              <td className={`${tdClass} font-bold`}>{r.name}</td>
              <td className={tdClass}>{formatHoursToTime(r.hours)}</td>
              <td className={tdClass}>{r.ticketCount}</td>
              <td className={tdClass}>{r.ticketCount ? (r.hours / r.ticketCount).toFixed(1) : '—'}h</td>
            </tr>))}
            <tr className="bg-gray-50 dark:bg-gray-800/50 font-bold">
              <td className={tdClass}>Total</td><td className={tdClass}>{formatHoursToTime(totalH)}</td>
              <td className={tdClass} colSpan={2}></td>
            </tr>
          </tbody></table>
        );
      }

      case 'aging_tickets': {
        const open = tickets.filter(t => t.status !== 'done' && t.status !== 'rejected')
          .map(t => ({ ...t, age: differenceInDays(now, new Date(t.created_at)) }))
          .sort((a, b) => b.age - a.age);
        return (
          <table className="w-full"><thead><tr>
            <th className={thClass}>ID</th><th className={thClass}>Title</th><th className={thClass}>Priority</th>
            <th className={thClass}>Status</th><th className={thClass}>Age (days)</th><th className={thClass}>Created</th>
          </tr></thead><tbody>
            {open.map(t => (<tr key={t.id}>
              <td className={`${tdClass} font-bold text-primary-600 dark:text-primary-400`}>{t.readable_id}</td>
              <td className={`${tdClass} max-w-[300px] truncate`}>{t.title}</td>
              <td className={`${tdClass} capitalize font-semibold ${t.priority === 'critical' ? 'text-red-600' : t.priority === 'high' ? 'text-amber-600' : ''}`}>{t.priority}</td>
              <td className={`${tdClass} capitalize`}>{t.status.replace(/_/g, ' ')}</td>
              <td className={`${tdClass} font-mono ${t.age > 30 ? 'text-red-600 font-bold' : t.age > 14 ? 'text-amber-600' : ''}`}>{t.age}d</td>
              <td className={tdClass}>{format(new Date(t.created_at), 'MMM d, yyyy')}</td>
            </tr>))}
          </tbody></table>
        );
      }
    }
  };

  const rType = REPORT_TYPES.find(r => r.value === reportType);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <FileText size={24} className="text-primary-500" />Reports
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Generate, view, and export operational reports.</p>
        </div>
      </div>

      {/* Config */}
      <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Report Type</label>
            <div className="relative">
              <select value={reportType} onChange={e => { setReportType(e.target.value as ReportType); setGenerated(false); }}
                className="w-full appearance-none pl-4 pr-10 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500">
                {REPORT_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">{rType?.desc}</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Date Range</label>
            <div className="relative">
              <select value={range} onChange={e => { setRange(e.target.value as DateRange); setGenerated(false); }}
                className="w-full appearance-none pl-4 pr-10 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option><option value="6m">Last 6 Months</option><option value="1y">Last Year</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <button onClick={generate} disabled={loading}
              className="w-full px-6 py-2.5 bg-primary-500 text-white text-sm font-bold rounded-xl hover:bg-primary-600 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={14} className="animate-spin" /> Loading...</> : <><CalendarDays size={14} /> Generate Report</>}
            </button>
          </div>
        </div>
      </div>

      {/* Report Output */}
      {generated && (
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">{rType?.label}</h2>
              <p className="text-[10px] text-gray-400">{format(cutoff, 'MMM d, yyyy')} — {format(new Date(), 'MMM d, yyyy')}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                {copied ? <><Check size={12} className="text-green-500" /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
              <button onClick={handlePdf}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors">
                <Download size={12} /> PDF
              </button>
            </div>
          </div>
          {/* Report Content */}
          <div ref={reportRef} className="p-6 overflow-x-auto">
            {renderReport()}
          </div>
        </div>
      )}

      {!generated && !loading && (
        <div className="text-center py-20 bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800">
          <FileText size={48} className="text-gray-200 dark:text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Select a Report</h3>
          <p className="text-sm text-gray-400">Choose a report type and date range, then click Generate.</p>
        </div>
      )}
    </div>
  );
}
