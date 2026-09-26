import { useState, useEffect, useMemo } from 'react';
import { useTicketStore } from '../store/useTicketStore';
import { useAuthStore } from '../store/useAuthStore';
import { usePinnedTickets } from '../hooks/usePinnedTickets';
import { Ticket } from '../types';
import TicketDetailPanel from '../components/TicketDetailPanel';
import FilterBar, { useTicketFilters } from '../components/FilterBar';
import { format, differenceInDays } from 'date-fns';
import { Pin, PinOff, Briefcase, Star, Search, AlertTriangle } from 'lucide-react';

const priorityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const priorityColors: Record<string, string> = {
  low:      'bg-green-100 text-green-700',
  medium:   'bg-blue-100 text-blue-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};
const statusConfig: Record<string, { label: string; className: string }> = {
  pending:          { label: 'New',         className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  ready_for_dev:    { label: 'Ready',       className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  dev_in_progress:  { label: 'In Progress', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  beta_testing:     { label: 'Approved',    className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' },
  done:             { label: 'Released',    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  on_hold_customer: { label: 'Hold: Customer', className: 'bg-pink-100 text-pink-700' },
  on_hold_dev:      { label: 'Hold: Dev',      className: 'bg-rose-100 text-rose-700' },
  on_hold_support:  { label: 'Hold: Support',  className: 'bg-yellow-100 text-yellow-700' },
  on_hold_sow:      { label: 'Hold: SOW',      className: 'bg-amber-100 text-amber-700' },
};

export default function MyWork() {
  const { tickets, fetchTickets, subscribeToTickets, isLoading } = useTicketStore();
  const { profile } = useAuthStore();
  const { getPinnedIds, isPinned, pin, unpin, MAX_PINS } = usePinnedTickets();
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [, forceUpdate] = useState(0); // trigger re-renders on pin/unpin

  useEffect(() => {
    fetchTickets();
    const unsubscribe = subscribeToTickets();
    return () => unsubscribe();
  }, [fetchTickets, subscribeToTickets]);

  const myTickets = useMemo(() =>
    tickets.filter(t => t.assigned_to === profile?.id && t.status !== 'done'),
    [tickets, profile?.id]
  );

  const searchFiltered = useMemo(() => {
    if (!searchQuery) return myTickets;
    const q = searchQuery.toLowerCase();
    return myTickets.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.readable_id.toLowerCase().includes(q)
    );
  }, [myTickets, searchQuery]);

  const filtered = useTicketFilters(searchFiltered);

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0)),
    [filtered]
  );

  const pinnedIds = getPinnedIds();
  const pinnedTickets = useMemo(() =>
    pinnedIds.map(id => tickets.find(t => t.id === id)).filter(Boolean) as Ticket[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pinnedIds.join(','), tickets]
  );

  const handlePin = (ticket: Ticket, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPinned(ticket.id)) {
      unpin(ticket.id);
    } else {
      const success = pin(ticket.id);
      if (!success) {
        import('react-hot-toast').then(({ default: toast }) =>
          toast.error(`Focus Queue is full (max ${MAX_PINS} tickets). Unpin one first.`)
        );
      }
    }
    forceUpdate(n => n + 1);
  };

  const TicketRow = ({ ticket }: { ticket: Ticket }) => {
    const status = statusConfig[ticket.status] || { label: ticket.status, className: '' };
    const daysOld = differenceInDays(new Date(), new Date(ticket.created_at));
    const isSlaBreached = ticket.status === 'pending' && daysOld > 3;
    const pinned = isPinned(ticket.id);

    return (
      <tr
        onClick={() => setActiveTicket(ticket)}
        className="hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer transition-colors group"
      >
        <td className="px-5 py-3.5">
          <span className="font-mono text-xs font-bold text-primary-600 dark:text-primary-400">{ticket.readable_id}</span>
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className={`shrink-0 w-2 h-2 rounded-full ${ticket.type === 'bug' ? 'bg-red-500' : 'bg-purple-500'}`} />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              {ticket.title}
            </span>
            {isSlaBreached && (
              <span title="SLA Breach" className="shrink-0 flex items-center justify-center p-1 bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400 rounded-md">
                <AlertTriangle size={11} strokeWidth={3} />
              </span>
            )}
          </div>
        </td>
        <td className="px-5 py-3.5">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${status.className}`}>{status.label}</span>
        </td>
        <td className="px-5 py-3.5">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${priorityColors[ticket.priority]}`}>{ticket.priority}</span>
        </td>
        <td className="px-5 py-3.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">{format(new Date(ticket.updated_at), 'MMM d, yy')}</span>
        </td>
        <td className="px-5 py-3.5">
          <button
            onClick={(e) => handlePin(ticket, e)}
            title={pinned ? 'Remove from Focus Queue' : `Pin to Focus Queue (${pinnedIds.length}/${MAX_PINS})`}
            className={`p-1.5 rounded-lg transition-all ${
              pinned
                ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500'
                : 'text-gray-300 dark:text-gray-600 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30'
            }`}
          >
            {pinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-canvas dark:bg-canvas-dark">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-surface-dark/50 backdrop-blur-xl shrink-0 flex items-center justify-between z-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2.5">
            <Briefcase size={22} className="text-primary-500" /> My Work
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {myTickets.length} open ticket{myTickets.length !== 1 ? 's' : ''} assigned to you
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search my tickets..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-60 transition-all"
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-white/30 dark:bg-surface-dark/30 shrink-0">
        <FilterBar tickets={myTickets} />
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">

        {/* Focus Queue */}
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <Star size={16} className={`${pinnedTickets.length > 0 ? 'text-yellow-500 fill-yellow-400' : 'text-gray-400'}`} />
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Focus Queue
            </h2>
            <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
              {pinnedTickets.length} / {MAX_PINS}
            </span>
          </div>

          {pinnedTickets.length === 0 ? (
            <div className="bg-white dark:bg-surface-dark border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl px-6 py-8 text-center">
              <Pin size={24} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-400 dark:text-gray-500">Your Focus Queue is empty</p>
              <p className="text-xs text-gray-400 mt-1">Pin up to {MAX_PINS} tickets from the list below to keep them front-and-center.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pinnedTickets.map(ticket => {
                const status = statusConfig[ticket.status] || { label: ticket.status, className: '' };
                return (
                  <div
                    key={ticket.id}
                    onClick={() => setActiveTicket(ticket)}
                    className="bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800 rounded-2xl p-4 cursor-pointer hover:shadow-md hover:border-primary-200 dark:hover:border-primary-800 transition-all group relative"
                  >
                    <button
                      onClick={e => handlePin(ticket, e)}
                      className="absolute top-3 right-3 p-1.5 rounded-lg text-primary-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Remove from Focus Queue"
                    >
                      <PinOff size={13} />
                    </button>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-xs font-bold text-primary-600 dark:text-primary-400">{ticket.readable_id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${priorityColors[ticket.priority]}`}>{ticket.priority}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2 pr-6">
                      {ticket.title}
                    </p>
                    <div className="mt-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.className}`}>{status.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* My Open Tickets Table */}
        <div>
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Briefcase size={14} /> My Open Tickets
          </h2>
          <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-800">
                  <th className="px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">ID</th>
                  <th className="px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider w-1/2">Title</th>
                  <th className="px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Priority</th>
                  <th className="px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Updated</th>
                  <th className="px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Pin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                {isLoading && sorted.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-sm">Loading...</td></tr>
                ) : sorted.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-sm">
                    {searchQuery ? 'No tickets match your search.' : 'No open tickets assigned to you. 🎉'}
                  </td></tr>
                ) : (
                  sorted.map(ticket => <TicketRow key={ticket.id} ticket={ticket} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {activeTicket && (
        <TicketDetailPanel
          ticket={tickets.find(t => t.id === activeTicket.id) || activeTicket}
          onClose={() => setActiveTicket(null)}
        />
      )}
    </div>
  );
}
