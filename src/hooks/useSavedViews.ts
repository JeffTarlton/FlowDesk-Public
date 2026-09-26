import { useState, useEffect } from 'react';

export interface SavedView {
  id: string;
  name: string;
  searchQuery: string;
  filterPreset: string | null;
  sortField: 'updated_at' | 'priority' | 'status';
  sortOrder: 'asc' | 'desc';
}

export function useSavedViews() {
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    try {
      const item = window.localStorage.getItem('flowdesk_saved_views');
      return item ? JSON.parse(item) : [];
    } catch (error) {
      console.error(error);
      return [];
    }
  });

  useEffect(() => {
    window.localStorage.setItem('flowdesk_saved_views', JSON.stringify(savedViews));
  }, [savedViews]);

  const addView = (view: Omit<SavedView, 'id'>) => {
    const newView = { ...view, id: crypto.randomUUID() };
    setSavedViews(prev => [...prev, newView]);
  };

  const removeView = (id: string) => {
    setSavedViews(prev => prev.filter(v => v.id !== id));
  };

  return { savedViews, addView, removeView };
}
