import { useState, useEffect, useMemo } from 'react';
import { useTicketStore } from '../store/useTicketStore';
import { useMilestoneStore } from '../store/useMilestoneStore';
import { Ticket } from '../types';
import TicketDetailPanel from '../components/TicketDetailPanel';
import Skeleton from '../components/Skeleton';
import FilterBar, { useTicketFilters } from '../components/FilterBar';
import CustomerDropdown from '../components/CustomerDropdown';
import { useSavedViews, SavedView } from '../hooks/useSavedViews';
import { format, differenceInDays } from 'date-fns';
import { Search, AlertTriangle, Loader2, Bookmark, BookmarkPlus, X, Plus, Target } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useSearchParams } from 'react-router-dom';
import NewTicketModal from '../components/NewTicketModal';
import ProductDropdown from '../components/ProductDropdown';

const statusConfig: Record<string, { label: string; className: string }> = {
  pending:          { label: 'New Request',      className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  ready_for_dev:    { label: 'Ready for Dev',    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  dev_in_progress:  { label: 'In Progress',   className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  beta_testing:     { label: 'Approved',         className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' },
  done:             { label: 'Released',         className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  on_hold_customer: { label: 'Hold: Customer',   className: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
  on_hold_dev:      { label: 'Hold: Dev',        className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  on_hold_support:  { label: 'Hold: Support',    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  on_hold_sow:      { label: 'Hold: SOW',        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
};

const priorityColors: Record<string, string> = {
  low:      'bg-green-100 text-green-700',
  medium:   'bg-blue-100 text-blue-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export default function Backlog() {
  const { profile } = useAuthStore();
  const { tickets, fetchTickets, subscribeToTickets, isLoading, loadMoreTickets, hasMore, isLoadingMore } = useTicketStore();
  const { milestones, fetchMilestones } = useMilestoneStore();
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  
  // Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const filterProduct = searchParams.get('product') || '';
  const [sortField, setSortField] = useState<'updated_at' | 'priority' | 'status'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { savedViews, addView, removeView } = useSavedViews();
  const [showSaveView, setShowSaveView] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [filterMilestone, setFilterMilestone] = useState('');

  useEffect(() => {
    fetchTickets();
    fetchMilestones();
    const unsubscribe = subscribeToTickets();
    return () => unsubscribe();
  }, [fetchTickets, subscribeToTickets]);

  const sortedAndFilteredTickets = useMemo(() => {
    let filtered = tickets.filter(t =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.readable_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.customer_email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (filterCustomer) {
      filtered = filtered.filter(t => t.customer_name?.trim() === filterCustomer);
    }

    if (filterProduct) {
      filtered = filtered.filter(t => (t.product_id === filterProduct) || (t.product?.id === filterProduct));
    }

    if (filterMilestone) {
      filtered = filtered.filter(t => (t as any).milestone_id === filterMilestone);
    }

    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'updated_at') {
        comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      } else if (sortField === 'priority') {
        const pOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        comparison = (pOrder[a.priority] || 0) - (pOrder[b.priority] || 0);
      } else if (sortField === 'status') {
        // Simple alphabetical sort for status, or we could define a rigid order
        comparison = a.status.localeCompare(b.status);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [tickets, searchQuery, sortField, sortOrder, filterCustomer, filterProduct, filterMilestone]);

  // Apply active URL-param filter on top of text search + sort
  const filteredTickets = useTicketFilters(sortedAndFilteredTickets);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleSaveView = () => {
    if (!newViewName.trim()) return;
    addView({
      name: newViewName.trim(),
      searchQuery,
      filterPreset: searchParams.get('filter'),
      sortField,
      sortOrder
    });
    setNewViewName('');
    setShowSaveView(false);
  };

  const applyView = (view: SavedView) => {
    setSearchQuery(view.searchQuery);
    setSortField(view.sortField);
    setSortOrder(view.sortOrder);
    const next = new URLSearchParams(searchParams);
    if (view.filterPreset) {
      next.set('filter', view.filterPreset);
    } else {
      next.delete('filter');
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-canvas dark:bg-canvas-dark">
      {showNewTicketModal && (
        <NewTicketModal onClose={() => setShowNewTicketModal(false)} />
      )}
      {/* Header & Controls */}
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-surface-dark/50 backdrop-blur-xl shrink-0 flex flex-wrap items-center justify-between gap-4 z-10 transition-colors duration-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 transition-colors duration-200">Backlog</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Triage and manage the queue</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <ProductDropdown 
            value={filterProduct} 
            onChange={(val) => {
              const next = new URLSearchParams(searchParams);
              if (val) next.set('product', val);
              else next.delete('product');
              setSearchParams(next, { replace: true });
            }} 
          />
          <CustomerDropdown value={filterCustomer} onChange={setFilterCustomer} />
          <div className="relative">
            <Target className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <select
              value={filterMilestone}
              onChange={e => setFilterMilestone(e.target.value)}
              className={`pl-9 pr-4 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all appearance-none cursor-pointer min-w-[140px] ${
                filterMilestone
                  ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 font-semibold'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              <option value="">All Milestones</option>
              {milestones.filter(m => m.status !== 'completed').map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
              {milestones.filter(m => m.status === 'completed').length > 0 && (
                <option disabled>── Completed ──</option>
              )}
              {milestones.filter(m => m.status === 'completed').map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search via ID or Title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-64 transition-all"
            />
          </div>
          <button 
            onClick={() => setShowSaveView(!showSaveView)}
            className={`p-2 border rounded-xl transition-colors hidden sm:flex items-center gap-2 text-sm font-semibold ${
              showSaveView || savedViews.length > 0
                ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            <Bookmark size={18} />
            <span className="hidden lg:block">Saved Views</span>
            {savedViews.length > 0 && (
              <span className="bg-primary-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                {savedViews.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowNewTicketModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold shadow-md transition-colors"
          >
            <Plus size={16} />
            <span className="text-sm">New Ticket</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-white/30 dark:bg-surface-dark/30 shrink-0">
        <FilterBar tickets={tickets} />
      </div>

      {/* Triage Mode Banner */}
      {searchParams.get('filter') === 'triage' && (
        <div className="px-6 py-3 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800/40 shrink-0 flex items-center gap-3">
          <AlertTriangle size={16} className="text-orange-500 shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-bold text-orange-700 dark:text-orange-300">Triage Mode</span>
            <span className="text-sm text-orange-600 dark:text-orange-400 ml-2">
              Showing pending &amp; support-held tickets — sorted oldest first.
              {profile?.role === 'support_desk' && ' Assign or update status to clear the queue.'}
            </span>
          </div>
          <button
            onClick={() => { const p = new URLSearchParams(searchParams); p.delete('filter'); setSearchParams(p, { replace: true }); }}
            className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200 transition-colors px-2 py-1 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/40"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Saved Views Toolbar */}
      {(showSaveView || savedViews.length > 0) && (
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-surface-dark flex items-center gap-3 overflow-x-auto shadow-inner">
          {showSaveView && (
            <div className="flex items-center gap-2 border-r border-gray-200 dark:border-gray-700 pr-4 mr-1 shrink-0">
              <input
                autoFocus
                type="text"
                placeholder="Name this view..."
                value={newViewName}
                onChange={e => setNewViewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveView()}
                className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-dark text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 w-48"
              />
              <button 
                onClick={handleSaveView}
                disabled={!newViewName.trim()}
                className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors"
               >
                 <BookmarkPlus size={14} /> Save
              </button>
            </div>
          )}
          
          {savedViews.map(view => (
            <div key={view.id} className="flex items-center gap-1 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg pl-3 pr-1 py-1 shrink-0 group hover:border-primary-300 transition-colors shadow-sm">
              <button 
                onClick={() => applyView(view)}
                className="text-xs font-bold text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 truncate max-w-[150px]"
              >
                {view.name}
              </button>
              <button 
                onClick={() => removeView(view.id)}
                className="p-1 text-gray-400 hover:text-red-500 rounded-md transition-colors opacity-50 group-hover:opacity-100"
                title="Delete View"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {savedViews.length === 0 && !showSaveView && (
             <span className="text-sm text-gray-400 italic font-medium ml-2">Click "Saved Views" above to save the current filters.</span>
          )}
        </div>
      )}

      {/* Main Table Area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-800">
                  <th className="px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">ID</th>
                  <th className="px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider w-1/3">Title</th>
                  <th 
                    className="px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors whitespace-nowrap group"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-2">Status <span className="opacity-0 group-hover:opacity-100">↕</span></div>
                  </th>
                  <th 
                    className="px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors whitespace-nowrap group"
                    onClick={() => handleSort('priority')}
                  >
                    <div className="flex items-center gap-2">Priority <span className="opacity-0 group-hover:opacity-100">↕</span></div>
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Assignee</th>
                  <th 
                    className="px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors whitespace-nowrap group"
                    onClick={() => handleSort('updated_at')}
                  >
                    <div className="flex items-center gap-2">Last Updated {sortField === 'updated_at' && (sortOrder === 'desc' ? '↓' : '↑')}</div>
                  </th>
                </tr>
              </thead>
              
              {isLoading && tickets.length === 0 ? (
                <tbody>
                  {[...Array(8)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800/50">
                      <td className="px-5 py-4"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-64" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-6 w-24 rounded-full" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-6 w-24 rounded-full" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-28" /></td>
                    </tr>
                  ))}
                </tbody>
              ) : (
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                  {filteredTickets.length === 0 ? (
                     <tr>
                       <td colSpan={6} className="px-5 py-16 text-center text-gray-400">
                         No tickets found.
                       </td>
                     </tr>
                  ) : (
                    filteredTickets.map((ticket) => {
                      const status = statusConfig[ticket.status] || { label: ticket.status, className: '' };
                      const daysOld = differenceInDays(new Date(), new Date(ticket.created_at));
                      const isSlaBreached = ticket.status === 'pending' && daysOld > 3;

                      return (
                        <tr 
                          key={ticket.id} 
                          onClick={() => setActiveTicket(ticket)}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer transition-colors group"
                        >
                          <td className="px-5 py-4">
                            <span className="font-mono text-xs font-bold text-primary-600 dark:text-primary-400">
                              {ticket.readable_id}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span className={`shrink-0 w-2 h-2 rounded-full ${ticket.type === 'bug' ? 'bg-red-500' : 'bg-purple-500'}`} />
                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                {ticket.title}
                              </span>
                              {!ticket.is_blocked && isSlaBreached && (
                                <span title={`SLA Breach: ${daysOld} Days Pending`} className="shrink-0 flex items-center justify-center p-1 bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400 rounded-md">
                                  <AlertTriangle size={12} strokeWidth={3} />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${status.className}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${priorityColors[ticket.priority]}`}>
                              {ticket.priority}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {ticket.assignee ? (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                                  {ticket.assignee.full_name?.charAt(0) || ticket.assignee.email.charAt(0)}
                                </div>
                                <span className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[120px]">
                                  {ticket.assignee.full_name || ticket.assignee.email}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {format(new Date(ticket.updated_at), 'MMM d, yy')}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              )}
            </table>
          </div>

          {/* Load More */}
          {hasMore && !searchQuery && (
            <div className="flex justify-center py-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={loadMoreTickets}
                disabled={isLoadingMore}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <><Loader2 size={14} className="animate-spin" /> Loading...</>
                ) : (
                  `Load more tickets`
                )}
              </button>
            </div>
          )}
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
