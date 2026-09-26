import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '../types';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  originalProfile: Profile | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  impersonate: (profile: Profile) => void;
  stopImpersonating: () => void;
  initialize: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

// A forced password reset applies to the signed-in account only, never to a profile an
// admin is impersonating. Deactivated accounts get the "Account Deactivated" screen instead.
export const isPasswordResetPending = ({ user, profile }: { user: User | null; profile: Profile | null }) =>
  !!user && !!profile?.force_password_reset && profile.is_active !== false && profile.id === user.id;

// Guard so we only register onAuthStateChange once per app lifecycle
let authListenerRegistered = false;
let visibilityListenerRegistered = false;
let lastActiveTimestamp = Date.now();
let recoveryInProgress = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  originalProfile: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => {
    // Prevent overriding originalProfile context from onAuthStateChange if impersonating
    if (get().originalProfile && profile?.id === get().user?.id) return;
    set({ profile });
  },
  impersonate: (profile) => set({ profile, originalProfile: get().originalProfile || get().profile }),
  stopImpersonating: () => set({ profile: get().originalProfile, originalProfile: null }),

  refreshProfile: async () => {
    const { user } = get();
    if (!user) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (profile) set({ profile: profile as Profile });
  },

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        set({ user: session.user });
        
        // Fetch profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        if (profile) {
          set({ profile: profile as Profile });
        }
      }
    } catch (error) {
      console.error('Error in auth initialization:', error);
    } finally {
      set({ isLoading: false });
    }

    // Only register the auth state listener once to avoid duplicate handlers
    if (authListenerRegistered) return;
    authListenerRegistered = true;

    supabase.auth.onAuthStateChange((event, session) => {
      // A different account (or none) means any impersonation state is stale
      if (session?.user?.id !== get().user?.id) set({ originalProfile: null });
      set({ user: session?.user || null });
      if (session?.user) {
        // Use setTimeout to decouple this API request from the onAuthStateChange execution stack.
        // This prevents the Supabase Client from recursively deadlocking its own internal Mutex lock.
        setTimeout(async () => {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            if (profile) set({ profile: profile as Profile });
          } catch (err) {
            console.error('[AuthStore] Failed to update profile on auth change:', err);
          }
        }, 0);
      } else {
        set({ profile: null });
      }

      // If the token was refreshed or the user signed in after being away,
      // broadcast a re-fetch event so all data stores reload their data.
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        setTimeout(() => {
          window.dispatchEvent(new Event('supabase:session-recovered'));
        }, 0);
      }
    });

    // Register a visibility change listener to handle tab-back recovery.
    // When the user returns to the tab after 2+ minutes away, we proactively
    // re-validate the session and trigger data re-fetching across all stores.
    if (!visibilityListenerRegistered) {
      visibilityListenerRegistered = true;

      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState !== 'visible') {
          lastActiveTimestamp = Date.now();
          return;
        }

        const awayMs = Date.now() - lastActiveTimestamp;
        const TWO_MINUTES = 2 * 60 * 1000;

        if (awayMs < TWO_MINUTES) return; // short tab-switch, no action needed

        // Prevent concurrent recovery if user rapidly refocuses
        if (recoveryInProgress) return;
        recoveryInProgress = true;

        // User has been away for a while — re-validate the session via server round-trip.
        // NOTE: We use getUser() instead of getSession() because getSession() reads
        // from the local storage cache and may return a stale/expired token.
        // getUser() always validates against the Supabase auth server.
        try {
          console.info('[AuthStore] Tab refocused after', Math.round(awayMs / 1000), 'seconds — validating session...');
          const { data: { user: freshUser }, error } = await supabase.auth.getUser();
          if (error || !freshUser) {
            // Session is dead — sign the user out cleanly
            console.warn('[AuthStore] Session expired while away. Signing out.');
            get().signOut();
            return;
          }

          // Session is still valid — re-fetch profile + broadcast to stores
          set({ user: freshUser });
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', freshUser.id)
            .single();
          if (profile) set({ profile: profile as Profile });

          console.info('[AuthStore] Session valid. Broadcasting recovery event.');
          window.dispatchEvent(new Event('supabase:session-recovered'));
        } catch (err) {
          console.error('[AuthStore] Visibility recovery error:', err);
        } finally {
          recoveryInProgress = false;
        }
      });
    }
  },
  signOut: async () => {
    supabase.removeAllChannels().catch(console.error); // Fire-and-forget to prevent deadlocking signOut
    await supabase.auth.signOut();
    set({ user: null, profile: null, originalProfile: null });
  }
}));
