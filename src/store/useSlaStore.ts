import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { SlaPolicy } from '../types';
import toast from 'react-hot-toast';

interface SlaState {
  policies: SlaPolicy[];
  isLoading: boolean;
  fetchPolicies: () => Promise<void>;
  updatePolicy: (id: string, updates: Partial<Pick<SlaPolicy, 'response_time_hours' | 'resolution_time_hours' | 'is_active'>>) => Promise<void>;
}

export const useSlaStore = create<SlaState>((set, get) => ({
  policies: [],
  isLoading: false,

  fetchPolicies: async () => {
    set({ isLoading: true });
    try {
      // PostgREST can only order by columns, so sort by severity here
      // (critical, high, medium, low).
      const { data, error } = await supabase
        .from('sla_policies')
        .select('*');

      if (error) throw error;

      const priorityOrder: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4 };
      const sorted = (data || []).sort((a, b) =>
        (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99)
      );
      set({ policies: sorted as SlaPolicy[] });
    } catch (err) {
      console.error('Error fetching SLA policies:', err);
      toast.error('Failed to load SLA policies');
    } finally {
      set({ isLoading: false });
    }
  },

  updatePolicy: async (id, updates) => {
    const prev = get().policies;
    // Optimistic
    set({
      policies: prev.map(p => p.id === id ? { ...p, ...updates } : p),
    });
    try {
      const { error } = await supabase
        .from('sla_policies')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
      toast.success('SLA policy updated');
    } catch (err: any) {
      console.error('Error updating SLA policy:', err);
      toast.error(err.message || 'Failed to update SLA policy');
      set({ policies: prev }); // Rollback
    }
  },
}));
