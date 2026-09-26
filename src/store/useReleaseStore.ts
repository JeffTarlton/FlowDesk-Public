import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export interface Release {
  id: string;
  version: string;
  name: string | null;
  description: string | null;
  status: 'planned' | 'in_progress' | 'staged' | 'released' | 'rolled_back';
  release_date: string | null;
  product_id: string | null;
  milestone_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Computed: tickets assigned to this release */
  ticket_count?: number;
  tickets?: { id: string; readable_id: string; title: string; status: string }[];
}

interface ReleaseState {
  releases: Release[];
  isLoading: boolean;
  fetchReleases: () => Promise<void>;
  createRelease: (r: Pick<Release, 'version' | 'name' | 'description' | 'release_date' | 'product_id' | 'milestone_id'>) => Promise<void>;
  updateRelease: (id: string, updates: Partial<Pick<Release, 'version' | 'name' | 'description' | 'status' | 'release_date' | 'product_id' | 'milestone_id'>>) => Promise<void>;
  deleteRelease: (id: string) => Promise<void>;
  addTicketToRelease: (releaseId: string, ticketId: string) => Promise<void>;
  removeTicketFromRelease: (releaseId: string, ticketId: string) => Promise<void>;
  fetchReleaseTickets: (releaseId: string) => Promise<{ id: string; readable_id: string; title: string; status: string }[]>;
}

export const useReleaseStore = create<ReleaseState>((set, get) => ({
  releases: [],
  isLoading: false,

  fetchReleases: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('releases')
        .select('*')
        .order('release_date', { ascending: false, nullsFirst: false });
      if (error) throw error;

      // Fetch ticket counts per release
      const { data: junctionData } = await supabase
        .from('release_tickets')
        .select('release_id');

      const releases = (data || []).map((r: any) => ({
        ...r,
        ticket_count: (junctionData || []).filter((j: any) => j.release_id === r.id).length,
      }));

      set({ releases: releases as Release[] });
    } catch (err) {
      console.error('Error fetching releases:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  createRelease: async (r) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('releases')
        .insert({ ...r, created_by: user?.id || null });
      if (error) throw error;
      toast.success('Release created');
      get().fetchReleases();
    } catch (err: any) {
      console.error('Error creating release:', err);
      toast.error(err.message || 'Failed to create release');
    }
  },

  updateRelease: async (id, updates) => {
    const prev = get().releases;
    set({ releases: prev.map(r => r.id === id ? { ...r, ...updates } : r) });
    try {
      const { error } = await supabase.from('releases').update(updates).eq('id', id);
      if (error) throw error;
      toast.success('Release updated');
    } catch (err: any) {
      console.error('Error updating release:', err);
      toast.error(err.message || 'Failed to update release');
      set({ releases: prev });
    }
  },

  deleteRelease: async (id) => {
    const prev = get().releases;
    set({ releases: prev.filter(r => r.id !== id) });
    try {
      const { error } = await supabase.from('releases').delete().eq('id', id);
      if (error) throw error;
      toast.success('Release deleted');
    } catch (err: any) {
      console.error('Error deleting release:', err);
      toast.error(err.message || 'Failed to delete release');
      set({ releases: prev });
    }
  },

  addTicketToRelease: async (releaseId, ticketId) => {
    try {
      const { error } = await supabase
        .from('release_tickets')
        .insert({ release_id: releaseId, ticket_id: ticketId });
      if (error) throw error;
      toast.success('Ticket added to release');
      get().fetchReleases();
    } catch (err: any) {
      if (err.message?.includes('duplicate key')) {
        toast.error('Ticket is already in this release');
      } else {
        toast.error(err.message || 'Failed to add ticket');
      }
    }
  },

  removeTicketFromRelease: async (releaseId, ticketId) => {
    try {
      const { error } = await supabase
        .from('release_tickets')
        .delete()
        .eq('release_id', releaseId)
        .eq('ticket_id', ticketId);
      if (error) throw error;
      toast.success('Ticket removed from release');
      get().fetchReleases();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove ticket');
    }
  },

  fetchReleaseTickets: async (releaseId) => {
    try {
      const { data, error } = await supabase
        .from('release_tickets')
        .select('ticket_id, tickets:tickets!release_tickets_ticket_id_fkey(id, readable_id, title, status)')
        .eq('release_id', releaseId);
      if (error) throw error;
      return (data || []).map((d: any) => {
        const t = Array.isArray(d.tickets) ? d.tickets[0] : d.tickets;
        return t || { id: d.ticket_id, readable_id: '???', title: 'Unknown', status: 'pending' };
      });
    } catch (err) {
      console.error('Error fetching release tickets:', err);
      return [];
    }
  },
}));
