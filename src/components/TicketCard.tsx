import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Ticket } from '../types';
import { MessageSquare, MoreHorizontal, User, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../store/useAuthStore';
import SlaBadge from './SlaBadge';

interface Props {
  ticket: Ticket;
  onClick?: () => void;
}

export default function TicketCard({ ticket, onClick }: Props) {
  const { profile } = useAuthStore();
  const isBranchManager = profile?.role === 'branch_manager';

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.id, data: { status: ticket.status }, disabled: isBranchManager });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityColors = {
    low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const onHoldStyles: Record<string, string> = {
    on_hold_customer: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    on_hold_dev:      'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    on_hold_support:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    on_hold_sow:      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  };

  const onHoldLabels: Record<string, string> = {
    on_hold_customer: 'Hold: Customer',
    on_hold_dev:      'Hold: Dev',
    on_hold_support:  'Hold: Support',
    on_hold_sow:      'Hold: SOW',
  };



  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging && onClick) onClick();
      }}
      className={`group relative bg-white dark:bg-surface-dark p-5 rounded-[1.25rem] shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md hover:border-primary-100 transition-all ${
        isBranchManager ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${
        isDragging ? 'opacity-50 z-50 ring-2 ring-primary-500 scale-105 shadow-xl' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            {ticket.readable_id}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${priorityColors[ticket.priority]}`}>
            {ticket.priority.toUpperCase()}
          </span>
          {ticket.parent_ticket_id && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 capitalize whitespace-nowrap">
              <span className="opacity-60 mr-1">↳</span>Dev Task
            </span>
          )}
          {ticket.status.startsWith('on_hold_') && (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${onHoldStyles[ticket.status] || ''}`}>
              {onHoldLabels[ticket.status] || 'On-Hold'}
            </span>
          )}
        </div>
        <button className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
          <MoreHorizontal size={18} />
        </button>
      </div>
      
      {ticket.is_blocked && (
        <div className="mb-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 uppercase tracking-widest border border-red-200 dark:border-red-800 shadow-sm animate-pulse-fade-in">
            <ShieldAlert size={12} /> Blocked
          </span>
        </div>
      )}

      {!ticket.is_blocked && ticket.status !== 'done' && (
        <div className="mb-2">
          <SlaBadge
            responseDeadline={ticket.sla_response_deadline}
            resolutionDeadline={ticket.sla_resolution_deadline}
            responseBreach={ticket.sla_response_breached}
            resolutionBreach={ticket.sla_resolution_breached}
            firstRespondedAt={ticket.first_responded_at}
            status={ticket.status}
            variant="badge"
          />
        </div>
      )}

      {ticket.product && (
        <div className="mb-2">
          <span 
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest text-white shadow-sm" 
            style={{ backgroundColor: ticket.product.color }}
          >
            {ticket.product.name}
          </span>
        </div>
      )}
      
      <h3 className="font-semibold text-lg text-gray-900 dark:text-white hover:text-primary-600 transition-colors line-clamp-2 leading-tight mb-2">
        {ticket.title}
      </h3>
      
      {ticket.description && (
        <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
          {ticket.description.replace(/<[^>]*>?/gm, '')}
        </div>
      )}

      <div className="flex items-center justify-between mt-4">
        {/* Avatars */}
        <div className="flex -space-x-2">
          {ticket.assignee ? (
            <div className="w-8 h-8 rounded-full bg-primary-100 border-2 border-white dark:border-surface-dark flex items-center justify-center text-primary-700 text-xs font-bold uppercase z-10">
              {(ticket.assignee.full_name || ticket.assignee.email || '?').charAt(0)}
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white dark:border-surface-dark flex items-center justify-center text-gray-500 z-10">
              <User size={14} />
            </div>
          )}
        </div>

        {/* Action icons */}
        <div className="flex gap-3 text-gray-400">
          <div className="flex items-center gap-1.5 hover:text-gray-600 transition-colors bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-md">
            <MessageSquare size={14} />
            <span className="text-xs font-medium">{ticket.notes?.length || 0}</span>
          </div>
          <div className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-md flex items-center">
            {format(new Date(ticket.created_at), 'MMM d')}
          </div>
        </div>
      </div>

    </div>
  );
}
