import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, ChevronDown, ChevronRight, Mail, Ticket, Loader2 } from 'lucide-react';

interface BranchInfo {
  name: string;
  is_active: boolean;
}
interface ManagerInfo {
  full_name: string | null;
  email: string;
}
interface RecentTicket {
  readable_id: string;
  title: string;
  status: string;
}

interface Props {
  branchId: string | null;
}

const statusDot: Record<string, string> = {
  pending:         'bg-gray-400',
  ready_for_dev:   'bg-blue-500',
  dev_in_progress: 'bg-purple-500',
  beta_testing:    'bg-teal-500',
  done:            'bg-green-500',
};

export default function BranchInfoPanel({ branchId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [branch, setBranch] = useState<BranchInfo | null>(null);
  const [manager, setManager] = useState<ManagerInfo | null>(null);
  const [openCount, setOpenCount] = useState<number>(0);
  const [recent, setRecent] = useState<RecentTicket[]>([]);

  const fetchBranchData = useCallback(async () => {
    if (!branchId || loaded) return;
    setLoading(true);
    try {
      const [branchRes, managerRes, countRes, recentRes] = await Promise.all([
        supabase.from('branches').select('name, is_active').eq('id', branchId).single(),
        supabase.from('profiles').select('full_name, email').eq('branch_id', branchId).eq('role', 'branch_manager').limit(1).maybeSingle(),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).neq('status', 'done'),
        supabase.from('tickets').select('readable_id, title, status').eq('branch_id', branchId).order('updated_at', { ascending: false }).limit(4),
      ]);

      if (branchRes.data) setBranch(branchRes.data);
      if (managerRes.data) setManager(managerRes.data);
      setOpenCount(countRes.count || 0);
      if (recentRes.data) setRecent(recentRes.data);
      setLoaded(true);
    } catch (err) {
      console.error('BranchInfoPanel fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [branchId, loaded]);

  useEffect(() => {
    if (open) fetchBranchData();
  }, [open, fetchBranchData]);

  if (!branchId) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 text-xs text-gray-400 italic">
        <Building2 size={13} /> No branch assigned
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      {/* Toggle Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/80 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors group"
      >
        <div className="flex items-center gap-2.5">
          <Building2 size={14} className="text-gray-400 dark:text-gray-500" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Branch Info</span>
          <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{branchId}</span>
          {loaded && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              {openCount} open
            </span>
          )}
        </div>
        <div className="text-gray-400">
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </div>
      </button>

      {/* Expanded Content */}
      {open && (
        <div className="px-4 py-4 bg-white dark:bg-surface-dark space-y-4 border-t border-gray-100 dark:border-gray-800">
          {loading && !loaded ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
              <Loader2 size={14} className="animate-spin" /> Loading branch data...
            </div>
          ) : (
            <>
              {/* Branch + Manager Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">Branch</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {branch?.name || branchId}
                  </p>
                  {branch && (
                    <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${branch.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {branch.is_active ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">Branch Manager</p>
                  {manager ? (
                    <>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{manager.full_name || 'N/A'}</p>
                      <a
                        href={`mailto:${manager.email}`}
                        onClick={e => e.stopPropagation()}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <Mail size={10} /> {manager.email}
                      </a>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No manager assigned</p>
                  )}
                </div>
              </div>

              {/* Open Ticket Count */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30">
                <Ticket size={13} className="text-blue-500 shrink-0" />
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                  {openCount} open ticket{openCount !== 1 ? 's' : ''} for this branch
                </span>
              </div>

              {/* Recent Tickets */}
              {recent.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider font-semibold">Recent Activity</p>
                  <div className="space-y-1.5">
                    {recent.map(t => (
                      <div key={t.readable_id} className="flex items-center gap-2.5">
                        <span className={`shrink-0 w-2 h-2 rounded-full ${statusDot[t.status] || 'bg-gray-300'}`} />
                        <span className="font-mono text-[10px] font-bold text-primary-600 dark:text-primary-400 shrink-0">{t.readable_id}</span>
                        <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{t.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
