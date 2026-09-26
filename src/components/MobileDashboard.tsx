import { useState, useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useTicketStore } from '../store/useTicketStore';
import MobileTaskCard from './MobileTaskCard';
import CustomerDropdown from './CustomerDropdown';
import TicketDetailPanel from './TicketDetailPanel';
import { Sparkles, Filter } from 'lucide-react';
import { Ticket } from '../types';

export default function MobileDashboard() {
  const { profile } = useAuthStore();
  const { tickets } = useTicketStore();


  const [customerFilter, setCustomerFilter] = useState('');
  const [myTicketsOnly, setMyTicketsOnly] = useState(false);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  const filteredTickets = useMemo(() => {
    let filtered = [...tickets];

    if (customerFilter) {
      filtered = filtered.filter(t => t.customer_name?.trim() === customerFilter);
    }

    if (myTicketsOnly && profile) {
      filtered = filtered.filter(t => t.assigned_to === profile.id);
    }



    // Sort by created at descending
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [tickets, customerFilter, myTicketsOnly, profile]);

  return (
    <div className="flex flex-col h-full bg-canvas dark:bg-canvas-dark overflow-x-hidden relative">
      {/* Header Area */}
      <div className="px-5 pt-10 pb-6 shrink-0">
        <div className="flex justify-center mb-6">
          <div className="text-amber-400">
            <Sparkles size={24} className="animate-pulse" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center tracking-tight leading-snug mb-8">
          Hi, {profile?.full_name?.split(' ')[0] || 'User'}. What are we<br/>working on today?
        </h1>


      </div>

      {/* Filters */}
      <div className="px-5 pb-4 shrink-0 flex items-center justify-between z-10 sticky top-0 bg-canvas dark:bg-canvas-dark pt-2">
        <CustomerDropdown 
          value={customerFilter} 
          onChange={setCustomerFilter} 
          className="bg-white/80 dark:bg-surface-dark/80 backdrop-blur-md !rounded-xl !py-2 !text-xs !font-medium"
        />
        
        <button
          onClick={() => setMyTicketsOnly(!myTicketsOnly)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
            myTicketsOnly 
              ? 'bg-primary-500 text-white shadow-sm' 
              : 'bg-white dark:bg-surface-dark text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-800'
          }`}
        >
          <Filter size={14} />
          My Tickets
        </button>
      </div>

      {/* Ticket List */}
      <div className="flex-1 overflow-y-auto px-5 pb-24 space-y-3">
        {filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <Sparkles size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium pb-2">No tickets found.</p>
            <p className="text-sm text-gray-400">Try adjusting your filters.</p>
          </div>
        ) : (
          filteredTickets.map(ticket => (
            <MobileTaskCard 
              key={ticket.id} 
              ticket={ticket} 
              onClick={() => setActiveTicket(ticket)} 
            />
          ))
        )}
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
