import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useAdminStore } from '../store/useAdminStore';

interface Props {
  onClose: () => void;
}

export default function EditProfileModal({ onClose }: Props) {
  const { user, profile, refreshProfile } = useAuthStore();
  const { branches, fetchBranches } = useAdminStore();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    company_name: profile?.company_name || '',
    phone: profile?.phone || '',
    branch_id: profile?.branch_id || '',
    avatar_url: profile?.avatar_url || '',
  });

  useEffect(() => {
    if (branches.length === 0) fetchBranches();
  }, [branches.length, fetchBranches]);

  if (!user || !profile) return null;

  // The database only lets an admin change a branch (it scopes branch-manager access),
  // so everyone else sees their branch read-only.
  const canEditBranch = profile.role === 'admin';
  const branchName = profile.branch_id
    ? branches.find(b => b.id === profile.branch_id)?.name || profile.branch_id
    : 'None / Global';

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      setFormData(prev => ({ ...prev, avatar_url: data.publicUrl }));
    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name || null,
          company_name: formData.company_name || null,
          ...(canEditBranch ? { branch_id: formData.branch_id || null } : {}),
          phone: formData.phone || null,
          avatar_url: formData.avatar_url || null,
        })
        .eq('id', user.id);

      if (profileError) {
        throw new Error("Failed to update profile: " + profileError.message);
      }

      await refreshProfile(); // Sync with global auth store
      onClose();
    } catch (err: any) {
      console.error("Update Error:", err);
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-800 my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-surface-dark rounded-t-2xl z-10">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Profile</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-left">
          
          {/* Avatar Area */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative group rounded-full">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 border-4 border-white dark:border-surface-dark shadow-md flex items-center justify-center relative">
                {formData.avatar_url ? (
                  <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-gray-400 uppercase">
                    {(formData.full_name || profile.email || '?').charAt(0)}
                  </span>
                )}
                <div 
                  className={`absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer transition-opacity ${uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 size={24} className="text-white animate-spin" />
                  ) : (
                    <Camera size={24} className="text-white" />
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3 font-medium">Click photo to update</p>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleAvatarUpload}
              disabled={uploading}
            />
          </div>

          <div className="mb-4 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
            <div className="flex justify-between items-center mb-2">
               <div>
                 <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email</p>
                 <p className="text-sm font-medium text-gray-900 dark:text-gray-200">
                   {profile.email}
                 </p>
               </div>
               <div className="text-right">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">System Role</p>
                  <p className="text-sm font-medium text-primary-600 dark:text-primary-400 capitalize">
                    {profile.role.replace('_', ' ')}
                  </p>
               </div>
            </div>
            {!canEditBranch && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Assigned Branch</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-200">{branchName}</p>
              </div>
            )}
            <p className="text-[10px] text-gray-400 mt-2 italic leading-tight">These fields are read-only. Contact your administrator if they need to be changed.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Full Name</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-canvas-dark text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.full_name}
              onChange={(e) => setFormData({...formData, full_name: e.target.value})}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Phone Number</label>
            <input
              type="tel"
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-canvas-dark text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-400"
              placeholder="(555) 555-5555"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Company Name</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-canvas-dark text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-400"
              placeholder="Your Organization"
              value={formData.company_name}
              onChange={(e) => setFormData({...formData, company_name: e.target.value})}
            />
          </div>

          {canEditBranch && (
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Assigned Branch Location</label>
              <select
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-canvas-dark text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.branch_id}
                onChange={(e) => setFormData({...formData, branch_id: e.target.value})}
              >
                <option value="">None / Global</option>
                {branches.filter(b => b.is_active || b.id === profile.branch_id).map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

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
              disabled={loading || uploading}
              className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Saving...</>
              ) : (
                'Save Profile'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
