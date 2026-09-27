import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { Ticket as TicketIcon, Clock, CheckCircle, Trash2, Plus, Download } from 'lucide-react';
import { format } from 'date-fns';
import ConfirmModal from '../components/ConfirmModal';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import CustomerTicketDetail from '../components/CustomerTicketDetail';
import BranchRequestModal from '../components/BranchRequestModal';
import LokdITLogo from '../components/LokdITLogo';

interface PortalTicket {
  id: string;
  readable_id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  description?: string;
  updated_at: string;
  created_at: string;
  estimated_hours?: number;
  billed_hours?: number;
  product_family?: string;
  branch_id?: string;
  target_start_date?: string | null;
  target_test_date?: string | null;
  target_completion_date?: string | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending:         { label: 'Pending',         className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  planning:        { label: 'Planning',         className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  ready_for_dev:   { label: 'Ready for Dev',   className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  dev_in_progress: { label: 'In Progress',  className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  in_review:       { label: 'In Review',        className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  beta_testing:    { label: 'Beta Testing',     className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' },
  done:            { label: 'Resolved',         className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  sow_in_progress: { label: 'SOW In Progress',  className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  awaiting_customer_approval: { label: 'Awaiting Approval', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  on_hold_customer: { label: 'On Hold: Customer', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  on_hold_dev:     { label: 'On Hold: Dev',     className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  on_hold_support: { label: 'On Hold: Support', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  on_hold_sow:     { label: 'On Hold: SOW',     className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  rejected:        { label: 'Rejected',         className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

const typeLabels: Record<string, string> = {
  bug: 'Bug',
  feature_request: 'Feature',
  improvement: 'Improvement',
  task: 'Task',
  documentation: 'Documentation',
  professional_service: 'Service',
  project: 'Project',
};

const priorityColors: Record<string, string> = {
  low:      'bg-green-100 text-green-700',
  medium:   'bg-blue-100 text-blue-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export default function Portal() {
  const { user, profile } = useAuthStore();
  const [myTickets, setMyTickets] = useState<PortalTicket[]>([]);
  const [openTickets, setOpenTickets] = useState<PortalTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<PortalTicket | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    if (!profile) return;
    fetchPortalData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const handleSoftDelete = async () => {
    if (!ticketToDelete) return;
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ archived_by_customer: true })
        .eq('id', ticketToDelete)
        .eq('branch_id', profile?.branch_id || 'no-branch');
      
      if (!error) {
        setMyTickets(prev => prev.filter(t => t.id !== ticketToDelete));
      }
    } catch (err) {
      console.error('Failed to hide ticket:', err);
    } finally {
      setTicketToDelete(null);
    }
  };

  const fetchPortalData = async () => {
    try {
      setLoading(true);
      
      const { data: mine, error: err1 } = await supabase
        .from('tickets')
        .select('id, readable_id, title, type, priority, status, updated_at, created_at, estimated_hours, billed_hours, product_family, branch_id, target_start_date, target_test_date, target_completion_date')
        .eq('branch_id', profile?.branch_id || 'no-branch')
        .eq('archived_by_customer', false)
        .is('parent_ticket_id', null)
        .order('created_at', { ascending: false });

      if (err1) console.error("Portal fetch my tickets error:", err1);

      const { data: open, error: err2 } = await supabase
        .from('tickets')
        .select('id, readable_id, title, type, priority, status, updated_at, created_at')
        .eq('archived_by_customer', false)
        .neq('status', 'done')
        .is('parent_ticket_id', null)
        .order('created_at', { ascending: false });

      if (err2) console.error("Portal fetch open tickets error:", err2);

      setMyTickets((mine as PortalTicket[]) || []);
      setOpenTickets((open as PortalTicket[]) || []);
    } catch (err) {
      console.error("Portal data fetch exception:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Title', 'Type', 'Priority', 'Status', 'Created', 'Updated'];
    const rows = myTickets.map(t => [
      t.readable_id,
      `"${t.title.replace(/"/g, '""')}"`,
      t.type,
      t.priority,
      t.status,
      format(new Date(t.created_at), 'yyyy-MM-dd'),
      format(new Date(t.updated_at), 'yyyy-MM-dd'),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-tickets-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportPDF = async () => {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const container = document.createElement('div');
      container.style.fontFamily = 'system-ui, sans-serif';
      container.style.padding = '24px';
      container.style.color = '#111';

      let html = `<h1 style="margin:0 0 4px 0;font-size:22px;">My Support Requests</h1>
        <p style="color:#666;font-size:13px;margin:0 0 20px 0;">Branch: ${profile?.branch_id || 'N/A'} &bull; Exported ${format(new Date(), 'MMM d, yyyy')}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">ID</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">Title</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">Type</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">Priority</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">Status</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">Created</th>
          </tr></thead><tbody>`;

      myTickets.forEach((t, i) => {
        const bg = i % 2 === 0 ? '#fff' : '#f9fafb';
        html += `<tr style="background:${bg};">
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:700;color:#3b82f6;">${t.readable_id}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${t.title}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${t.type}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${t.priority}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${t.status}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${format(new Date(t.created_at), 'MMM d, yyyy')}</td>
        </tr>`;
      });

      html += '</tbody></table>';
      container.innerHTML = html;

      await html2pdf().set({
        margin: 0.5,
        filename: `my-tickets-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' as const },
      }).from(container).save();
    } catch (err) {
      console.error('PDF export failed:', err);
    }
    setShowExportMenu(false);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-10">
        <Skeleton className="w-full h-40 rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="w-48 h-8 rounded-lg" />
          <Skeleton className="w-full h-24 rounded-2xl" />
          <Skeleton className="w-full h-24 rounded-2xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="w-48 h-8 rounded-lg" />
          <Skeleton className="w-full h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {/* Welcome Header */}
      <div className="bg-gradient-to-br from-primary-600 to-slate-800 rounded-2xl p-8 text-white shadow-lg shadow-primary-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="flex flex-col md:flex-row justify-between gap-8 relative z-10">
          <div>
            <h1 className="text-3xl font-bold mb-1">Support Portal</h1>
            <p className="opacity-80 text-lg">Welcome back, {profile?.full_name || user?.email}</p>
            <div className="flex gap-6 mt-6 md:mt-8">
              <div>
                <div className="text-3xl font-bold">{myTickets.length}</div>
                <div className="text-sm opacity-70 mt-0.5">Your Requests</div>
              </div>
              <div className="w-px bg-white/20" />
              <div>
                <div className="text-3xl font-bold">{myTickets.filter(t => t.status !== 'done').length}</div>
                <div className="text-sm opacity-70 mt-0.5">Open</div>
              </div>
              <div className="w-px bg-white/20" />
              <div>
                <div className="text-3xl font-bold">{myTickets.filter(t => t.status === 'done').length}</div>
                <div className="text-sm opacity-70 mt-0.5">Resolved</div>
              </div>
            </div>
            {/* Submit Request button — branch managers only */}
            {profile?.role === 'branch_manager' && (
              <button
                onClick={() => setShowRequestModal(true)}
                className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-white text-primary-700 font-bold rounded-xl shadow-md hover:bg-primary-50 transition-colors text-sm"
              >
                <Plus size={16} /> Submit a Request
              </button>
            )}
          </div>
          <div className="hidden md:flex">
            <LokdITLogo size="md" subtitle="FlowDesk" inverted className="h-fit self-start" />
          </div>
        </div>
      </div>


      {/* My Tickets Section */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
            <TicketIcon size={16} className="text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex-1">Your Requests</h2>
          {/* Export Dropdown */}
          {myTickets.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-primary-400 hover:text-primary-600 text-xs font-semibold transition-all shadow-sm"
              >
                <Download size={13} /> Export
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-20 bg-white dark:bg-surface-dark rounded-xl border border-gray-100 dark:border-gray-800 shadow-xl w-40 overflow-hidden">
                    <button onClick={handleExportCSV} className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2">
                      📊 Download CSV
                    </button>
                    <button onClick={handleExportPDF} className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2">
                      📄 Download PDF
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {myTickets.length === 0 ? (
          <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800">
            <EmptyState 
              title="No tickets linked to your branch yet"
              description="Contact support to get your requests tracked here, or create a new ticket by reaching out to our team."
            />
          </div>
        ) : (
          <div className="space-y-3">
            {myTickets.map((ticket) => {
              const status = statusConfig[ticket.status] || { label: ticket.status, className: '' };
              return (
                <div 
                  key={ticket.id} 
                  onClick={() => setSelectedTicket(ticket)}
                  className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 p-5 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-xs font-bold text-primary-600 dark:text-primary-400">{ticket.readable_id}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${priorityColors[ticket.priority]}`}>
                          {ticket.priority}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          ticket.type === 'bug' ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'
                        }`}>
                          {typeLabels[ticket.type] ?? ticket.type}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{ticket.title}</h3>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setTicketToDelete(ticket.id)}
                          className="text-red-400 hover:text-red-600 transition-colors bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/30 p-1.5 rounded-lg"
                          title="Hide/Delete Request"
                        >
                          <Trash2 size={12} />
                        </button>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock size={11} />
                          {format(new Date(ticket.updated_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* All Open Requests Section */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
            <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">All Open Requests</h2>
            <p className="text-sm text-gray-400">Read-only view of all active requests in the system</p>
          </div>
        </div>

        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          {openTickets.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-300" />
              <p>All caught up! No open requests right now.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">ID</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">Title</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">Type</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">Priority</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {openTickets.map((ticket) => {
                  const status = statusConfig[ticket.status] || { label: ticket.status, className: '' };
                  return (
                    <tr 
                      key={ticket.id} 
                      onClick={() => setSelectedTicket(ticket)}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs font-bold text-primary-600 dark:text-primary-400">{ticket.readable_id}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">{ticket.title}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          ticket.type === 'bug' ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'
                        }`}>
                          {typeLabels[ticket.type] ?? ticket.type}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${priorityColors[ticket.priority]}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      
      {showRequestModal && (
        <BranchRequestModal
          onClose={() => setShowRequestModal(false)}
          onSuccess={fetchPortalData}
        />
      )}

      <ConfirmModal
        isOpen={!!ticketToDelete}
        title="Delete Request"
        message="Are you sure you want to delete this request from your portal? This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleSoftDelete}
        onCancel={() => setTicketToDelete(null)}
      />

      {selectedTicket && (
        <CustomerTicketDetail 
          ticket={selectedTicket as unknown as import('../types').Ticket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
}
