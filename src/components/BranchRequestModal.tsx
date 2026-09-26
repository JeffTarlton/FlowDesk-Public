import { useState, useEffect } from 'react';
import { X, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useProductStore } from '../store/useProductStore';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function BranchRequestModal({ onClose, onSuccess }: Props) {
  const { profile } = useAuthStore();
  const { products, fetchProducts } = useProductStore();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    product_id: '',
  });

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const activeProducts = products.filter(p => p.status === 'active');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !formData.title.trim()) return;
    setLoading(true);

    try {
      const { error } = await supabase.from('tickets').insert([{
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        type: 'feature_request',
        priority: formData.priority,
        status: 'pending',
        created_by: profile.id,
        branch_id: profile.branch_id,
        customer_name: profile.full_name || profile.email,
        product_id: formData.product_id || null,
      }]);

      if (error) throw error;

      toast.success('Request submitted! Our team will review it shortly.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Failed to submit request: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-lg border border-gray-100 dark:border-gray-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/40 flex items-center justify-center">
              <Sparkles size={18} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Submit a Request</h2>
              <p className="text-xs text-gray-400 mt-0.5">Our team will review your request shortly</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
              What do you need? <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              placeholder="Briefly describe your request or feature idea..."
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
              Details <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={4}
              placeholder="Any additional context, steps to reproduce, or business impact..."
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none transition-all text-sm"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* Product + Priority row */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
                Related Product <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <select
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                value={formData.product_id}
                onChange={e => setFormData({ ...formData, product_id: e.target.value })}
              >
                <option value="">None / General</option>
                {activeProducts.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
                Priority
              </label>
              <select
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Info note */}
          <p className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 border border-gray-100 dark:border-gray-700">
            📌 This request will be automatically tagged to your branch and routed to our support team for triage.
          </p>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.title.trim()}
              className="flex items-center gap-2 min-w-[140px] justify-center px-5 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold transition-colors shadow-md disabled:opacity-60"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
