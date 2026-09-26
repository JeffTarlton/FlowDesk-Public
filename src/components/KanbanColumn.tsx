import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Ticket, TicketStatus } from '../types';
import TicketCard from './TicketCard';
import { Inbox, Plus } from 'lucide-react';

interface Props {
  column: {
    id: TicketStatus | 'on_hold';
    label: string;
    mappedStatuses: TicketStatus[];
  };
  tickets: Ticket[];
  onTicketClick: (ticket: Ticket) => void;
}

export default function KanbanColumn({ column, tickets, onTicketClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: 'Column',
      columnId: column.id,
    },
  });

  return (
    <div 
      className={`flex flex-col min-w-[320px] max-w-[320px] shrink-0 bg-transparent h-full transition-colors ${
        isOver ? 'bg-gray-100/50 dark:bg-gray-800/30 rounded-2xl' : ''
      }`}
    >
      <div className="flex items-center justify-between px-2 mb-4">
        <h2 className="font-semibold text-lg flex items-center gap-2 text-gray-900 dark:text-white">
          {column.label}
          <span className="text-sm font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
            {tickets.length}
          </span>
        </h2>
        <button className="text-gray-400 hover:text-gray-700 transition-colors p-1.5 rounded-md hover:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-transparent border border-transparent hover:border-gray-200">
           <Plus size={16} />
        </button>
      </div>

      <div 
        ref={setNodeRef} 
        className="flex-1 flex flex-col gap-4 px-2 pb-4 overflow-y-auto custom-scrollbar"
        style={{ minHeight: '150px' }}
      >
        <SortableContext
          items={tickets.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} onClick={() => onTicketClick(ticket)} />
          ))}
        </SortableContext>
        
        {/* Placeholder if empty */}
        {tickets.length === 0 && (
          <div className="flex-1 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col items-center justify-center text-gray-400 gap-2 min-h-[140px] opacity-70 hover:opacity-100 transition-opacity bg-gray-50/50 dark:bg-surface-dark/50">
            <Inbox size={24} className="text-gray-300 dark:text-gray-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Drop Ticket</span>
          </div>
        )}
      </div>
    </div>
  );
}
