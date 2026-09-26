import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { TimeEntry } from '../types';
import toast from 'react-hot-toast';

interface TimerState {
  /** The currently running timer entry (null if none) */
  activeTimer: TimeEntry | null;
  isLoading: boolean;

  /** Check if the current user has a running timer */
  fetchActiveTimer: () => Promise<void>;

  /** Start a new timer on a ticket */
  startTimer: (ticketId: string) => Promise<void>;

  /** Stop the running timer — computes elapsed hours and saves */
  stopTimer: () => Promise<void>;

  /** Discard the running timer without saving hours */
  discardTimer: () => Promise<void>;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  activeTimer: null,
  isLoading: false,

  fetchActiveTimer: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('time_entries')
        .select('*, technician:profiles(full_name, email)')
        .eq('technician_id', user.id)
        .eq('is_running', true)
        .maybeSingle();

      if (error) throw error;
      set({ activeTimer: data as TimeEntry | null });
    } catch (err) {
      console.error('Error fetching active timer:', err);
    }
  },

  startTimer: async (ticketId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check for existing running timer
      const existing = get().activeTimer;
      if (existing) {
        toast.error('You already have a running timer. Stop it first.');
        return;
      }

      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          ticket_id: ticketId,
          technician_id: user.id,
          hours: 0,
          started_at: new Date().toISOString(),
          is_running: true,
        })
        .select('*, technician:profiles(full_name, email)')
        .single();

      if (error) {
        if (error.message?.includes('idx_one_running_timer_per_tech')) {
          toast.error('You already have a running timer on another ticket.');
        } else {
          throw error;
        }
        return;
      }

      set({ activeTimer: data as TimeEntry });
      toast.success('Timer started');
    } catch (err: any) {
      console.error('Error starting timer:', err);
      toast.error(err.message || 'Failed to start timer');
    }
  },

  stopTimer: async () => {
    const timer = get().activeTimer;
    if (!timer || !timer.started_at) return;

    try {
      const startedAt = new Date(timer.started_at);
      const now = new Date();
      const elapsedMs = now.getTime() - startedAt.getTime();
      const elapsedHours = Math.round((elapsedMs / 3_600_000) * 100) / 100; // round to 2 decimals

      const { error } = await supabase
        .from('time_entries')
        .update({
          hours: elapsedHours,
          is_running: false,
        })
        .eq('id', timer.id);

      if (error) throw error;

      // Update billed_hours rollup on the ticket
      const { data: allEntries } = await supabase
        .from('time_entries')
        .select('hours')
        .eq('ticket_id', timer.ticket_id)
        .eq('is_running', false);

      const totalHours = (allEntries || []).reduce((sum, e) => sum + Number(e.hours), 0);

      await supabase
        .from('tickets')
        .update({ billed_hours: totalHours })
        .eq('id', timer.ticket_id);

      // Activity log
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('activity_logs').insert({
          ticket_id: timer.ticket_id,
          actor_id: user.id,
          action: `Stopped timer — logged <span class="font-semibold">${elapsedHours}h</span>`,
        });
      }

      set({ activeTimer: null });
      toast.success(`Timer stopped — ${elapsedHours}h logged`);
    } catch (err: any) {
      console.error('Error stopping timer:', err);
      toast.error(err.message || 'Failed to stop timer');
    }
  },

  discardTimer: async () => {
    const timer = get().activeTimer;
    if (!timer) return;

    try {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', timer.id);

      if (error) throw error;
      set({ activeTimer: null });
      toast.success('Timer discarded');
    } catch (err: any) {
      console.error('Error discarding timer:', err);
      toast.error(err.message || 'Failed to discard timer');
    }
  },
}));
