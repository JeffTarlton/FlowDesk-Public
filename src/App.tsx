import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import Backlog from './pages/Backlog';
import KanbanBoard from './pages/KanbanBoard';
import Portal from './pages/Portal';
import Admin from './pages/Admin';
import Dashboard from './pages/Dashboard';
import CalendarTimeline from './pages/CalendarTimeline';
import ProductsCatalog from './pages/ProductsCatalog';
import MyWork from './pages/MyWork';
import MilestonesPage from './pages/MilestonesPage';
import ReleasesPage from './pages/ReleasesPage';
import TimesheetPage from './pages/TimesheetPage';
import KnowledgeBase from './pages/KnowledgeBase';
import ExecutiveDashboard from './pages/ExecutiveDashboard';
import ReportsPage from './pages/ReportsPage';
import CommandPalette from './components/CommandPalette';
import { useAuthStore, isPasswordResetPending } from './store/useAuthStore';
import { useEffect, useState } from 'react';
import { UserRole } from './types';

// Roles the app has screens for. The database's 'customer' role (the default for accounts
// not created from the Admin panel) has none, so it gets the "No Role Assigned" notice.
const APP_ROLES: UserRole[] = ['admin', 'developer', 'support_desk', 'branch_manager'];

const AccountNotice = ({ title, message }: { title: string, message: string }) => (
  <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-canvas-dark">
    <div className="max-w-md w-full bg-white dark:bg-surface-dark rounded-2xl shadow-xl p-8 border border-red-100 dark:border-red-900/30 text-center">
      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
         <span className="text-red-500 font-bold text-2xl">!</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{title}</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6">{message}</p>
      <button 
         onClick={() => useAuthStore.getState().signOut()}
         className="px-6 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold transition-colors"
      >
        Sign Out
      </button>
    </div>
  </div>
);

const NoRoleNotice = () => (
  <AccountNotice
    title="No Role Assigned"
    message="Your FlowDesk account does not have a role yet. Please ask your system administrator to assign one, then sign in again."
  />
);

const RequireRole = ({ allowedRoles, children }: { allowedRoles: UserRole[], children: React.ReactNode }) => {
  const profile = useAuthStore((s) => s.profile);
  if (!profile) return <Navigate to="/login" />;
  if (profile.is_active === false) {
    return (
      <AccountNotice
        title="Account Deactivated"
        message="Your FlowDesk account has been suspended or deactivated. Please contact your system administrator for assistance."
      />
    );
  }
  if (!APP_ROLES.includes(profile.role)) return <NoRoleNotice />;
  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to="/" />;
  }
  return <>{children}</>;
};

const DefaultLanding = () => {
  const profile = useAuthStore((s) => s.profile);
  if (!profile) return <Navigate to="/login" replace />;
  
  if (profile.role === 'branch_manager') return <Navigate to="/dashboard" replace />;
  if (profile.role === 'developer') return <Navigate to="/my-work" replace />;
  if (profile.role === 'support_desk') return <Navigate to="/backlog?filter=triage" replace />;
  if (profile.role === 'admin') return <Navigate to="/backlog" replace />;
  
  // Any other role has no pages: show the deactivated / "No Role Assigned" notice
  // instead of bouncing between "/" and a page it may not open
  return <RequireRole allowedRoles={APP_ROLES}>{null}</RequireRole>;
};

function App() {
  const initialize = useAuthStore((s) => s.initialize);
  const isLoading = useAuthStore((s) => s.isLoading);
  const profile = useAuthStore((s) => s.profile);
  const passwordResetPending = useAuthStore(isPasswordResetPending);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // The palette stays disabled until a pending forced password reset is completed
        if (isPasswordResetPending(useAuthStore.getState())) return;
        setCmdOpen((prev) => !prev);
      }
    };
    
    const customHandler = () => setCmdOpen(true);

    document.addEventListener('keydown', handler);
    window.addEventListener('open-command-palette', customHandler);
    
    return () => {
      document.removeEventListener('keydown', handler);
      window.removeEventListener('open-command-palette', customHandler);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-canvas-dark">
        <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center text-white font-bold text-2xl animate-pulse">
          F
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {/* Global Command Palette — available on all authenticated pages (not while a password reset is pending) */}
      {profile && !passwordResetPending && <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />}
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<AppLayout />}>
          {/* Landing redirector based on user role */}
          <Route path="/" element={<DefaultLanding />} />

          <Route path="/dashboard" element={
            <RequireRole allowedRoles={['developer', 'admin', 'support_desk', 'branch_manager']}>
              <Dashboard />
            </RequireRole>
          } />

          <Route path="/backlog" element={
            <RequireRole allowedRoles={['developer', 'admin', 'support_desk']}>
              <Backlog />
            </RequireRole>
          } />

          <Route path="/my-work" element={
            <RequireRole allowedRoles={['developer', 'admin', 'support_desk']}>
              <MyWork />
            </RequireRole>
          } />

          <Route path="/kanban" element={
            <RequireRole allowedRoles={['developer', 'admin', 'support_desk', 'branch_manager']}>
              <KanbanBoard />
            </RequireRole>
          } />

          <Route path="/calendar" element={
            <RequireRole allowedRoles={['developer', 'admin', 'support_desk']}>
              <CalendarTimeline />
            </RequireRole>
          } />

          {/* Support portal — branch managers and support desk */}
          <Route path="/portal" element={
            <RequireRole allowedRoles={['support_desk', 'branch_manager']}>
              <Portal />
            </RequireRole>
          } />

          {/* Products Catalog - accessible to all authenticated users */}
          <Route path="/products" element={
            <RequireRole allowedRoles={['developer', 'admin', 'support_desk', 'branch_manager']}>
              <ProductsCatalog />
            </RequireRole>
          } />

          {/* Milestones — accessible to staff */}
          <Route path="/milestones" element={
            <RequireRole allowedRoles={['developer', 'admin', 'support_desk', 'branch_manager']}>
              <MilestonesPage />
            </RequireRole>
          } />

          {/* Releases — accessible to staff */}
          <Route path="/releases" element={
            <RequireRole allowedRoles={['developer', 'admin', 'support_desk', 'branch_manager']}>
              <ReleasesPage />
            </RequireRole>
          } />

          {/* Timesheet — accessible to staff */}
          <Route path="/timesheet" element={
            <RequireRole allowedRoles={['developer', 'admin', 'support_desk']}>
              <TimesheetPage />
            </RequireRole>
          } />

          {/* Knowledge Base — accessible to all authenticated */}
          <Route path="/knowledge-base" element={
            <RequireRole allowedRoles={['developer', 'admin', 'support_desk', 'branch_manager']}>
              <KnowledgeBase />
            </RequireRole>
          } />

          {/* Executive dashboard — admin only */}
          <Route path="/executive" element={
            <RequireRole allowedRoles={['admin']}>
              <ExecutiveDashboard />
            </RequireRole>
          } />

          {/* Reports — admin only */}
          <Route path="/reports" element={
            <RequireRole allowedRoles={['admin']}>
              <ReportsPage />
            </RequireRole>
          } />

          {/* Admin panel — admin only */}
          <Route path="/admin" element={
            <RequireRole allowedRoles={['admin']}>
               <Admin />
            </RequireRole>
          } />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
