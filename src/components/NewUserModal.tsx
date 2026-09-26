import React, { useState } from 'react';
import { X, Loader2, Copy, Check, KeyRound, UserCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { describeAdminActionsError } from '../lib/edgeFunctionError';
import { UserRole } from '../types';
import { useAdminStore } from '../store/useAdminStore';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const ROLE_OPTIONS: UserRole[] = ['support_desk', 'developer', 'admin', 'branch_manager'];

/** Generates a secure, readable temp password that satisfies ForcePasswordResetModal rules */
function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%';

  const rand = (str: string) => str[Math.floor(Math.random() * str.length)];

  // Guarantee at least one of each required type
  const required = [rand(upper), rand(lower), rand(digits), rand(special)];
  const all = upper + lower + digits;
  for (let i = 0; i < 6; i++) required.push(rand(all));

  // Fisher-Yates shuffle
  const arr = required;
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

export default function NewUserModal({ onClose, onSuccess }: Props) {
  const { branches } = useAdminStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    company_name: '',
    branch_id: '',
    role: 'support_desk' as UserRole,
  });

  const handleCopy = async () => {
    if (!createdUser) return;
    await navigator.clipboard.writeText(createdUser.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const tempPassword = generateTempPassword();

      // Call the admin-actions Edge Function (service role key stays server-side)
      const { data, error: functionError } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'create-user',
          email: formData.email,
          password: tempPassword,
          full_name: formData.full_name,
          company_name: formData.company_name,
          branch_id: formData.branch_id,
          role: formData.role,
        }
      });

      if (functionError) throw new Error(describeAdminActionsError(functionError, 'Failed to create user.'));
      if (data?.error) throw new Error(data.error);

      // Show the success screen with the temp password so admin can share it
      setCreatedUser({ email: formData.email, tempPassword });
    } catch (err: any) {
      console.error('CreateUser Error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // ── Success Screen ─────────────────────────────────────────────────
  if (createdUser) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-800">
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserCheck className="text-green-500 w-8 h-8" />
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">User Created!</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Share these credentials with <span className="font-semibold text-gray-700 dark:text-gray-300">{createdUser.email}</span>. They will be prompted to change their password on first login.
            </p>

            {/* Credentials card */}
            <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-left space-y-3 mb-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-0.5">Email</p>
                <p className="text-sm font-mono text-gray-800 dark:text-gray-200">{createdUser.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-0.5">Temporary Password</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono text-gray-800 dark:text-gray-200 tracking-widest flex-1 select-all">
                    {createdUser.tempPassword}
                  </p>
                  <button
                    onClick={handleCopy}
                    title="Copy password"
                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
                  >
                    {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
              <div className="pt-1 flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                <KeyRound size={14} className="shrink-0 mt-0.5" />
                <span>This password will not be shown again. Copy it before closing.</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {copied ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                {copied ? 'Copied!' : 'Copy Password'}
              </button>
              <button
                onClick={() => { onSuccess(); onClose(); }}
                className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors shadow-md text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Create User Form ───────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create User</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-left">
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="email"
              autoComplete="off"
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Full Name</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Company Name</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Assigned Branch</label>
            <select
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.branch_id}
              onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
            >
              <option value="">None / Global</option>
              {branches.filter(b => b.is_active).map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">
              System Role <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          {/* Inline error */}
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors shadow-md flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
