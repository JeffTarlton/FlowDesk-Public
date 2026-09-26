import { useCallback } from 'react';
import { useAuthStore } from '../store/useAuthStore';

const MAX_PINS = 5;

function getKey(userId: string) {
  return `flowdesk-pinned-${userId}`;
}

export function usePinnedTickets() {
  const userId = useAuthStore((s) => s.profile?.id);

  const getPinnedIds = useCallback((): string[] => {
    if (!userId) return [];
    try {
      const raw = localStorage.getItem(getKey(userId));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [userId]);

  const setPinnedIds = useCallback((ids: string[]) => {
    if (!userId) return;
    localStorage.setItem(getKey(userId), JSON.stringify(ids));
  }, [userId]);

  const isPinned = useCallback((ticketId: string): boolean => {
    return getPinnedIds().includes(ticketId);
  }, [getPinnedIds]);

  const pin = useCallback((ticketId: string): boolean => {
    const ids = getPinnedIds();
    if (ids.includes(ticketId)) return true;
    if (ids.length >= MAX_PINS) return false; // cap reached
    setPinnedIds([...ids, ticketId]);
    return true;
  }, [getPinnedIds, setPinnedIds]);

  const unpin = useCallback((ticketId: string) => {
    setPinnedIds(getPinnedIds().filter(id => id !== ticketId));
  }, [getPinnedIds, setPinnedIds]);

  return { getPinnedIds, isPinned, pin, unpin, MAX_PINS };
}
