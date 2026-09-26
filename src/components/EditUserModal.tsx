import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserRole, Profile } from '../types';
import { useAdminStore } from '../store/useAdminStore';

interface Props {
  user: Profile;
  onClose: () => void;
  onSuccess: () => void;
}

const ROLE_OPTIONS: UserRole[] = ['support_desk', 'developer', 'admin', 'branch_manager'];

export default function EditUserModal({ user, onClose, onSuccess }: Props) {
  const { branches, fetchUsers } = useAdminStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user.full_name || '',
    company_name: user.company_name || '',
    branch_id: user.branch_id || '',
    // A role the app has no screens for (e.g. 'customer') starts unset so the admin must pick one
    role: (ROLE_OPTIONS.includes(user.role) ? user.role : '') as UserRole | '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name || null,
          company_name: formData.company_name || null,
          branch_id: formData.branch_id || null,
          role: formData.role
        })
        .eq('id', user.id);

      if (profileError) {
        throw new Error("Failed to update profile: " + profileError.message);
      }

      await fetchUsers(); // Refresh store data
      onSuccess();
    } catch (err: any) {
      console.error("Update Error:", err);
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit User</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-left">
          
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-1">Email</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-200">
              {user.email}
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Full Name</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.full_name}
              onChange={(e) => setFormData({...formData, full_name: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Company Name</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.company_name}
              onChange={(e) => setFormData({...formData, company_name: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Assigned Branch</label>
            <select
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.branch_id}
              onChange={(e) => setFormData({...formData, branch_id: e.target.value})}
            >
              <option value="">None / Global</option>
              {branches.filter(b => b.is_active || b.id === user.branch_id).map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">System Role</label>
            <select
              required
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
            >
              <option value="" disabled>Select a role</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors border border-transparent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors shadow-md flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Saving...</>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
