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
      const { data, error } = await supabase
        .from('sla_policies')
        .select('*')
        .order('CASE priority WHEN \'critical\' THEN 1 WHEN \'high\' THEN 2 WHEN \'medium\' THEN 3 WHEN \'low\' THEN 4 END');

      if (error) {
        // Fallback ordering if the CASE expression isn't supported in order
        const { data: fallbackData, error: fallbackErr } = await supabase
          .from('sla_policies')
          .select('*');

        if (fallbackErr) throw fallbackErr;

        // Sort client-side
        const priorityOrder: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4 };
        const sorted = (fallbackData || []).sort((a, b) =>
          (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99)
        );
        set({ policies: sorted as SlaPolicy[] });
      } else {
        set({ policies: (data || []) as SlaPolicy[] });
      }
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
