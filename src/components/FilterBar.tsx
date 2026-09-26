import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Ticket, TicketPriority } from '../types';
import { SlidersHorizontal, UserCheck, AlertTriangle, Clock, X } from 'lucide-react';

export type FilterPreset = 'mine' | 'unassigned' | 'critical' | 'high' | 'recent' | 'on_hold' | 'triage';

const PRESET_CONFIG: Record<FilterPreset, { label: string; icon: React.ReactNode; description: string }> = {
  mine:       { label: 'Assigned to Me',  icon: <UserCheck size={13} />,     description: 'Tickets you are assigned to' },
  unassigned: { label: 'Unassigned',      icon: <SlidersHorizontal size={13} />, description: 'No agent assigned yet' },
  critical:   { label: 'Critical',        icon: <span className="text-[10px]">🔴</span>, description: 'Critical priority only' },
  high:       { label: 'High Priority',   icon: <span className="text-[10px]">🟠</span>, description: 'High priority only' },
  recent:     { label: 'Recently Updated',icon: <Clock size={13} />,         description: 'Updated in the last 24h' },
  on_hold:    { label: 'On Hold',         icon: <AlertTriangle size={13} />, description: 'Waiting on action' },
  triage:     { label: 'Triage Queue',    icon: <AlertTriangle size={13} />, description: 'Pending & support-held tickets — oldest first' },
};

interface FilterBarProps {
  tickets: Ticket[];
}

/** Applies active URL-param filters to a list of tickets and returns the filtered list */
export function useTicketFilters(tickets: Ticket[]) {
  const [searchParams] = useSearchParams();
  const profile = useAuthStore((s) => s.profile);
  const active = searchParams.get('filter') as FilterPreset | null;

  return useMemo(() => {
    if (!active) return tickets;
    const now = Date.now();

    switch (active) {
      case 'mine':
        return tickets.filter(t => t.assigned_to === profile?.id);
      case 'unassigned':
        return tickets.filter(t => !t.assigned_to);
      case 'critical':
        return tickets.filter(t => t.priority === 'critical' as TicketPriority);
      case 'high':
        return tickets.filter(t => t.priority === 'high' as TicketPriority);
      case 'recent':
        return tickets.filter(t => now - new Date(t.updated_at).getTime() < 86_400_000);
      case 'on_hold':
        return tickets.filter(t => (t.status as string).startsWith('on_hold'));
      case 'triage':
        return [...tickets.filter(t =>
          t.status === 'pending' || t.status === 'on_hold_support'
        )].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      default:
        return tickets;
    }
  }, [tickets, active, profile?.id]);
}

export default function FilterBar({ tickets }: FilterBarProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilter = searchParams.get('filter') as FilterPreset | null;

  const setFilter = (preset: FilterPreset) => {
    if (activeFilter === preset) {
      // Toggle off
      const next = new URLSearchParams(searchParams);
      next.delete('filter');
      setSearchParams(next, { replace: true });
    } else {
      const next = new URLSearchParams(searchParams);
      next.set('filter', preset);
      setSearchParams(next, { replace: true });
    }
  };

  const clearFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('filter');
    setSearchParams(next, { replace: true });
  };

  // Compute badge counts for each preset
  const counts = useMemo(() => {
    const now = Date.now();
    return {
      mine: 0,
      unassigned: tickets.filter(t => !t.assigned_to).length,
      critical: tickets.filter(t => t.priority === 'critical').length,
      high: tickets.filter(t => t.priority === 'high').length,
      recent: tickets.filter(t => now - new Date(t.updated_at).getTime() < 86_400_000).length,
      on_hold: tickets.filter(t => (t.status as string).startsWith('on_hold')).length,
      triage: tickets.filter(t => t.status === 'pending' || t.status === 'on_hold_support').length,
    };
  }, [tickets]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
        <SlidersHorizontal size={13} /> Filter
      </span>

      {(Object.keys(PRESET_CONFIG) as FilterPreset[]).map((preset) => {
        const config = PRESET_CONFIG[preset];
        const isActive = activeFilter === preset;
        const count = counts[preset];

        return (
          <button
            key={preset}
            onClick={() => setFilter(preset)}
            title={config.description}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              isActive
                ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400'
            }`}
          >
            {config.icon}
            {config.label}
            {count > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                isActive ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                {count}
              </span>
            )}
          </button>
        );
      })}

      {activeFilter && (
        <button
          onClick={clearFilter}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          <X size={12} /> Clear
        </button>
      )}
    </div>
  );
}
