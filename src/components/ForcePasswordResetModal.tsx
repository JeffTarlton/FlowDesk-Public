import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { describeAdminActionsError } from '../lib/edgeFunctionError';
import { useAuthStore } from '../store/useAuthStore';
import { Loader2, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

// The published password of the seeded admin (supabase/migrations/*_seed_admin.sql)
const DEFAULT_ADMIN_PASSWORD = 'Password2026!';

export default function ForcePasswordResetModal() {
  const { user, refreshProfile, signOut } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Validation specs
  const hasLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const notDefault = password !== '' && password !== DEFAULT_ADMIN_PASSWORD;
  const passwordsMatch = password !== '' && password === confirmPassword;
  const isValid = hasLength && hasNumber && hasSpecial && notDefault && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !user) return;

    setSubmitError(null);
    setLoading(true);

    try {
      // 1. Update the password via the admin-actions Edge Function. The service
      //    role key stays server-side. The function only changes the caller's own
      //    password, and clears force_password_reset once it has changed.
      const { data, error: functionError } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'update-password',
          user_id: user.id,
          password,
        }
      });

      if (functionError) throw new Error(describeAdminActionsError(functionError, 'Failed to update password.'));
      if (data?.error) throw new Error(data.error);

      // 2. Re-fetch the profile — once force_password_reset is false, the modal unmounts
      await refreshProfile();
      if (useAuthStore.getState().profile?.force_password_reset) {
        throw new Error('Your password was changed, but the reset flag could not be cleared. Please sign in again.');
      }

      toast.success('Password updated successfully! Welcome to FlowDesk.');
    } catch (err: any) {
      console.error('Password reset error:', err);
      setSubmitError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const Rule = ({ met, label }: { met: boolean; label: string }) => (
    <div className={`flex items-center gap-2 text-sm transition-colors ${met ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
      {met
        ? <CheckCircle2 size={14} className="shrink-0" />
        : <XCircle size={14} className="shrink-0" />
      }
      {label}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-gray-900/90 backdrop-blur-md">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-white dark:bg-surface-dark w-full max-w-md p-6 sm:p-8 rounded-[1.5rem] shadow-2xl border border-gray-100 dark:border-gray-800">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
              <ShieldAlert className="text-orange-500 w-8 h-8" />
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white text-center mb-2">
            Set Your Password
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-8">
            Welcome to FlowDesk! For security purposes, please create a strong password before continuing.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">
                New Password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setSubmitError(null); }}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-shadow"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">
                Confirm Password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setSubmitError(null); }}
                className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border rounded-xl focus:outline-none focus:ring-2 transition-shadow ${
                  confirmPassword && !passwordsMatch
                    ? 'border-red-400 focus:ring-red-400'
                    : 'border-gray-200 dark:border-gray-700 focus:ring-primary-500'
                }`}
                placeholder="••••••••"
              />
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <XCircle size={12} /> Passwords do not match
                </p>
              )}
            </div>

            {/* Validation Checklist */}
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2">
              <Rule met={hasLength} label="At least 8 characters" />
              <Rule met={hasNumber} label="At least 1 number" />
              <Rule met={hasSpecial} label='At least 1 special character (!@#$%^&*)' />
              <Rule met={notDefault} label="Not the default setup password" />
              <Rule met={passwordsMatch} label="Passwords match" />
            </div>

            {/* Server-side / submission error */}
            {submitError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
                <XCircle size={16} className="shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!isValid || loading}
              className="w-full py-3 mt-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? 'Updating Security…' : 'Save & Continue'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => signOut()}
            className="w-full mt-4 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
