import { useEffect } from 'react';
import { useTicketStore } from '../store/useTicketStore';
import { useAdminStore } from '../store/useAdminStore';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { usePresenceStore } from '../store/usePresenceStore';

/**
 * Listens for session recovery events (tab refocus after idle, token refresh)
 * and re-fetches all data stores + re-subscribes all realtime channels
 * so the UI never shows stale/empty data.
 * 
 * Mount this ONCE at the AppLayout level.
 */
export function useSessionRecovery() {
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const handleRecovery = () => {
      console.info('[SessionRecovery] Session recovered — re-fetching all data stores & reconnecting channels.');

      // ── 1. Re-fetch data stores ──────────────────────────────────
      // Ticket store (used by Backlog, Kanban, Dashboard, Calendar)
      useTicketStore.getState().fetchTickets();

      // Admin store (used by Admin panel, Dashboard, Calendar)
      const adminActions = useAdminStore.getState();
      adminActions.fetchUsers();
      adminActions.fetchTickets();
      adminActions.fetchBranches();
      adminActions.fetchAuditLogs();

      // Notification store
      useNotificationStore.getState().fetchNotifications();

      // ── 2. Re-subscribe realtime channels ────────────────────────
      // Ticket channel (live INSERT/UPDATE/DELETE on tickets table)
      useTicketStore.getState().resubscribeToTickets();

      // Notification channel (live INSERT for this user's notifications)
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.id) {
        useNotificationStore.getState().resubscribeToNotifications(currentUser.id);
      }

      // ── 3. Re-join presence room if one was active ───────────────
      const presenceState = usePresenceStore.getState();
      const currentRoom = presenceState.currentRoom;
      const currentProfile = useAuthStore.getState().profile;
      if (currentRoom && currentProfile) {
        console.info('[SessionRecovery] Re-joining presence room:', currentRoom);
        presenceState.joinRoom(currentRoom, {
          id: currentProfile.id,
          full_name: currentProfile.full_name || '',
          email: currentProfile.email,
        });
      }
    };

    window.addEventListener('supabase:session-recovered', handleRecovery);
    return () => window.removeEventListener('supabase:session-recovered', handleRecovery);
  }, [profile, user]); // re-bind if profile/user changes (e.g., after impersonation)
}
