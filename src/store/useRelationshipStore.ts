import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { TicketRelationship, RelationshipType } from '../types';
import toast from 'react-hot-toast';

interface RelationshipState {
  relationships: TicketRelationship[];
  isLoading: boolean;

  /** Fetch all relationships for a specific ticket (both directions) */
  fetchRelationships: (ticketId: string) => Promise<void>;

  /** Add a new relationship */
  addRelationship: (
    sourceTicketId: string,
    targetTicketId: string,
    type: RelationshipType
  ) => Promise<void>;

  /** Remove a relationship (reciprocal is auto-deleted by DB trigger) */
  removeRelationship: (relationshipId: string, sourceTicketId: string) => Promise<void>;
}

export const useRelationshipStore = create<RelationshipState>((set, get) => ({
  relationships: [],
  isLoading: false,

  fetchRelationships: async (ticketId) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('ticket_relationships')
        .select(`
          id,
          source_ticket_id,
          target_ticket_id,
          relationship_type,
          created_by,
          created_at,
          target_ticket:tickets!ticket_relationships_target_ticket_id_fkey(id, readable_id, title, status, priority)
        `)
        .eq('source_ticket_id', ticketId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Supabase joins return target_ticket as an array; flatten to single object
      const mapped = (data || []).map((r: any) => ({
        ...r,
        target_ticket: Array.isArray(r.target_ticket) ? r.target_ticket[0] : r.target_ticket,
      }));
      set({ relationships: mapped as TicketRelationship[] });
    } catch (err) {
      console.error('Error fetching relationships:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  addRelationship: async (sourceTicketId, targetTicketId, type) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('ticket_relationships')
        .insert({
          source_ticket_id: sourceTicketId,
          target_ticket_id: targetTicketId,
          relationship_type: type,
          created_by: user?.id || null,
        });

      if (error) throw error;

      // Log activity
      if (user) {
        const typeLabel = type.replace(/_/g, ' ');
        await supabase.from('activity_logs').insert({
          ticket_id: sourceTicketId,
          actor_id: user.id,
          action: `Linked ticket as **${typeLabel}**`,
        });
      }

      toast.success('Ticket linked successfully');
      // Refresh relationships for the source ticket
      get().fetchRelationships(sourceTicketId);
    } catch (err: any) {
      console.error('Error adding relationship:', err);
      if (err.message?.includes('no_self_relationship')) {
        toast.error('Cannot link a ticket to itself');
      } else if (err.message?.includes('duplicate key')) {
        toast.error('This relationship already exists');
      } else {
        toast.error(err.message || 'Failed to link ticket');
      }
    }
  },

  removeRelationship: async (relationshipId, _sourceTicketId) => {
    // Optimistic removal
    const prev = get().relationships;
    set({ relationships: prev.filter(r => r.id !== relationshipId) });

    try {
      const { error } = await supabase
        .from('ticket_relationships')
        .delete()
        .eq('id', relationshipId);

      if (error) throw error;
      toast.success('Link removed');
    } catch (err: any) {
      console.error('Error removing relationship:', err);
      toast.error(err.message || 'Failed to remove link');
      set({ relationships: prev });
    }
  },
}));
