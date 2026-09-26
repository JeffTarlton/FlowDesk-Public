import { useState, useMemo, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import { CalendarDays, GanttChartSquare, Filter, Calendar } from 'lucide-react';
import { useTicketStore } from '../store/useTicketStore';
import { useAdminStore } from '../store/useAdminStore';
import { Ticket, TicketPriority } from '../types';
import TicketDetailPanel from '../components/TicketDetailPanel';
import CustomerDropdown from '../components/CustomerDropdown';

// --- Priority color mapping ---
const PRIORITY_COLORS: Record<TicketPriority, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#3b82f6',
  low: '#6b7280',
};

const PRIORITY_BG: Record<TicketPriority, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

type ViewMode = 'calendar' | 'timeline';

// Optional FullCalendar Premium key (the Timeline view uses the premium resource-timeline plugin).
// When unset, FullCalendar shows its own small license notice on the Timeline view only: the
// premium plugin is loaded into the Timeline instance alone, never into the month/week calendar.
const FULLCALENDAR_LICENSE_KEY = import.meta.env.VITE_FULLCALENDAR_LICENSE_KEY || undefined;

export default function CalendarTimeline() {
  const { tickets } = useTicketStore();
  const { users, fetchUsers } = useAdminStore();

  // First visible date, so switching between Calendar and Timeline keeps the same period
  const anchorDateRef = useRef<Date | undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterCustomer, setFilterCustomer] = useState<string>('');
  const [onlyWithDates, setOnlyWithDates] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // --- Filtered tickets ---
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (filterAssignee !== 'all' && t.assigned_to !== filterAssignee) return false;
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (filterCustomer && t.customer_name?.trim() !== filterCustomer) return false;
      if (onlyWithDates && !t.target_completion_date) return false;
      return true;
    });
  }, [tickets, filterAssignee, filterPriority, filterCustomer, onlyWithDates]);

  const unscheduledCount = useMemo(
    () => tickets.filter(t => !t.target_start_date && !t.target_completion_date).length,
    [tickets]
  );

  // --- Events (used for both views — resourceId only matters in timeline mode) ---
  const events = useMemo(() => {
    return filteredTickets
      .filter(t => t.target_start_date || t.target_completion_date)
      .map(t => ({
        id: t.id,
        resourceId: t.assigned_to ?? 'unassigned',
        title: `[${t.readable_id}] ${t.title}`,
        start: t.target_start_date ?? t.target_completion_date!,
        end: t.target_completion_date ?? t.target_start_date!,
        backgroundColor: PRIORITY_COLORS[t.priority],
        borderColor: PRIORITY_COLORS[t.priority],
        textColor: '#ffffff',
        extendedProps: { ticket: t },
      }));
  }, [filteredTickets]);

  // --- Resources for timeline swimlanes ---
  const resources = useMemo(() => {
    const assigneeIds = [...new Set(filteredTickets.map(t => t.assigned_to ?? 'unassigned'))];
    return assigneeIds.map(id => {
      if (id === 'unassigned') return { id: 'unassigned', title: 'Unassigned' };
      const user = users.find(u => u.id === id);
      return { id, title: user?.full_name || user?.email || id };
    });
  }, [filteredTickets, users]);

  const handleEventClick = (info: any) => {
    setSelectedTicket(info.event.extendedProps.ticket as Ticket);
  };

  const handleViewToggle = (mode: ViewMode) => {
    setViewMode(mode);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
            <Calendar size={26} className="text-primary-500" />
            Calendar &amp; Timeline
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Visualize ticket schedules across your team
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <button
            onClick={() => handleViewToggle('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              viewMode === 'calendar'
                ? 'bg-white dark:bg-surface-dark text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <CalendarDays size={16} />
            Calendar
          </button>
          <button
            onClick={() => handleViewToggle('timeline')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              viewMode === 'timeline'
                ? 'bg-white dark:bg-surface-dark text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <GanttChartSquare size={16} />
            Timeline
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap bg-white dark:bg-surface-dark px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <Filter size={15} className="text-gray-400 shrink-0" />
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Filters</span>

        {/* Customer filter */}
        <CustomerDropdown value={filterCustomer} onChange={setFilterCustomer} />

        {/* Assignee filter */}
        <select
          value={filterAssignee}
          onChange={e => setFilterAssignee(e.target.value)}
          className="text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        >
          <option value="all">All Assignees</option>
          <option value="unassigned">Unassigned</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.full_name}</option>
          ))}
        </select>

        {/* Priority filter */}
        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
          className="text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        >
          <option value="all">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Only with dates toggle */}
        <label className="flex items-center gap-2 cursor-pointer ml-1 select-none">
          <div
            onClick={() => setOnlyWithDates(p => !p)}
            className={`relative w-8 h-4 rounded-full transition-colors ${onlyWithDates ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${onlyWithDates ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Only scheduled tickets</span>
        </label>

        {/* Unscheduled badge */}
        {unscheduledCount > 0 && (
          <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700">
            + {unscheduledCount} unscheduled
          </span>
        )}

        {/* Priority legend */}
        <div className="flex items-center gap-2 ml-auto">
          {(Object.keys(PRIORITY_BG) as TicketPriority[]).map(p => (
            <span key={p} className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${PRIORITY_BG[p]}`}>
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* One FullCalendar instance per mode. The distinct keys force a clean remount: swapping
          the plugin list on a live instance is what crashed FullCalendar. */}
      <div className="flex-1 bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden fc-container">
        {viewMode === 'calendar' ? (
          <FullCalendar
            key="calendar"
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate={anchorDateRef.current}
            datesSet={(arg) => { anchorDateRef.current = arg.view.currentStart; }}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,dayGridWeek',
            }}
            events={events}
            eventClick={handleEventClick}
            height="100%"
            eventDisplay="block"
            dayMaxEvents={4}
            moreLinkClassNames="text-primary-600 dark:text-primary-400 font-semibold text-xs"
            eventClassNames="cursor-pointer hover:opacity-80 transition-opacity text-xs font-semibold rounded-md"
          />
        ) : (
          <FullCalendar
            key="timeline"
            schedulerLicenseKey={FULLCALENDAR_LICENSE_KEY}
            plugins={[resourceTimelinePlugin, interactionPlugin]}
            initialView="resourceTimelineMonth"
            initialDate={anchorDateRef.current}
            datesSet={(arg) => { anchorDateRef.current = arg.view.currentStart; }}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'resourceTimelineWeek,resourceTimelineMonth',
            }}
            events={events}
            resources={resources}
            eventClick={handleEventClick}
            height="100%"
            eventDisplay="block"
            resourceAreaHeaderContent="Assignee"
            resourceAreaWidth="180px"
            eventClassNames="cursor-pointer hover:opacity-80 transition-opacity text-xs font-semibold rounded-md"
          />
        )}
      </div>

      {/* Ticket Detail Panel slide-over */}
      {selectedTicket && (
        <TicketDetailPanel
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
}
