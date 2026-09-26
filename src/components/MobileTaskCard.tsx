import { Ticket } from '../types';
import { Bug, CircleDashed, BookOpen, Rocket, Zap, Briefcase } from 'lucide-react';


interface MobileTaskCardProps {
  ticket: Ticket;
  onClick: (ticket: Ticket) => void;
}

export default function MobileTaskCard({ ticket, onClick }: MobileTaskCardProps) {
  // Get an appropriate icon based on ticket type or priority
  const getTypeIcon = () => {
    switch (ticket.type) {
      case 'bug': return <Bug size={16} className="text-red-500" />;
      case 'feature_request': return <Rocket size={16} className="text-purple-500" />;
      case 'improvement': return <Zap size={16} className="text-blue-500" />;
      case 'documentation': return <BookOpen size={16} className="text-gray-500 dark:text-gray-400" />;
      case 'professional_service': return <Briefcase size={16} className="text-orange-500" />;
      default: return <CircleDashed size={16} className="text-primary-500" />;
    }
  };

  const getStatusDisplay = () => {
    // Basic mapping, you might want a distinct pill component here
    const statusMap: Record<string, string> = {
      pending: 'NEW REQUEST',
      ready_for_dev: 'TO DO',
      dev_in_progress: 'IN PROGRESS',
      in_review: 'IN REVIEW',
      beta_testing: 'UAT',
      done: 'DONE',
      rejected: 'REJECTED'
    };
    
    // Check if it's on hold
    if (ticket.status.startsWith('on_hold')) {
      return 'ON HOLD';
    }
    
    return statusMap[ticket.status] || ticket.status.replace(/_/g, ' ').toUpperCase();
  };

  const getStatusColorClass = () => {
    if (ticket.status === 'done') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (ticket.status.startsWith('on_hold') || ticket.status === 'rejected') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (ticket.status === 'dev_in_progress' || ticket.status === 'in_review') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    if (ticket.status === 'beta_testing') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'; // Default, TO DO
  };

  // Build subtext from ticket details, e.g. "Bug • Acme Corp • FLD-0012"
  const subtext = [
    ticket.type.replace('_', ' ').charAt(0).toUpperCase() + ticket.type.replace('_', ' ').slice(1),
    ticket.customer_name || 'Internal',
    ticket.readable_id
  ].filter(Boolean).join(' • ');

  return (
    <div 
      onClick={() => onClick(ticket)}
      className="bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center justify-center min-w-8 min-h-8 w-8 h-8 rounded-xl bg-gray-50 dark:bg-canvas-dark">
          {getTypeIcon()}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate line-clamp-2 leading-tight">
            {ticket.title}
          </h3>
        </div>
        <div className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wider shrink-0 ${getStatusColorClass()}`}>
          {getStatusDisplay()}
        </div>
      </div>
      
      <div className="flex items-center gap-2 mt-3 ml-11">
        {ticket.product && (
          <span 
            className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0"
            style={{ backgroundColor: ticket.product.color }}
          >
            {ticket.product.name}
          </span>
        )}
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">
          {subtext}
        </span>
      </div>
    </div>
  );
}
