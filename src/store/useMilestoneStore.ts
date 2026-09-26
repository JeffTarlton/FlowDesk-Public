import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export interface Milestone {
  id: string;
  name: string;
  description: string | null;
  target_date: string | null;
  status: 'open' | 'in_progress' | 'completed';
  product_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** computed in store from joined tickets */
  ticket_count?: number;
  completed_count?: number;
}

interface MilestoneState {
  milestones: Milestone[];
  isLoading: boolean;
  fetchMilestones: () => Promise<void>;
  createMilestone: (m: Pick<Milestone, 'name' | 'description' | 'target_date' | 'product_id'>) => Promise<void>;
  updateMilestone: (id: string, updates: Partial<Pick<Milestone, 'name' | 'description' | 'target_date' | 'status' | 'product_id'>>) => Promise<void>;
  deleteMilestone: (id: string) => Promise<void>;
}

export const useMilestoneStore = create<MilestoneState>((set, get) => ({
  milestones: [],
  isLoading: false,

  fetchMilestones: async () => {
    set({ isLoading: true });
    try {
      // Fetch milestones
      const { data, error } = await supabase
        .from('milestones')
        .select('*')
        .order('target_date', { ascending: true, nullsFirst: false });
      if (error) throw error;

      // Fetch ticket counts per milestone
      const { data: ticketData } = await supabase
        .from('tickets')
        .select('milestone_id, status')
        .not('milestone_id', 'is', null);

      const milestones = (data || []).map((m: any) => {
        const mTickets = (ticketData || []).filter((t: any) => t.milestone_id === m.id);
        return {
          ...m,
          ticket_count: mTickets.length,
          completed_count: mTickets.filter((t: any) => t.status === 'done').length,
        };
      });

      set({ milestones: milestones as Milestone[] });
    } catch (err) {
      console.error('Error fetching milestones:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  createMilestone: async (m) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('milestones')
        .insert({ ...m, created_by: user?.id || null });
      if (error) throw error;
      toast.success('Milestone created');
      get().fetchMilestones();
    } catch (err: any) {
      console.error('Error creating milestone:', err);
      toast.error(err.message || 'Failed to create milestone');
    }
  },

  updateMilestone: async (id, updates) => {
    const prev = get().milestones;
    set({ milestones: prev.map(m => m.id === id ? { ...m, ...updates } : m) });
    try {
      const { error } = await supabase.from('milestones').update(updates).eq('id', id);
      if (error) throw error;
      toast.success('Milestone updated');
    } catch (err: any) {
      console.error('Error updating milestone:', err);
      toast.error(err.message || 'Failed to update milestone');
      set({ milestones: prev });
    }
  },

  deleteMilestone: async (id) => {
    const prev = get().milestones;
    set({ milestones: prev.filter(m => m.id !== id) });
    try {
      const { error } = await supabase.from('milestones').delete().eq('id', id);
      if (error) throw error;
      toast.success('Milestone deleted');
    } catch (err: any) {
      console.error('Error deleting milestone:', err);
      toast.error(err.message || 'Failed to delete milestone');
      set({ milestones: prev });
    }
  },
}));
