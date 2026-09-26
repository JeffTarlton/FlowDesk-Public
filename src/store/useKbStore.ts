import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export type KbCategory = 'general' | 'how_to' | 'troubleshooting' | 'faq' | 'release_notes' | 'onboarding' | 'api_reference' | 'internal';

export interface KbArticle {
  id: string;
  title: string;
  content: string;
  product_id: string | null;
  category: KbCategory;
  tags: string[];
  author_id: string | null;
  is_published: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  /** Joined author profile */
  author?: { full_name: string; email: string };
  /** Joined product */
  product?: { name: string; color: string };
}

export const KB_CATEGORIES: { value: KbCategory; label: string; emoji: string }[] = [
  { value: 'general', label: 'General', emoji: '📄' },
  { value: 'how_to', label: 'How-To', emoji: '📝' },
  { value: 'troubleshooting', label: 'Troubleshooting', emoji: '🔧' },
  { value: 'faq', label: 'FAQ', emoji: '❓' },
  { value: 'release_notes', label: 'Release Notes', emoji: '🚀' },
  { value: 'onboarding', label: 'Onboarding', emoji: '👋' },
  { value: 'api_reference', label: 'API Reference', emoji: '⚙️' },
  { value: 'internal', label: 'Internal', emoji: '🔒' },
];

interface KbState {
  articles: KbArticle[];
  isLoading: boolean;
  searchQuery: string;
  categoryFilter: KbCategory | 'all';
  setSearchQuery: (q: string) => void;
  setCategoryFilter: (c: KbCategory | 'all') => void;
  fetchArticles: () => Promise<void>;
  createArticle: (a: Pick<KbArticle, 'title' | 'content' | 'category' | 'product_id' | 'tags' | 'is_published'>) => Promise<string | null>;
  updateArticle: (id: string, updates: Partial<Pick<KbArticle, 'title' | 'content' | 'category' | 'product_id' | 'tags' | 'is_published'>>) => Promise<void>;
  deleteArticle: (id: string) => Promise<void>;
  incrementViewCount: (id: string) => Promise<void>;
}

export const useKbStore = create<KbState>((set, get) => ({
  articles: [],
  isLoading: false,
  searchQuery: '',
  categoryFilter: 'all',

  setSearchQuery: (q) => set({ searchQuery: q }),
  setCategoryFilter: (c) => set({ categoryFilter: c }),

  fetchArticles: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('kb_articles')
        .select('*, author:profiles!kb_articles_author_id_fkey(full_name, email), product:products!kb_articles_product_id_fkey(name, color)')
        .order('updated_at', { ascending: false });
      if (error) throw error;

      const mapped = (data || []).map((a: any) => ({
        ...a,
        author: Array.isArray(a.author) ? a.author[0] : a.author,
        product: Array.isArray(a.product) ? a.product[0] : a.product,
      }));

      set({ articles: mapped as KbArticle[] });
    } catch (err) {
      console.error('Error fetching KB articles:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  createArticle: async (a) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('kb_articles')
        .insert({ ...a, author_id: user?.id || null })
        .select('id')
        .single();
      if (error) throw error;
      toast.success('Article created');
      get().fetchArticles();
      return data?.id || null;
    } catch (err: any) {
      console.error('Error creating article:', err);
      toast.error(err.message || 'Failed to create article');
      return null;
    }
  },

  updateArticle: async (id, updates) => {
    try {
      const { error } = await supabase.from('kb_articles').update(updates).eq('id', id);
      if (error) throw error;
      toast.success('Article updated');
      get().fetchArticles();
    } catch (err: any) {
      console.error('Error updating article:', err);
      toast.error(err.message || 'Failed to update article');
    }
  },

  deleteArticle: async (id) => {
    const prev = get().articles;
    set({ articles: prev.filter(a => a.id !== id) });
    try {
      const { error } = await supabase.from('kb_articles').delete().eq('id', id);
      if (error) throw error;
      toast.success('Article deleted');
    } catch (err: any) {
      console.error('Error deleting article:', err);
      toast.error(err.message || 'Failed to delete article');
      set({ articles: prev });
    }
  },

  incrementViewCount: async (id) => {
    try {
      if (!get().articles.some(a => a.id === id)) return;
      // An RPC rather than an UPDATE: every role that can read an article counts a
      // view, but only staff may edit articles. It returns the new count.
      const { data, error } = await supabase.rpc('increment_kb_view_count', { article_id: id });
      if (error || typeof data !== 'number') return;
      // Update locally without full refetch
      set({ articles: get().articles.map(a => a.id === id ? { ...a, view_count: data } : a) });
    } catch (err) {
      // Silent — view count is non-critical
    }
  },
}));
