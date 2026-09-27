import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Ticket, TicketStatus } from '../types';
import { useApprovalStore } from './useApprovalStore';
import toast from 'react-hot-toast';

const PAGE_SIZE = 50;

// Track the active ticket realtime channel at module scope
let activeTicketChannel: ReturnType<typeof supabase.channel> | null = null;

interface TicketState {
  tickets: Ticket[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  page: number;
  fetchTickets: () => Promise<void>;
  loadMoreTickets: () => Promise<void>;
  updateTicketStatus: (ticketId: string, newStatus: TicketStatus) => Promise<void>;
  moveTicketOptimistically: (ticketId: string, newStatus: TicketStatus) => void;
  deleteTicket: (ticketId: string) => Promise<void>;
  updateTicketFields: (ticketId: string, updates: Partial<Ticket>) => Promise<void>;
  subscribeToTickets: () => (() => void);
  resubscribeToTickets: () => void;
  addWatcher: (ticketId: string, userId: string) => Promise<void>;
  removeWatcher: (ticketId: string, userId: string) => Promise<void>;
  approveTicket: (ticketId: string, approvalType: 'admin' | 'customer') => Promise<void>;
  revokeApproval: (ticketId: string, approvalType: 'admin' | 'customer') => Promise<void>;
}

export const useTicketStore = create<TicketState>((set, get) => ({
  tickets: [],
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,
  page: 0,

  fetchTickets: async () => {
    set({ isLoading: true, page: 0 });
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`*, assignee:profiles!tickets_assigned_to_fkey(*), product:products(*), watchers:ticket_watchers(user_id)`)
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);

      if (error) throw error;
      set({
        tickets: data as Ticket[],
        hasMore: data.length === PAGE_SIZE,
        page: 1,
      });
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  loadMoreTickets: async () => {
    const { page, isLoadingMore, hasMore } = get();
    if (isLoadingMore || !hasMore) return;
    set({ isLoadingMore: true });
    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from('tickets')
        .select(`*, assignee:profiles!tickets_assigned_to_fkey(*), product:products(*), watchers:ticket_watchers(user_id)`)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      set((state) => ({
        tickets: [...state.tickets, ...(data as Ticket[])],
        hasMore: data.length === PAGE_SIZE,
        page: state.page + 1,
      }));
    } catch (err) {
      console.error('Error loading more tickets:', err);
    } finally {
      set({ isLoadingMore: false });
    }
  },

  moveTicketOptimistically: (ticketId, newStatus) => {
    set((state) => ({
      tickets: state.tickets.map((t) =>
        t.id === ticketId ? { ...t, status: newStatus } : t
      ),
    }));
  },

  updateTicketStatus: async (ticketId, newStatus) => {
    const previousTickets = get().tickets;
    const ticket = previousTickets.find(t => t.id === ticketId);

    // Check approval gates before allowing transition
    if (ticket) {
      const { canTransition } = useApprovalStore.getState();
      const check = canTransition(ticket, newStatus);
      if (!check.allowed) {
        toast.error(check.reason || 'Transition blocked by approval gate.');
        return;
      }
    }

    get().moveTicketOptimistically(ticketId, newStatus);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('tickets').update({ status: newStatus }).eq('id', ticketId);
      if (error) throw error;

      if (user) {
        const statusString = newStatus.replace(/_/g, ' ');
        const displayStatus = statusString.charAt(0).toUpperCase() + statusString.slice(1);
        await supabase.from('activity_logs').insert({
          ticket_id: ticketId,
          actor_id: user.id,
          // The ticket feed renders actions as (sanitised) HTML, not Markdown
          action: `Moved request to <strong>${displayStatus}</strong>`
        });
      }
    } catch (err: any) {
      console.error('Failed to update ticket status', err);
      toast.error(err.message || 'Failed to update ticket status');
      set({ tickets: previousTickets });
    }
  },

  deleteTicket: async (ticketId) => {
    const previousTickets = get().tickets;
    set({ tickets: previousTickets.filter(t => t.id !== ticketId) });
    try {
      const { error } = await supabase.from('tickets').delete().eq('id', ticketId);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to delete ticket', err);
      set({ tickets: previousTickets });
    }
  },

  updateTicketFields: async (ticketId, updates) => {
    // Optimistic update
    set((state) => ({
      tickets: state.tickets.map((t) =>
        t.id === ticketId ? { ...t, ...updates } : t
      ),
    }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('tickets').update(updates).eq('id', ticketId);
      if (error) throw error;

      if (user && 'assigned_to' in updates) {
        await supabase.from('activity_logs').insert({
          ticket_id: ticketId,
          actor_id: user.id,
          action: updates.assigned_to ? `Assigned ticket` : `Unassigned ticket`
        });
      }
    } catch (err) {
      console.error('Failed to update fields', err);
      // Re-fetch to reconcile any drift
      get().fetchTickets();
    }
  },

  subscribeToTickets: () => {
    // Clean up any stale channel before creating a new one
    if (activeTicketChannel) {
      supabase.removeChannel(activeTicketChannel);
      activeTicketChannel = null;
    }

    const channel = supabase.channel('public:tickets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload as any;

          if (eventType === 'DELETE') {
            set((state) => ({
              tickets: state.tickets.filter((t) => t.id !== oldRecord.id),
            }));
          } else if (eventType === 'UPDATE') {
            // Patch in-place — don't re-fetch the entire list
            set((state) => ({
              tickets: state.tickets.map((t) =>
                t.id === newRecord.id ? { ...t, ...newRecord } : t
              ),
            }));
          } else if (eventType === 'INSERT') {
            // Only prepend if it isn't already in the list (avoids duplicates from optimistic updates)
            set((state) => {
              const exists = state.tickets.some((t) => t.id === newRecord.id);
              if (exists) return state;
              return { tickets: [newRecord as Ticket, ...state.tickets] };
            });
          }
        }
      )
      .subscribe();

    activeTicketChannel = channel;

    return () => {
      if (activeTicketChannel) {
        supabase.removeChannel(activeTicketChannel);
        activeTicketChannel = null;
      }
    };
  },

  addWatcher: async (ticketId, userId) => {
    // Optimistic update
    set((state) => ({
      tickets: state.tickets.map((t) => {
        if (t.id === ticketId) {
          const watchers = t.watchers || [];
          if (!watchers.some(w => w.user_id === userId)) {
            return { ...t, watchers: [...watchers, { user_id: userId }] };
          }
        }
        return t;
      }),
    }));
    try {
      const { error } = await supabase.from('ticket_watchers').insert({ ticket_id: ticketId, user_id: userId });
      if (error) throw error;
    } catch (err: any) {
      console.error('Failed to add watcher', err);
      toast.error(err.message || 'Failed to add watcher');
      get().fetchTickets(); // Revert on failure
    }
  },

  removeWatcher: async (ticketId, userId) => {
    // Optimistic update
    set((state) => ({
      tickets: state.tickets.map((t) => {
        if (t.id === ticketId) {
          return { ...t, watchers: (t.watchers || []).filter(w => w.user_id !== userId) };
        }
        return t;
      }),
    }));
    try {
      const { error } = await supabase.from('ticket_watchers').delete().match({ ticket_id: ticketId, user_id: userId });
      if (error) throw error;
    } catch (err: any) {
      console.error('Failed to remove watcher', err);
      toast.error(err.message || 'Failed to remove watcher');
      get().fetchTickets(); // Revert on failure
    }
  },

  /**
   * Tear down and re-create the ticket realtime channel.
   * Called by useSessionRecovery when the tab regains focus after idle.
   */
  resubscribeToTickets: () => {
    console.info('[TicketStore] Re-subscribing to tickets channel.');
    get().subscribeToTickets();
  },

  approveTicket: async (ticketId, approvalType) => {
    const field = approvalType === 'admin' ? 'admin_approved' : 'customer_approved';
    // Optimistic
    set((state) => ({
      tickets: state.tickets.map(t =>
        t.id === ticketId ? { ...t, [field]: true } : t
      ),
    }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('tickets').update({ [field]: true }).eq('id', ticketId);
      if (error) throw error;
      if (user) {
        await supabase.from('activity_logs').insert({
          ticket_id: ticketId,
          actor_id: user.id,
          action: `Granted <strong>${approvalType === 'admin' ? 'Admin' : 'Customer'}</strong> approval`
        });
      }
      toast.success(`${approvalType === 'admin' ? 'Admin' : 'Customer'} approval granted`);
    } catch (err: any) {
      console.error('Failed to approve ticket:', err);
      toast.error(err.message || 'Failed to approve');
      get().fetchTickets();
    }
  },

  revokeApproval: async (ticketId, approvalType) => {
    const field = approvalType === 'admin' ? 'admin_approved' : 'customer_approved';
    // Optimistic
    set((state) => ({
      tickets: state.tickets.map(t =>
        t.id === ticketId ? { ...t, [field]: false } : t
      ),
    }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('tickets').update({ [field]: false }).eq('id', ticketId);
      if (error) throw error;
      if (user) {
        await supabase.from('activity_logs').insert({
          ticket_id: ticketId,
          actor_id: user.id,
          action: `Revoked <strong>${approvalType === 'admin' ? 'Admin' : 'Customer'}</strong> approval`
        });
      }
      toast.success(`${approvalType === 'admin' ? 'Admin' : 'Customer'} approval revoked`);
    } catch (err: any) {
      console.error('Failed to revoke approval:', err);
      toast.error(err.message || 'Failed to revoke');
      get().fetchTickets();
    }
  },
}));
