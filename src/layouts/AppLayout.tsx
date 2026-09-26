import { useState, useEffect } from 'react';
import { Navigate, Outlet, NavLink } from 'react-router-dom';
import { useAuthStore, isPasswordResetPending } from '../store/useAuthStore';
import { Ticket, LogOut, Loader2, ShieldCheck, Columns, List, Eye, CalendarDays, LayoutDashboard, Search, Package, Briefcase, Target, Rocket, Clock, Square, BookOpen, Crown, FileText } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import ThemePicker from '../components/ThemePicker';
import NotificationDropdown from '../components/NotificationDropdown';
import ForcePasswordResetModal from '../components/ForcePasswordResetModal';
import { useSessionRecovery } from '../hooks/useSessionRecovery';
import MobileDashboard from '../components/MobileDashboard';
import EditProfileModal from '../components/EditProfileModal';
import FlowDeskLogo from '../components/FlowDeskLogo';
import { useTimerStore } from '../store/useTimerStore';

function ActiveTimerIndicator() {
  const { activeTimer, fetchActiveTimer, stopTimer } = useTimerStore();
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    fetchActiveTimer();
  }, []);

  useEffect(() => {
    if (!activeTimer?.started_at) { setElapsed(''); return; }
    const tick = () => {
      const ms = Date.now() - new Date(activeTimer.started_at!).getTime();
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1_000);
      setElapsed(`${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  if (!activeTimer) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 mb-2">
      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase">Timer Running</div>
        <div className="text-xs font-mono text-green-600 dark:text-green-300">{elapsed}</div>
      </div>
      <button
        onClick={stopTimer}
        className="p-1 bg-green-100 dark:bg-green-800/50 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors text-green-600 hover:text-red-500 dark:text-green-400 dark:hover:text-red-400"
        title="Stop Timer"
      >
        <Square size={12} />
      </button>
    </div>
  );
}

export default function AppLayout() {
  const { user, profile, originalProfile, isLoading, signOut, stopImpersonating } = useAuthStore();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Re-fetch all data stores when tab regains focus after idle
  useSessionRecovery();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // A pending forced password reset blocks the whole app on every screen size
  // (it applies to the signed-in user, not to a profile an admin is impersonating)
  if (isPasswordResetPending({ user, profile })) {
    return (
      <div className="h-[100dvh] w-screen bg-canvas dark:bg-canvas-dark">
        <ForcePasswordResetModal />
      </div>
    );
  }

  const isBacklog = profile?.role === 'developer' || profile?.role === 'admin' || profile?.role === 'support_desk';
  const isKanban = isBacklog || profile?.role === 'branch_manager';
  const isAdmin = profile?.role === 'admin';
  const isPortal = profile?.role === 'branch_manager' || profile?.role === 'support_desk';
  const isMyWork = profile?.role === 'developer' || profile?.role === 'admin' || profile?.role === 'support_desk';

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all ${
      isActive
        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 shadow-sm'
        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
    }`;

  return (
    <div className="h-[100dvh] w-screen overflow-hidden flex bg-canvas dark:bg-canvas-dark">
      {/* Mobile View */}
      <div className="md:hidden flex flex-col w-full h-full bg-canvas dark:bg-canvas-dark">
        <div className="flex-1 w-full overflow-hidden">
          <MobileDashboard />
        </div>
        
        {/* Mobile Bottom Navigation */}
        <nav className="shrink-0 bg-white dark:bg-surface-dark border-t border-gray-100 dark:border-gray-800 flex items-start justify-around pt-3 px-2 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.05)] z-20 min-h-[64px]">
          <button className="flex flex-col items-center p-2 text-primary-500 hover:opacity-80 transition-opacity">
            <List size={20} />
            <span className="text-[10px] font-medium mt-1">Tasks</span>
          </button>

          <NavLink to="/products" className={({ isActive }) => `flex flex-col items-center p-2 transition-colors ${isActive ? 'text-primary-500' : 'text-gray-400 hover:text-primary-500'}`}>
            <Package size={20} />
            <span className="text-[10px] font-medium mt-1">Products</span>
          </NavLink>
          
          <ThemePicker variant="mobile" />
          
          <button onClick={() => setIsProfileModalOpen(true)} className="flex flex-col items-center p-2 text-gray-400 hover:text-primary-500 transition-colors">
            {profile?.avatar_url ? (
               <img src={profile.avatar_url} alt="Avatar" className="w-5 h-5 rounded-full object-cover shadow-sm" />
            ) : (
               <div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-[10px] font-bold text-primary-700 dark:text-primary-300 uppercase">
                 {(profile?.full_name || user.email || '?').charAt(0)}
               </div>
            )}
            <span className="text-[10px] font-medium mt-1">Profile</span>
          </button>
          
          <button onClick={() => signOut()} className="flex flex-col items-center p-2 text-gray-400 hover:text-red-500 transition-colors">
            <LogOut size={20} />
            <span className="text-[10px] font-medium mt-1">Exit</span>
          </button>
        </nav>
      </div>

      {/* Sidebar */}
      <aside className="hidden md:flex relative z-20 w-64 bg-white dark:bg-surface-dark border-r border-gray-100 dark:border-gray-800 flex-col py-6 shrink-0 h-full overflow-y-visible">
        {/* Logo */}
        <div className="flex items-center mb-8 px-4">
          <FlowDeskLogo size="md" />
          <div className="ml-auto pr-2 relative">
            <NotificationDropdown />
          </div>
        </div>

        {/* User Profile Snippet */}
        <div className="px-4 mb-6">
          <button 
            onClick={() => setIsProfileModalOpen(true)}
            className="w-full p-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl flex items-center gap-3 text-left transition-all cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700 shadow-sm"
          >
            {profile?.avatar_url ? (
               <img src={profile.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full object-cover shrink-0 shadow-sm" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold uppercase text-sm shrink-0">
                {(profile?.full_name || user.email || '?').charAt(0)}
              </div>
            )}
            <div className="overflow-hidden flex-1">
              <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {profile?.full_name || 'User'}
              </div>
              <div className="text-xs text-gray-400 truncate">{user.email}</div>
              {profile?.role && (
                <div className="text-xs font-medium text-primary-600 dark:text-primary-400 capitalize mt-0.5">
                  {profile.role.replace('_', ' ')}
                </div>
              )}
            </div>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          <button
            onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white mb-4"
          >
            <div className="flex items-center gap-3">
              <Search size={18} /> Omni-Search
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-500">
              Cmd K
            </kbd>
          </button>

          {isKanban && (
            <NavLink to="/dashboard" className={navLinkClass}>
              <LayoutDashboard size={18} /> Dashboard
            </NavLink>
          )}

          {isMyWork && (
            <NavLink to="/my-work" className={navLinkClass}>
              <Briefcase size={18} /> My Work
            </NavLink>
          )}

          {isKanban && (
            <NavLink to="/kanban" className={navLinkClass}>
              <Columns size={18} /> Kanban
            </NavLink>
          )}

          {isBacklog && (
            <NavLink to="/backlog" className={navLinkClass}>
              <List size={18} /> Backlog
            </NavLink>
          )}

          {isBacklog && (
            <NavLink to="/calendar" className={navLinkClass}>
              <CalendarDays size={18} /> Calendar
            </NavLink>
          )}

          {isPortal && (
            <NavLink to="/portal" className={navLinkClass}>
              <Ticket size={18} /> Support Portal
            </NavLink>
          )}

          <NavLink to="/products" className={navLinkClass}>
            <Package size={18} /> Products
          </NavLink>

          {isBacklog && (
            <NavLink to="/milestones" className={navLinkClass}>
              <Target size={18} /> Milestones
            </NavLink>
          )}

          {isBacklog && (
            <NavLink to="/releases" className={navLinkClass}>
              <Rocket size={18} /> Releases
            </NavLink>
          )}

          {isMyWork && (
            <NavLink to="/timesheet" className={navLinkClass}>
              <Clock size={18} /> Timesheet
            </NavLink>
          )}

          {isBacklog && (
            <NavLink to="/knowledge-base" className={navLinkClass}>
              <BookOpen size={18} /> Knowledge Base
            </NavLink>
          )}
          {isAdmin && (
            <>
              <div className="pt-4 pb-1 px-3">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Admin</div>
              </div>
              <NavLink to="/admin" className={navLinkClass}>
                <ShieldCheck size={18} /> Admin Panel
              </NavLink>
              <NavLink to="/executive" className={navLinkClass}>
                <Crown size={18} /> Executive
              </NavLink>
              <NavLink to="/reports" className={navLinkClass}>
                <FileText size={18} /> Reports
              </NavLink>
            </>
          )}
        </nav>

        {/* Bottom Actions */}
        <div className="px-3 mt-4 space-y-1 border-t border-gray-100 dark:border-gray-800 pt-4 mx-3 shrink-0">
          <ActiveTimerIndicator />
          <ThemePicker />
          <ThemeToggle />
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors font-medium text-sm"
          >
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="hidden md:flex flex-1 flex-col overflow-hidden relative">
        {originalProfile && (
          <div className="bg-orange-500 text-white px-4 py-2 flex items-center justify-between shadow-md z-50">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Eye size={16} />
              You are currently viewing FlowDesk as {profile?.full_name || profile?.email} ({profile?.role.replace('_', ' ')})
            </div>
            <button 
              onClick={stopImpersonating}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm font-bold transition-colors"
            >
              Stop Impersonating
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto p-8">
          <Outlet />
        </div>
      </main>

      {/* Render globally spanning modals at the root level */}
      {isProfileModalOpen && <EditProfileModal onClose={() => setIsProfileModalOpen(false)} />}
    </div>
  );
}
