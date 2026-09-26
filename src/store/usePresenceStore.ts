import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface PresenceUser {
  userId: string;
  fullName: string;
  email: string;
  avatarLetter: string;
  color: string;
}

interface PresenceState {
  presenceByRoom: Record<string, PresenceUser[]>;
  currentRoom: string | null;
  joinRoom: (ticketId: string, myProfile: { id: string; full_name: string; email: string }) => void;
  leaveRoom: () => void;
}

// Deterministic color per user ID for consistency
const COLORS = [
  'bg-violet-500', 'bg-sky-500', 'bg-emerald-500', 'bg-rose-500',
  'bg-amber-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500',
];

function getColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

let activeChannel: ReturnType<typeof supabase.channel> | null = null;

export const usePresenceStore = create<PresenceState>((set, get) => ({
  presenceByRoom: {},
  currentRoom: null,

  joinRoom: (ticketId, myProfile) => {
    // Leave any existing room first
    get().leaveRoom();

    const roomId = `ticket-presence:${ticketId}`;
    const channel = supabase.channel(roomId, {
      config: { presence: { key: myProfile.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ userId: string; fullName: string; email: string }>();
        const users: PresenceUser[] = Object.values(state).flatMap((entries) =>
          entries.map((e) => ({
            userId: e.userId,
            fullName: e.fullName,
            email: e.email,
            avatarLetter: (e.fullName || e.email || '?').charAt(0).toUpperCase(),
            color: getColor(e.userId),
          }))
        );
        set((s) => ({
          presenceByRoom: { ...s.presenceByRoom, [ticketId]: users },
        }));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: myProfile.id,
            fullName: myProfile.full_name || '',
            email: myProfile.email,
          });
        }
      });

    activeChannel = channel;
    set({ currentRoom: ticketId });
  },

  leaveRoom: () => {
    if (activeChannel) {
      activeChannel.untrack();
      supabase.removeChannel(activeChannel);
      activeChannel = null;
    }
    const { currentRoom } = get();
    if (currentRoom) {
      set((s) => {
        const updated = { ...s.presenceByRoom };
        delete updated[currentRoom];
        return { presenceByRoom: updated, currentRoom: null };
      });
    }
  },
}));
