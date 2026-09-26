import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Product } from '../types';

interface ProductState {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  fetchProducts: () => Promise<void>;
  createProduct: (name: string, description: string, color: string) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  archiveProduct: (id: string) => Promise<void>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  isLoading: false,
  error: null,

  fetchProducts: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      set({ products: data || [] });
    } catch (err: any) {
      console.error('Failed to fetch products:', err);
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createProduct: async (name, description, color) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([{ name, description, color }])
        .select()
        .single();

      if (error) throw error;
      set({ products: [...get().products, data] });
    } catch (err: any) {
      console.error('Failed to create product:', err);
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },

  updateProduct: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('products')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      set({ products: get().products.map(p => p.id === id ? data : p) });
    } catch (err: any) {
      console.error('Failed to update product:', err);
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },

  archiveProduct: async (id) => {
    await get().updateProduct(id, { status: 'archived' });
  }
}));
