import { useMemo, useState } from 'react';
import { useTicketStore } from '../store/useTicketStore';

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { LayoutDashboard, AlertCircle, Clock, CheckCircle2, Ticket as TicketIcon, ChevronRight, X, User, Calendar, Timer } from 'lucide-react';
import TicketDetailPanel from '../components/TicketDetailPanel';
import CustomerDropdown from '../components/CustomerDropdown';
import type { Ticket, TicketPriority } from '../types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

const PRIORITY_BG: Record<TicketPriority, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700',
};

type WidgetFilter = 'total' | 'completed' | 'overdue' | 'blocked' | 'sla_breached' | null;

export default function Dashboard() {
  const { tickets: allTickets } = useTicketStore();

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [activeWidget, setActiveWidget] = useState<WidgetFilter>(null);
  const [filterCustomer, setFilterCustomer] = useState('');

  const tickets = useMemo(() => {
    if (!filterCustomer) return allTickets;
    return allTickets.filter(t => t.customer_name?.trim() === filterCustomer);
  }, [allTickets, filterCustomer]);

  // --- Metrics ---
  const totalTickets = tickets.length;
  const overdueTickets = tickets.filter(t => 
    t.target_completion_date && 
    new Date(t.target_completion_date) < new Date() && 
    t.status !== 'done'
  );
  const blockedTickets = tickets.filter(t => t.is_blocked);
  const completedTickets = tickets.filter(t => t.status === 'done');
  const slaBreachedTickets = tickets.filter(t => 
    t.status !== 'done' && (
      t.sla_response_breached || t.sla_resolution_breached ||
      (t.sla_resolution_deadline && new Date(t.sla_resolution_deadline) < new Date())
    )
  );

  // --- Drill-down ticket list based on active widget ---
  const drillDownTickets = useMemo(() => {
    switch (activeWidget) {
      case 'total': return tickets;
      case 'completed': return completedTickets;
      case 'overdue': return overdueTickets;
      case 'blocked': return blockedTickets;
      case 'sla_breached': return slaBreachedTickets;
      default: return [];
    }
  }, [activeWidget, tickets, completedTickets, overdueTickets, blockedTickets]);

  const drillDownLabel: Record<string, string> = {
    total: 'All Tickets',
    completed: 'Completed Tickets',
    overdue: 'Overdue Tickets',
    blocked: 'Blocked Tickets',
    sla_breached: 'SLA Breached Tickets',
  };

  // --- Data for Pie Chart (Tickets by Status) ---
  const statusData = useMemo(() => {
    const counts = tickets.reduce((acc, t) => {
      const statusLabel = t.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      acc[statusLabel] = (acc[statusLabel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [tickets]);

  // --- Data for Bar Chart (Tickets by Assignee) ---
  // Use ticket.assignee (the profile joined directly in the ticket query) instead of
  // the admin store users list, which is only populated when the Admin page is visited.
  const assigneeData = useMemo(() => {
    const activeTickets = tickets.filter(t => t.status !== 'done');
    const counts = activeTickets.reduce((acc, t) => {
      const name = t.assignee?.full_name || t.assignee?.email || (t.assigned_to ? `User (${t.assigned_to.slice(0, 6)})` : 'Unassigned');
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .map(([name, activeCount]) => ({ name, activeCount }))
      .sort((a, b) => b.activeCount - a.activeCount);
  }, [tickets]);

  // --- Data for Bar Chart (Tickets by Product) ---
  const productData = useMemo(() => {
    const productCounts: Record<string, { count: number; color: string }> = {};
    let unassigned = 0;

    tickets.forEach(t => {
      const prod = t.product;
      if (prod) {
        if (!productCounts[prod.name]) {
          productCounts[prod.name] = { count: 0, color: prod.color };
        }
        productCounts[prod.name].count += 1;
      } else {
        unassigned += 1;
      }
    });

    const data = Object.entries(productCounts).map(([name, info]) => ({
      name,
      value: info.count,
      color: info.color
    }));

    if (unassigned > 0) {
      data.push({ name: 'Unassigned', value: unassigned, color: '#9ca3af' });
    }

    return data.sort((a, b) => b.value - a.value);
  }, [tickets]);

  // --- Quick Focus List ---
  const priorityTickets = useMemo(() => {
    return tickets
      .filter(t => t.status !== 'done' && (t.priority === 'critical' || t.priority === 'high'))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [tickets]);

  const handleWidgetClick = (widget: WidgetFilter) => {
    setActiveWidget(prev => prev === widget ? null : widget);
  };

  const widgetCardClass = (widget: WidgetFilter) =>
    `bg-white dark:bg-surface-dark border rounded-2xl p-5 shadow-sm flex items-center gap-4 cursor-pointer transition-all hover:shadow-md ${
      activeWidget === widget
        ? 'border-primary-400 dark:border-primary-600 ring-2 ring-primary-200 dark:ring-primary-900/50'
        : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
    }`;

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
            <LayoutDashboard size={26} className="text-primary-500" />
            Analytics Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            High-level overview of project health and team workload. Click any card to drill down.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CustomerDropdown value={filterCustomer} onChange={setFilterCustomer} />
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Total Active */}
        <div className={widgetCardClass('total')} onClick={() => handleWidgetClick('total')}>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <TicketIcon size={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Total Tickets</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{totalTickets}</h3>
          </div>
          <ChevronRight size={18} className={`text-gray-300 dark:text-gray-600 transition-transform ${activeWidget === 'total' ? 'rotate-90' : ''}`} />
        </div>

        {/* Completed */}
        <div className={widgetCardClass('completed')} onClick={() => handleWidgetClick('completed')}>
          <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/40 flex items-center justify-center text-green-600 dark:text-green-400">
            <CheckCircle2 size={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Completed</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{completedTickets.length}</h3>
          </div>
          <ChevronRight size={18} className={`text-gray-300 dark:text-gray-600 transition-transform ${activeWidget === 'completed' ? 'rotate-90' : ''}`} />
        </div>

        {/* Overdue */}
        <div className={widgetCardClass('overdue')} onClick={() => handleWidgetClick('overdue')}>
          <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/40 flex items-center justify-center text-red-600 dark:text-red-400">
            <Clock size={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Overdue</p>
            <h3 className="text-2xl font-bold text-red-600 dark:text-red-400">{overdueTickets.length}</h3>
          </div>
          <ChevronRight size={18} className={`text-gray-300 dark:text-gray-600 transition-transform ${activeWidget === 'overdue' ? 'rotate-90' : ''}`} />
        </div>

        {/* Blocked */}
        <div className={widgetCardClass('blocked')} onClick={() => handleWidgetClick('blocked')}>
          <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-900/40 flex items-center justify-center text-orange-600 dark:text-orange-400">
            <AlertCircle size={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Blocked</p>
            <h3 className="text-2xl font-bold text-orange-600 dark:text-orange-400">{blockedTickets.length}</h3>
          </div>
          <ChevronRight size={18} className={`text-gray-300 dark:text-gray-600 transition-transform ${activeWidget === 'blocked' ? 'rotate-90' : ''}`} />
        </div>

        {/* SLA Breached */}
        <div className={widgetCardClass('sla_breached')} onClick={() => handleWidgetClick('sla_breached')}>
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <Timer size={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">SLA Breach</p>
            <h3 className={`text-2xl font-bold ${slaBreachedTickets.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'}`}>{slaBreachedTickets.length}</h3>
          </div>
          <ChevronRight size={18} className={`text-gray-300 dark:text-gray-600 transition-transform ${activeWidget === 'sla_breached' ? 'rotate-90' : ''}`} />
        </div>
      </div>

      {/* Drill-Down Ticket Modal */}
      {activeWidget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-surface-dark w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-gray-50/50 dark:bg-gray-800/20">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-3">
                {drillDownLabel[activeWidget]}
                <span className="text-xs font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2.5 py-0.5 rounded-full border border-primary-200 dark:border-primary-800">
                  {drillDownTickets.length}
                </span>
              </h2>
              <button
                onClick={() => setActiveWidget(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 min-h-[200px]">
              {drillDownTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <TicketIcon size={32} className="text-gray-300 dark:text-gray-600" />
                  </div>
                  <p className="text-base font-semibold text-gray-900 dark:text-white">No tickets found</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center mt-1">No active tickets match this specific metric filter.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {drillDownTickets.map(ticket => {
                    const isOverdue = ticket.target_completion_date && new Date(ticket.target_completion_date) < new Date() && ticket.status !== 'done';
                    const daysOverdue = isOverdue
                      ? Math.floor((new Date().getTime() - new Date(ticket.target_completion_date!).getTime()) / (1000 * 60 * 60 * 24))
                      : null;

                    return (
                      <div
                        key={ticket.id}
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setActiveWidget(null);
                        }}
                        className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition-colors group"
                      >
                        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-bold text-gray-400 dark:text-gray-500 shrink-0">{ticket.readable_id}</span>
                            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                              {ticket.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            {ticket.assignee && (
                              <span className="flex items-center gap-1">
                                <User size={12} /> {ticket.assignee.full_name || ticket.assignee.email}
                              </span>
                            )}
                            {ticket.target_completion_date && (
                              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-semibold dark:text-red-400' : ''}`}>
                                <Calendar size={12} /> 
                                {new Date(ticket.target_completion_date).toLocaleDateString()}
                                {daysOverdue ? ` (${daysOverdue}d overdue)` : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          {ticket.is_blocked && (
                            <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2.5 py-1 rounded-md border border-orange-200 dark:border-orange-800 flex items-center gap-1">
                              <AlertCircle size={10} /> BLOCKED
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest ${PRIORITY_BG[ticket.priority]}`}>
                            {ticket.priority}
                          </span>
                          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 capitalize">
                            {ticket.status.replace(/_/g, ' ')}
                          </span>
                          <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 group-hover:text-primary-500 group-hover:translate-x-1 transition-all ml-1" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
        
        {/* Workload Distribution (Bar Chart) */}
        <div className="bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Active Workload by Assignee</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={assigneeData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                <XAxis type="number" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" width={120} stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ backgroundColor: 'rgb(var(--surface-dark))', borderColor: 'rgb(var(--gray-700))', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                />
                <Bar dataKey="activeCount" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  {assigneeData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Global Distribution (Pie Chart) */}
        <div className="bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col items-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white w-full text-left mb-2">Tickets By Status</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgb(var(--surface-dark))', borderColor: 'rgb(var(--gray-700))', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Volume Distribution */}
        <div className="bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm col-span-1 lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Ticket Volume by Product</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productData}>
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ backgroundColor: 'rgb(var(--surface-dark))', borderColor: 'rgb(var(--gray-700))', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {productData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Needs Attention Section */}
      <div className="bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm mb-12">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <AlertCircle size={20} className="text-red-500" /> Critical Focus Array
        </h2>
        
        {priorityTickets.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">No critical or high priority active tickets.</p>
        ) : (
          <div className="space-y-3">
            {priorityTickets.map(ticket => (
              <div 
                key={ticket.id} 
                onClick={() => setSelectedTicket(ticket)}
                className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-primary-200 dark:hover:border-primary-800 transition-colors cursor-pointer group"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{ticket.readable_id}</span>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {ticket.title}
                    </h4>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {ticket.assignee && (
                      <span className="flex items-center gap-1">
                        Assigned: {ticket.assignee.full_name || ticket.assignee.email}
                      </span>
                    )}
                    {ticket.target_completion_date && (
                      <span className="flex items-center gap-1">
                        Due: {new Date(ticket.target_completion_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {ticket.is_blocked && (
                    <span className="flex items-center gap-1 text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-md">
                      BLOCKED
                    </span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${PRIORITY_BG[ticket.priority]}`}>
                    {ticket.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedTicket && (
        <TicketDetailPanel
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
}
