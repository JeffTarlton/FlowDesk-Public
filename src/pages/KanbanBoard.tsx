import { useEffect, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import KanbanColumn from '../components/KanbanColumn';
import TicketCard from '../components/TicketCard';
import NewTicketModal from '../components/NewTicketModal';
import OnHoldModal from '../components/OnHoldModal';
import TicketDetailPanel from '../components/TicketDetailPanel';
import CustomerDropdown from '../components/CustomerDropdown';
import ProductDropdown from '../components/ProductDropdown';
import { useTicketStore } from '../store/useTicketStore';
import { useApprovalStore } from '../store/useApprovalStore';
import { COLUMNS, Ticket, TicketStatus } from '../types';
import { Plus, User } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Skeleton from '../components/Skeleton';

export default function KanbanBoard() {
  const { user } = useAuthStore();
  const { tickets, fetchTickets, updateTicketStatus, moveTicketOptimistically, subscribeToTickets, isLoading } = useTicketStore();
  const { fetchGates, canTransition } = useApprovalStore();
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [originalStatus, setOriginalStatus] = useState<TicketStatus | null>(null);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [pendingHoldTicketId, setPendingHoldTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterCustomer, setFilterCustomer] = useState('');
  const filterProduct = searchParams.get('product') || '';
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [assignees, setAssignees] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    fetchTickets();
    fetchGates();
    const unsubscribe = subscribeToTickets();
    
    const loadAssignees = async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, email').in('role', ['admin', 'developer', 'support_desk']);
      if (data) setAssignees(data.map((d: {id: string, full_name: string | null, email: string}) => ({id: d.id, name: d.full_name || d.email})));
    };
    loadAssignees();
    
    return () => {
      unsubscribe();
    };
  }, [fetchTickets, fetchGates, subscribeToTickets]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getTicketsByColumnId = (colId: string) => {
    const col = COLUMNS.find(c => c.id === colId);
    if (!col) return [];
    return tickets.filter((t) => {
      if (!col.mappedStatuses.includes(t.status) && t.status !== colId) return false;
      if (filterCustomer && t.customer_name?.trim() !== filterCustomer) return false;
      if (filterProduct && t.product_id !== filterProduct && t.product?.id !== filterProduct) return false;
      if (filterAssignee && filterAssignee !== 'unassigned' && t.assigned_to !== filterAssignee) return false;
      if (filterAssignee === 'unassigned' && t.assigned_to) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      return true;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const ticket = tickets.find((t) => t.id === active.id);
    if (ticket) {
      setActiveTicket(ticket);
      setOriginalStatus(ticket.status as TicketStatus);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const isActiveColumn = active.data.current?.type === 'Column';
    if (isActiveColumn) return;

    const isOverTicket = over.data.current?.type !== 'Column';
    const isOverColumn = over.data.current?.type === 'Column';

    let overStatus: string | null = null;

    if (isOverTicket) {
      const overTicket = tickets.find((t) => t.id === overId);
      if (overTicket) {
        const parentCol = COLUMNS.find(c => c.mappedStatuses.includes(overTicket.status as any));
        overStatus = parentCol ? parentCol.id : overTicket.status;
      }
    } else if (isOverColumn) {
      overStatus = over.data.current?.columnId as string;
    }

    if (activeTicket && overStatus && activeTicket.status !== overStatus) {
      // DON'T optimistically move to 'on_hold' — it's a virtual column, not a real DB status.
      // The OnHoldModal in handleDragEnd will pick the correct sub-status.
      if (overStatus === 'on_hold') return;

      const isCurrentlyMapped = COLUMNS.find(c => c.id === overStatus)?.mappedStatuses.includes(activeTicket.status as any);
      if (!isCurrentlyMapped) {
        moveTicketOptimistically(activeId, overStatus as TicketStatus);
        setActiveTicket({ ...activeTicket, status: overStatus as TicketStatus });
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      setActiveTicket(null);
      return;
    }

    const activeId = active.id as string;
    let newStatus: string | null = null;

    if (over.data.current?.type === 'Column') {
      newStatus = over.data.current.columnId as string;
    } else {
      const overTicket = tickets.find((t) => t.id === over.id);
      if (overTicket) {
        const parentCol = COLUMNS.find(c => c.mappedStatuses.includes(overTicket.status as any));
        newStatus = parentCol ? parentCol.id : overTicket.status;
      }
    }

    if (newStatus && originalStatus && originalStatus !== newStatus) {
      const isAlreadyMapped = COLUMNS.find(c => c.id === newStatus)?.mappedStatuses.includes(originalStatus as any);
      if (isAlreadyMapped) {
        setActiveTicket(null);
        setOriginalStatus(null);
        return;
      }

      if (newStatus === 'done' && (!activeTicket || !activeTicket.acceptance_criteria)) {
        toast.error('Cannot move to Done. Acceptance Criteria is required.');
        fetchTickets(); // reset optimistic UI
        setActiveTicket(null);
        setOriginalStatus(null);
        return;
      }
      
      if (newStatus === 'on_hold') {
        setPendingHoldTicketId(activeId);
        setActiveTicket(null);
        setOriginalStatus(null);
        return;
      }

      // Check approval gates before allowing the transition. handleDragOver has already moved the
      // dragged card (and activeTicket) to the new column, so check from the status it started in.
      if (activeTicket) {
        const check = canTransition({ ...activeTicket, status: originalStatus }, newStatus as TicketStatus);
        if (!check.allowed) {
          toast.error(check.reason || 'Transition blocked by approval gate.');
          fetchTickets(); // reset optimistic UI
          setActiveTicket(null);
          setOriginalStatus(null);
          return;
        }
      }

      updateTicketStatus(activeId, newStatus as TicketStatus);
    }

    setActiveTicket(null);
    setOriginalStatus(null);
  };

  return (
    <div className="h-full flex flex-col">
      {pendingHoldTicketId && (
        <OnHoldModal 
          onClose={() => {
            setPendingHoldTicketId(null);
            fetchTickets(); // reset optimistic move
          }}
          onSelectCategory={(status) => {
            updateTicketStatus(pendingHoldTicketId, status);
            setPendingHoldTicketId(null);
          }}
        />
      )}
      {showNewTicketModal && (
        <NewTicketModal onClose={() => setShowNewTicketModal(false)} />
      )}
      {selectedTicket && (
        <TicketDetailPanel 
          ticket={tickets.find(t => t.id === selectedTicket.id) || selectedTicket} 
          onClose={() => setSelectedTicket(null)} 
        />
      )}

      {/* Board Header & Actions */}
      <div className="flex justify-between items-center mb-8 px-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">Projects</h1>
          <div className="flex gap-2 text-sm text-gray-500 font-medium">
            <span>FlowDesk</span>
            <span>/</span>
            <span className="text-primary-600">Kanban Board</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ProductDropdown 
            value={filterProduct} 
            onChange={(val) => {
              const next = new URLSearchParams(searchParams);
              if (val) next.set('product', val);
              else next.delete('product');
              setSearchParams(next, { replace: true });
            }} 
          />
          <CustomerDropdown 
            value={filterCustomer} 
            onChange={setFilterCustomer} 
          />
          {/* Assigned To Me Quick Toggle */}
          <button
            onClick={() => {
              if (user) {
                setFilterAssignee(filterAssignee === user.id ? '' : user.id);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl border transition-colors ${
              user && filterAssignee === user.id 
                ? 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-800'
                : 'bg-white dark:bg-surface-dark text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <User size={14} /> Me
          </button>

          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          <select
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
            className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Assignees</option>
            <option value="unassigned">Unassigned</option>
            {assignees.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowNewTicketModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold shadow-md transition-colors ml-2"
          >
            <Plus size={16} />
            <span className="text-sm">New Ticket</span>
          </button>
        </div>
      </div>

      {/* Board columns wrapper */}
      <div className="flex-1 overflow-x-auto pb-4">
        {isLoading && tickets.length === 0 ? (
          <div className="flex gap-6 h-full items-start">
            {COLUMNS.map((col) => (
              <div key={col.id} className="w-80 shrink-0 bg-gray-50/50 dark:bg-surface-dark/50 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-6 h-6 rounded-full" />
                    <Skeleton className="w-24 h-5" />
                  </div>
                  <Skeleton className="w-6 h-6 rounded-full" />
                </div>
                <Skeleton className="w-full h-32 rounded-xl" />
                <Skeleton className="w-full h-24 rounded-xl" />
                <Skeleton className="w-full h-28 rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-6 h-full items-start">
              {COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.id}
                  column={col as any}
                  tickets={getTicketsByColumnId(col.id)}
                  onTicketClick={(t) => setSelectedTicket(t)}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTicket ? <TicketCard ticket={activeTicket} /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}
