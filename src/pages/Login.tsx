import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import FlowDeskLogo from '../components/FlowDeskLogo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && profile) {
      const isPortalOnly = profile.role === 'branch_manager';
      navigate(isPortalOnly ? '/portal' : '/');
    }
  }, [user, profile, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Check if configuration failed to load
    if (!isSupabaseConfigured) {
       alert("CRITICAL ERROR: Application missing Supabase Credentials. Please check your .env.local file or Vercel Environment Variables settings.");
       setLoading(false);
       return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-canvas-dark p-4">
      <div className="w-full max-w-md bg-white dark:bg-surface-dark rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-800 text-center">
        <div className="flex justify-center mb-6">
          <FlowDeskLogo size="lg" showWordmark={false} />
        </div>
        <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">FlowDesk</h1>
        <p className="text-gray-500 mb-8">
          Sign in to your workspace
        </p>

        <form onSubmit={handleAuth} className="space-y-4 text-left">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Email</label>
            <input 
              type="email" 
              required
              autoComplete="email"
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Password</label>
            <input 
              type="password" 
              required
              autoComplete="current-password"
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-2.5 rounded-lg transition-colors mt-6 shadow-md"
          >
            {loading ? 'Please wait...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
