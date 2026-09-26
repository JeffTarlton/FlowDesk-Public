import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string | null;
  ticket_id: string | null;
  type: 'status_change' | 'assignment' | 'new_comment' | 'mention' | 'system';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  subscribeToNotifications: (userId: string) => void;
  unsubscribeFromNotifications: () => void;
  resubscribeToNotifications: (userId: string) => void;
}

// Track the specific notification channel so we only tear down ours
let activeNotificationChannel: ReturnType<typeof supabase.channel> | null = null;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      set({ 
        notifications: data as Notification[],
        unreadCount: (data as Notification[]).filter(n => !n.is_read).length
      });
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  markAsRead: async (id: string) => {
    const { notifications } = get();
    // Optimistic update
    set({
      notifications: notifications.map(n => n.id === id ? { ...n, is_read: true } : n),
      unreadCount: Math.max(0, get().unreadCount - 1)
    });

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
        
      if (error) throw error;
    } catch (err) {
      console.error('Error marking notification as read:', err);
      // Rollback on exact failure if completely necessary, but mostly ok to ignore for UX
    }
  },

  markAllAsRead: async () => {
    const { notifications } = get();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Optimistic
    set({
      notifications: notifications.map(n => ({ ...n, is_read: true })),
      unreadCount: 0
    });

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  },

  clearAllNotifications: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Optimistic
    set({
      notifications: [],
      unreadCount: 0
    });

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (err) {
      console.error('Error clearing all notifications:', err);
      get().fetchNotifications(); // Rollback by refetching
    }
  },

  subscribeToNotifications: (userId: string) => {
    // Clean up any existing channel first to avoid duplicates
    if (activeNotificationChannel) {
      supabase.removeChannel(activeNotificationChannel);
      activeNotificationChannel = null;
    }

    const channel = supabase.channel(`public:notifications:${userId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications', 
        filter: `user_id=eq.${userId}` 
      }, (payload) => {
        const newNotification = payload.new as Notification;
        set(state => {
          const updated = [newNotification, ...state.notifications];
          return {
            notifications: updated,
            unreadCount: state.unreadCount + 1
          };
        });
      })
      .subscribe();

    activeNotificationChannel = channel;
  },

  unsubscribeFromNotifications: () => {
    // Only remove OUR channel — not all channels in the app
    if (activeNotificationChannel) {
      supabase.removeChannel(activeNotificationChannel);
      activeNotificationChannel = null;
    }
  },

  /**
   * Tear down and re-create the notification realtime channel.
   * Called by useSessionRecovery when the tab regains focus after idle.
   */
  resubscribeToNotifications: (userId: string) => {
    console.info('[NotificationStore] Re-subscribing to notifications channel.');
    get().unsubscribeFromNotifications();
    get().subscribeToNotifications(userId);
  },
}));
