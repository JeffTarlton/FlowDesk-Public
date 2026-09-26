import { useEffect, useState, useCallback } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { useTicketStore } from '../store/useTicketStore';
import { useAuthStore } from '../store/useAuthStore';
import {
  Search, Ticket, Users, Shield, LogOut,
  Bug, Sparkles, FileText, ClipboardList, X, Zap, Briefcase
} from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const priorityIcon: Record<string, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
};

const typeIcon = (type: string) => {
  if (type === 'bug') return <Bug size={14} className="text-red-400 shrink-0" />;
  if (type === 'feature_request') return <Sparkles size={14} className="text-purple-400 shrink-0" />;
  if (type === 'improvement') return <Zap size={14} className="text-blue-400 shrink-0" />;
  if (type === 'professional_service') return <Briefcase size={14} className="text-orange-400 shrink-0" />;
  return <FileText size={14} className="text-gray-400 shrink-0" />;
};

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const tickets = useTicketStore((s) => s.tickets);
  const profile = useAuthStore((s) => s.profile);
  const { signOut } = useAuthStore();
  const isAdmin = profile?.role === 'admin';

  // Reset search when opened
  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const runAndClose = useCallback((fn: () => void) => {
    fn();
    onClose();
  }, [onClose]);

  const filteredTickets = search.trim().length > 0
    ? tickets
        .filter(t =>
          t.readable_id?.toLowerCase().includes(search.toLowerCase()) ||
          t.title?.toLowerCase().includes(search.toLowerCase()) ||
          t.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
          t.customer_email?.toLowerCase().includes(search.toLowerCase()) ||
          t.description?.toLowerCase().includes(search.toLowerCase())
        )
        .slice(0, 12)
    : [];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700/60 shadow-2xl shadow-black/30 overflow-hidden"
          shouldFilter={false}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-gray-800">
            <Search size={16} className="text-gray-400 shrink-0" />
            <Command.Input
              autoFocus
              placeholder="Search tickets, jump to page…"
              value={search}
              onValueChange={setSearch}
              className="flex-1 bg-transparent text-gray-900 dark:text-white text-sm outline-none placeholder:text-gray-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={14} />
              </button>
            )}
            <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-gray-400 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 font-mono">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto p-2 space-y-1">
            <Command.Empty className="py-10 text-center text-sm text-gray-400">
              No results found.
            </Command.Empty>

            {/* Ticket search results */}
            {filteredTickets.length > 0 && (
              <Command.Group heading={
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">Tickets</span>
              }>
                {filteredTickets.map((ticket) => (
                  <Command.Item
                    key={ticket.id}
                    value={ticket.id}
                    onSelect={() => runAndClose(() => navigate(`/?ticket=${ticket.id}`))}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800"
                  >
                    {typeIcon(ticket.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary-500 dark:text-primary-400 font-mono shrink-0">
                          {ticket.readable_id}
                        </span>
                        <span className="text-sm text-gray-900 dark:text-white truncate">
                          {ticket.title}
                        </span>
                      </div>
                      {ticket.customer_name && (
                        <div className="text-xs text-gray-400 mt-0.5 truncate">{ticket.customer_name}</div>
                      )}
                    </div>
                    <span className="text-sm shrink-0">{priorityIcon[ticket.priority]}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Navigation commands */}
            {!search && (
              <Command.Group heading={
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">Navigation</span>
              }>
                <Command.Item
                  value="go-to-backlog"
                  onSelect={() => runAndClose(() => navigate('/'))}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                    <Ticket size={14} className="text-blue-500" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Go to Backlog</div>
                    <div className="text-xs text-gray-400">View and manage all tickets</div>
                  </div>
                </Command.Item>

                <Command.Item
                  value="go-to-kanban"
                  onSelect={() => runAndClose(() => navigate('/kanban'))}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800"
                >
                  <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                    <ClipboardList size={14} className="text-purple-500" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Go to Kanban Board</div>
                    <div className="text-xs text-gray-400">Drag-and-drop ticket management</div>
                  </div>
                </Command.Item>

                {(profile?.role === 'support_desk' || isAdmin) && (
                  <Command.Item
                    value="go-to-portal"
                    onSelect={() => runAndClose(() => navigate('/portal'))}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800"
                  >
                    <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                      <Users size={14} className="text-green-500" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">Go to Customer Portal</div>
                      <div className="text-xs text-gray-400">Manage customer-submitted requests</div>
                    </div>
                  </Command.Item>
                )}

                {isAdmin && (
                  <Command.Item
                    value="go-to-admin"
                    onSelect={() => runAndClose(() => navigate('/admin'))}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800"
                  >
                    <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                      <Shield size={14} className="text-red-500" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">Go to Admin Panel</div>
                      <div className="text-xs text-gray-400">User management, roles, and audit logs</div>
                    </div>
                  </Command.Item>
                )}
              </Command.Group>
            )}

            {/* Quick Actions */}
            {!search && (
              <Command.Group heading={
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">Quick Actions</span>
              }>
                <Command.Item
                  value="sign-out"
                  onSelect={() => runAndClose(() => signOut())}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group aria-selected:bg-red-50 dark:aria-selected:bg-red-900/20"
                >
                  <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <LogOut size={14} className="text-gray-500 group-hover:text-red-500" />
                  </div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-red-600 dark:group-hover:text-red-400">Sign Out</div>
                </Command.Item>
              </Command.Group>
            )}
          </Command.List>

          {/* Footer hint */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400">
            <span>
              <kbd className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-500 mr-1">↑↓</kbd>
              navigate
              <kbd className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-500 mx-1 ml-2">↵</kbd>
              select
            </span>
            <span>{tickets.length} tickets indexed</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
