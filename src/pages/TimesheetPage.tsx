import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useAdminStore } from '../store/useAdminStore';
import { Clock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { formatHoursToTime } from '../utils/timeTracker';

interface TimesheetEntry {
  id: string;
  ticket_id: string;
  technician_id: string;
  hours: number;
  description: string | null;
  is_running: boolean;
  created_at: string;
  ticket?: { readable_id: string; title: string };
  technician?: { full_name: string };
}

function getWeekDates(refDate: Date): Date[] {
  const d = new Date(refDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TimesheetPage() {
  const { profile } = useAuthStore();
  const { users, fetchUsers } = useAdminStore();
  const isAdmin = profile?.role === 'admin';

  const [weekRef, setWeekRef] = useState(new Date());
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterUser, setFilterUser] = useState<string>('me');

  const weekDates = useMemo(() => getWeekDates(weekRef), [weekRef]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    loadEntries();
  }, [weekRef, filterUser]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const start = weekDates[0].toISOString();
      const end = new Date(weekDates[6]);
      end.setHours(23, 59, 59, 999);

      let query = supabase
        .from('time_entries')
        .select('id, ticket_id, technician_id, hours, description, is_running, created_at, ticket:tickets!time_entries_ticket_id_fkey(readable_id, title), technician:profiles!time_entries_technician_id_fkey(full_name)')
        .eq('is_running', false)
        .gte('created_at', start)
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: true });

      if (filterUser !== 'all') {
        const userId = filterUser === 'me' ? profile?.id : filterUser;
        if (userId) query = query.eq('technician_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Flatten joined data
      const mapped = (data || []).map((e: any) => ({
        ...e,
        ticket: Array.isArray(e.ticket) ? e.ticket[0] : e.ticket,
        technician: Array.isArray(e.technician) ? e.technician[0] : e.technician,
      }));

      setEntries(mapped);
    } catch (err) {
      console.error('Error loading timesheet:', err);
    } finally {
      setLoading(false);
    }
  };

  // Group entries by ticket
  const ticketGroups = useMemo(() => {
    const groups: Record<string, { ticketId: string; readableId: string; title: string; entries: TimesheetEntry[] }> = {};
    for (const e of entries) {
      if (!groups[e.ticket_id]) {
        groups[e.ticket_id] = {
          ticketId: e.ticket_id,
          readableId: e.ticket?.readable_id || '???',
          title: e.ticket?.title || 'Unknown',
          entries: [],
        };
      }
      groups[e.ticket_id].entries.push(e);
    }
    return Object.values(groups).sort((a, b) => a.readableId.localeCompare(b.readableId));
  }, [entries]);

  // Day totals
  const dayTotals = weekDates.map((d) =>
    entries.filter(e => isSameDay(new Date(e.created_at), d)).reduce((s, e) => s + Number(e.hours), 0)
  );
  const grandTotal = dayTotals.reduce((s, v) => s + v, 0);

  const navigateWeek = (offset: number) => {
    const d = new Date(weekRef);
    d.setDate(d.getDate() + offset * 7);
    setWeekRef(d);
  };

  const isThisWeek = isSameDay(getWeekDates(new Date())[0], weekDates[0]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Clock size={24} className="text-primary-500" />
            Timesheet
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Weekly view of logged hours across tickets.</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <select
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="me">My Hours</option>
              <option value="all">All Users</option>
              {users.filter(u => u.role !== 'branch_manager').map(u => (
                <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Week Navigator */}
      <div className="flex items-center justify-between mb-6 bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
        <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <div className="text-sm font-bold text-gray-900 dark:text-white">
            {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          {isThisWeek && <span className="text-[10px] font-bold uppercase text-primary-500">Current Week</span>}
        </div>
        <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary-500" size={32} />
        </div>
      ) : (
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          {/* Header Row */}
          <div className="grid grid-cols-[minmax(200px,2fr)_repeat(7,1fr)_80px] border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <div className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Ticket</div>
            {weekDates.map((d, i) => (
              <div key={i} className={`px-2 py-3 text-center text-xs font-bold uppercase tracking-wider ${
                isSameDay(d, new Date()) ? 'text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/10' : 'text-gray-400'
              }`}>
                <div>{DAY_LABELS[i]}</div>
                <div className="text-[10px] font-normal">{d.getDate()}</div>
              </div>
            ))}
            <div className="px-2 py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Total</div>
          </div>

          {/* Ticket Rows */}
          {ticketGroups.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-400">
              No time entries for this week.
            </div>
          ) : (
            <>
              {ticketGroups.map(group => {
                const rowTotals = weekDates.map(d =>
                  group.entries.filter(e => isSameDay(new Date(e.created_at), d)).reduce((s, e) => s + Number(e.hours), 0)
                );
                const rowTotal = rowTotals.reduce((s, v) => s + v, 0);

                return (
                  <div key={group.ticketId} className="grid grid-cols-[minmax(200px,2fr)_repeat(7,1fr)_80px] border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                    <div className="px-4 py-3 flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-primary-600 dark:text-primary-400 shrink-0">{group.readableId}</span>
                      <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{group.title}</span>
                    </div>
                    {rowTotals.map((val, i) => (
                      <div key={i} className={`px-2 py-3 text-center text-xs font-medium ${
                        val > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-200 dark:text-gray-700'
                      } ${isSameDay(weekDates[i], new Date()) ? 'bg-primary-50/30 dark:bg-primary-900/5' : ''}`}>
                        {val > 0 ? formatHoursToTime(val) : '—'}
                      </div>
                    ))}
                    <div className="px-2 py-3 text-center text-xs font-bold text-gray-900 dark:text-white">
                      {formatHoursToTime(rowTotal)}
                    </div>
                  </div>
                );
              })}

              {/* Totals Row */}
              <div className="grid grid-cols-[minmax(200px,2fr)_repeat(7,1fr)_80px] bg-gray-50 dark:bg-gray-800/50 border-t-2 border-gray-200 dark:border-gray-700">
                <div className="px-4 py-3 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Daily Total</div>
                {dayTotals.map((val, i) => (
                  <div key={i} className={`px-2 py-3 text-center text-xs font-bold ${
                    val > 0 ? 'text-primary-600 dark:text-primary-400' : 'text-gray-300 dark:text-gray-600'
                  }`}>
                    {val > 0 ? formatHoursToTime(val) : '—'}
                  </div>
                ))}
                <div className="px-2 py-3 text-center text-sm font-bold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 rounded-br-2xl">
                  {formatHoursToTime(grandTotal)}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
