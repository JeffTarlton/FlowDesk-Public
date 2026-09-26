import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { ApprovalGate, Ticket } from '../types';
import toast from 'react-hot-toast';

interface ApprovalCheckResult {
  allowed: boolean;
  reason: string | null;
  requiresAdmin: boolean;
  requiresCustomer: boolean;
}

interface ApprovalState {
  gates: ApprovalGate[];
  isLoading: boolean;
  fetchGates: () => Promise<void>;
  updateGate: (id: string, updates: Partial<Pick<ApprovalGate, 'requires_admin_approval' | 'requires_customer_approval' | 'is_active'>>) => Promise<void>;
  createGate: (gate: Pick<ApprovalGate, 'from_status' | 'to_status' | 'requires_admin_approval' | 'requires_customer_approval'>) => Promise<void>;
  deleteGate: (id: string) => Promise<void>;
  /**
   * Check if a ticket can transition from its current status to a new status.
   * Returns whether it's allowed and why not if blocked.
   */
  canTransition: (ticket: Ticket, newStatus: string) => ApprovalCheckResult;
}

export const useApprovalStore = create<ApprovalState>((set, get) => ({
  gates: [],
  isLoading: false,

  fetchGates: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('approval_gates')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      set({ gates: (data || []) as ApprovalGate[] });
    } catch (err) {
      console.error('Error fetching approval gates:', err);
      toast.error('Failed to load approval gates');
    } finally {
      set({ isLoading: false });
    }
  },

  updateGate: async (id, updates) => {
    const prev = get().gates;
    set({ gates: prev.map(g => g.id === id ? { ...g, ...updates } : g) });
    try {
      const { error } = await supabase
        .from('approval_gates')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
      toast.success('Approval gate updated');
    } catch (err: any) {
      console.error('Error updating approval gate:', err);
      toast.error(err.message || 'Failed to update gate');
      set({ gates: prev });
    }
  },

  createGate: async (gate) => {
    try {
      const { error } = await supabase
        .from('approval_gates')
        .insert(gate);
      if (error) throw error;
      toast.success('Approval gate created');
      get().fetchGates();
    } catch (err: any) {
      console.error('Error creating approval gate:', err);
      toast.error(err.message || 'Failed to create gate');
    }
  },

  deleteGate: async (id) => {
    const prev = get().gates;
    set({ gates: prev.filter(g => g.id !== id) });
    try {
      const { error } = await supabase
        .from('approval_gates')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Approval gate removed');
    } catch (err: any) {
      console.error('Error deleting approval gate:', err);
      toast.error(err.message || 'Failed to delete gate');
      set({ gates: prev });
    }
  },

  canTransition: (ticket, newStatus) => {
    const { gates } = get();
    const currentStatus = ticket.status;

    // Find matching active gate
    const gate = gates.find(
      g => g.is_active && g.from_status === currentStatus && g.to_status === newStatus
    );

    // No gate = always allowed
    if (!gate) {
      return { allowed: true, reason: null, requiresAdmin: false, requiresCustomer: false };
    }

    const needsAdmin = gate.requires_admin_approval && !ticket.admin_approved;
    const needsCustomer = gate.requires_customer_approval && !ticket.customer_approved;

    if (needsAdmin && needsCustomer) {
      return {
        allowed: false,
        reason: 'Both Admin and Customer approval are required before this transition.',
        requiresAdmin: true,
        requiresCustomer: true,
      };
    }
    if (needsAdmin) {
      return {
        allowed: false,
        reason: 'Admin approval is required before this transition.',
        requiresAdmin: true,
        requiresCustomer: false,
      };
    }
    if (needsCustomer) {
      return {
        allowed: false,
        reason: 'Customer approval is required before this transition.',
        requiresAdmin: false,
        requiresCustomer: true,
      };
    }

    return { allowed: true, reason: null, requiresAdmin: false, requiresCustomer: false };
  },
}));
