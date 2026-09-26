import { create } from 'zustand';
import { supabase, supabaseUrl } from '../lib/supabase';
import { Profile, Ticket, Branch, AuditLog } from '../types';
import toast from 'react-hot-toast';

interface AdminState {
  users: Profile[];
  tickets: Ticket[];
  branches: Branch[];
  auditLogs: AuditLog[];
  loadingUsers: boolean;
  loadingTickets: boolean;
  loadingBranches: boolean;
  loadingLogs: boolean;
  fetchUsers: () => Promise<void>;
  fetchTickets: () => Promise<void>;
  fetchBranches: () => Promise<void>;
  fetchAuditLogs: () => Promise<void>;
  createBranch: (id: string, name: string) => Promise<boolean>;
  updateBranch: (id: string, updates: Partial<Pick<Branch, 'name' | 'is_active'>>) => Promise<boolean>;
  deleteBranch: (id: string) => Promise<void>;
  updateUserRole: (userId: string, targetRole: string) => Promise<void>;
  updateUserFlags: (userId: string, payload: { is_active?: boolean; force_password_reset?: boolean }) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  updateTicketStatus: (ticketId: string, targetStatus: string) => Promise<void>;
  forcePasswordReset: (userId: string, newPassword: string) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  users: [],
  tickets: [],
  branches: [],
  auditLogs: [],
  loadingUsers: false,
  loadingTickets: false,
  loadingBranches: false,
  loadingLogs: false,

  fetchAuditLogs: async () => {
    try {
      set({ loadingLogs: true });
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      
      const users = get().users;
      
      const enrichedLogs = data?.map(log => {
        const actor = users.find(u => u.id === log.actor_id);
        return {
          ...log,
          actor_profile: actor ? { full_name: actor.full_name, email: actor.email } : undefined,
        };
      }) as AuditLog[];
      
      set({ auditLogs: enrichedLogs });
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      set({ loadingLogs: false });
    }
  },

  fetchBranches: async () => {
    try {
      if (get().branches.length === 0) set({ loadingBranches: true });
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name');
      if (error) throw error;
      set({ branches: data || [] });
    } catch (err) {
      console.error('Error fetching branches:', err);
      toast.error('Failed to load branches');
    } finally {
      set({ loadingBranches: false });
    }
  },

  createBranch: async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('branches')
        .insert({ id, name, is_active: true });
      if (error) throw error;
      toast.success(`Branch "${name}" created`);
      get().fetchBranches();
      return true;
    } catch (err: any) {
      console.error('Error creating branch:', err);
      toast.error(err.message || 'Failed to create branch');
      return false;
    }
  },

  updateBranch: async (id: string, updates: Partial<Pick<Branch, 'name' | 'is_active'>>) => {
    const prev = get().branches;
    set({ branches: prev.map(b => b.id === id ? { ...b, ...updates } : b) });
    try {
      const { error } = await supabase.from('branches').update(updates).eq('id', id);
      if (error) throw error;
      toast.success('Branch updated');
      return true;
    } catch (err: any) {
      console.error('Error updating branch:', err);
      toast.error(err.message || 'Failed to update branch');
      set({ branches: prev });
      return false;
    }
  },

  deleteBranch: async (id: string) => {
    const prev = get().branches;
    set({ branches: prev.filter(b => b.id !== id) });
    try {
      const { error } = await supabase.from('branches').delete().eq('id', id);
      if (error) throw error;
      toast.success('Branch deleted');
    } catch (err: any) {
      console.error('Error deleting branch:', err);
      toast.error(err.message || 'Failed to delete branch');
      set({ branches: prev });
    }
  },

  fetchUsers: async () => {
    try {
      if (get().users.length === 0) set({ loadingUsers: true });
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) console.error("Admin fetch users error:", error);
      if (!error && data) set({ users: data as Profile[] });
    } catch (err) {
      console.error("Admin users fetch exception:", err);
    } finally {
      set({ loadingUsers: false });
    }
  },

  fetchTickets: async () => {
    try {
      if (get().tickets.length === 0) set({ loadingTickets: true });
      
      const { data, error } = await supabase
        .from('tickets')
        .select('*, profiles!tickets_created_by_fkey(email, full_name)')
        .order('updated_at', { ascending: false });
        
      if (error) console.error("Admin fetch tickets error:", error);
      if (!error && data) {
        const enriched = data.map((t: any) => ({
          ...t,
          customer_email: t.profiles?.email || t.customer_email || 'Unknown',
        }));
        set({ tickets: enriched });
      }
    } catch (err) {
      console.error("Admin fetch tickets exception:", err);
    } finally {
      set({ loadingTickets: false });
    }
  },
  
  updateUserRole: async (userId: string, targetRole: string) => {
    // Optimistic: apply immediately, rollback on failure
    const previousUsers = get().users;
    set({ users: previousUsers.map(u => u.id === userId ? { ...u, role: targetRole as any } : u) });
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: targetRole, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) throw error;
      toast.success('Role updated');
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
      set({ users: previousUsers }); // rollback
    }
  },

  updateUserFlags: async (userId: string, payload: { is_active?: boolean; force_password_reset?: boolean }) => {
    // Optimistic: apply immediately, rollback on failure
    const previousUsers = get().users;
    set({ users: previousUsers.map(u => u.id === userId ? { ...u, ...payload } : u) });
    try {
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId);
      if (error) throw error;
      toast.success('User updated');
    } catch (error) {
      console.error('Error updating user flags:', error);
      toast.error('Failed to update user');
      set({ users: previousUsers }); // rollback
    }
  },

  deleteUser: async (userId: string) => {
    const previousUsers = get().users;
    const previousTickets = get().tickets;
    
    // Optimistically remove user and unassign tickets locally
    set({ 
      users: previousUsers.filter(u => u.id !== userId),
      tickets: previousTickets.map(t => t.assigned_to === userId ? { ...t, assigned_to: null } : t)
    });
    
    try {
      const { error } = await supabase.rpc('delete_user_officially', { target_user_id: userId });
      if (error) throw error;
      toast.success('User permanently deleted');
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete user');
      // Rollback
      set({ users: previousUsers, tickets: previousTickets });
    }
  },

  updateTicketStatus: async (ticketId: string, targetStatus: string) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: targetStatus, updated_at: new Date().toISOString() })
        .eq('id', ticketId);
        
      if (error) throw error;
      
      const tickets = get().tickets.map(t => t.id === ticketId ? { ...t, status: targetStatus as any } : t);
      set({ tickets });
      toast.success('Ticket status updated');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
      get().fetchTickets();
    }
  },

  forcePasswordReset: async (userId: string, newPassword: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${supabaseUrl}/functions/v1/admin-actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'admin-force-password-reset',
          target_user_id: userId,
          new_password: newPassword
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to reset password');
      }

      // Update the user array optimisticly so the UI updates
      const previousUsers = get().users;
      set({ users: previousUsers.map(u => u.id === userId ? { ...u, force_password_reset: true } : u) });
      
      toast.success('Password reset applied successfully');
    } catch (error: any) {
      console.error('Error forcing password reset:', error);
      toast.error(error.message || 'Failed to force password reset');
      throw error; // Rethrow to let the UI modal handle loading state termination
    }
  }
}));
