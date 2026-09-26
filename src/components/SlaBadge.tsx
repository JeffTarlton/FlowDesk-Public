import { Clock, AlertTriangle, CheckCircle2, Timer } from 'lucide-react';
import { useMemo } from 'react';

interface Props {
  responseDeadline: string | null;
  resolutionDeadline: string | null;
  responseBreach: boolean;
  resolutionBreach: boolean;
  firstRespondedAt: string | null;
  status: string;
  /** 'badge' = compact inline badge, 'detail' = full status section */
  variant?: 'badge' | 'detail';
}

/** Returns a human-readable time-remaining string and urgency level */
function getTimeRemaining(deadline: string | null): { text: string; urgency: 'ok' | 'warning' | 'breached' | 'none' } {
  if (!deadline) return { text: '—', urgency: 'none' };

  const now = new Date();
  const target = new Date(deadline);
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    // How long ago it breached
    const agoMs = Math.abs(diffMs);
    const agoHours = Math.floor(agoMs / (1000 * 60 * 60));
    const agoDays = Math.floor(agoHours / 24);
    if (agoDays > 0) return { text: `${agoDays}d overdue`, urgency: 'breached' };
    if (agoHours > 0) return { text: `${agoHours}h overdue`, urgency: 'breached' };
    return { text: 'Just breached', urgency: 'breached' };
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  const minutes = totalMinutes % 60;

  // Warning threshold: less than 25% of original time remaining
  const isWarning = hours <= 2;

  if (days > 0) {
    return { text: `${days}d ${remainingHours}h left`, urgency: isWarning ? 'warning' : 'ok' };
  }
  if (hours > 0) {
    return { text: `${hours}h ${minutes}m left`, urgency: isWarning ? 'warning' : 'ok' };
  }
  return { text: `${minutes}m left`, urgency: 'warning' };
}

const urgencyColors = {
  ok: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
  warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
  breached: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  none: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700',
};

const urgencyIcons = {
  ok: <CheckCircle2 size={12} />,
  warning: <Timer size={12} />,
  breached: <AlertTriangle size={12} />,
  none: <Clock size={12} />,
};

export default function SlaBadge({ responseDeadline, resolutionDeadline, responseBreach, resolutionBreach, firstRespondedAt, status, variant = 'badge' }: Props) {
  const { responseInfo, resolutionInfo, worstUrgency } = useMemo(() => {
    const isDone = status === 'done';
    
    if (isDone) {
      return {
        responseInfo: { text: responseBreach ? 'Response SLA Breached' : 'Met', urgency: responseBreach ? 'breached' as const : 'ok' as const },
        resolutionInfo: { text: resolutionBreach ? 'Resolution SLA Breached' : 'Met', urgency: resolutionBreach ? 'breached' as const : 'ok' as const },
        worstUrgency: (responseBreach || resolutionBreach) ? 'breached' as const : 'ok' as const,
      };
    }

    const rInfo = firstRespondedAt
      ? { text: responseBreach ? 'Response Breached' : 'Responded', urgency: responseBreach ? 'breached' as const : 'ok' as const }
      : getTimeRemaining(responseDeadline);

    const sInfo = getTimeRemaining(resolutionDeadline);

    // Show the worst urgency level
    const urgencyRank = { none: 0, ok: 1, warning: 2, breached: 3 };
    const worst = urgencyRank[sInfo.urgency] >= urgencyRank[rInfo.urgency] ? sInfo.urgency : rInfo.urgency;

    return { responseInfo: rInfo, resolutionInfo: sInfo, worstUrgency: worst };
  }, [responseDeadline, resolutionDeadline, responseBreach, resolutionBreach, firstRespondedAt, status]);

  // Don't show badge if no SLA is configured
  if (!responseDeadline && !resolutionDeadline) return null;

  if (variant === 'badge') {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border shadow-sm ${urgencyColors[worstUrgency]}`}>
        {urgencyIcons[worstUrgency]}
        <span>SLA: {resolutionInfo.text}</span>
      </span>
    );
  }

  // Detail variant - full section for TicketDetailPanel
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
        <Clock size={13} /> SLA Status
      </h4>
      <div className="grid grid-cols-2 gap-3">
        {/* Response SLA */}
        <div className={`p-3 rounded-xl border ${urgencyColors[responseInfo.urgency]}`}>
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Response</div>
          <div className="flex items-center gap-1.5 text-sm font-bold">
            {urgencyIcons[responseInfo.urgency]}
            {responseInfo.text}
          </div>
          {responseDeadline && (
            <div className="text-[10px] opacity-60 mt-1">
              Deadline: {new Date(responseDeadline).toLocaleString()}
            </div>
          )}
        </div>
        {/* Resolution SLA */}
        <div className={`p-3 rounded-xl border ${urgencyColors[resolutionInfo.urgency]}`}>
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Resolution</div>
          <div className="flex items-center gap-1.5 text-sm font-bold">
            {urgencyIcons[resolutionInfo.urgency]}
            {resolutionInfo.text}
          </div>
          {resolutionDeadline && (
            <div className="text-[10px] opacity-60 mt-1">
              Deadline: {new Date(resolutionDeadline).toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
