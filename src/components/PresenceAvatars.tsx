import { usePresenceStore, PresenceUser } from '../store/usePresenceStore';
import { useAuthStore } from '../store/useAuthStore';

interface Props {
  ticketId: string;
}

export default function PresenceAvatars({ ticketId }: Props) {
  const presenceByRoom = usePresenceStore((s) => s.presenceByRoom);
  const myProfile = useAuthStore((s) => s.profile);

  const users: PresenceUser[] = (presenceByRoom[ticketId] || []).filter(
    (u) => u.userId !== myProfile?.id
  );

  if (users.length === 0) return null;

  const MAX_SHOWN = 4;
  const shown = users.slice(0, MAX_SHOWN);
  const overflow = users.length - MAX_SHOWN;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-gray-400 mr-1 hidden sm:inline">Also viewing:</span>
      <div className="flex -space-x-2">
        {shown.map((u) => (
          <div
            key={u.userId}
            title={u.fullName || u.email}
            className={`w-7 h-7 rounded-full ${u.color} flex items-center justify-center text-white text-[11px] font-bold border-2 border-white dark:border-surface-dark shrink-0 ring-2 ring-white dark:ring-surface-dark`}
          >
            {u.avatarLetter}
          </div>
        ))}
        {overflow > 0 && (
          <div
            title={`${overflow} more viewing`}
            className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 text-[10px] font-bold border-2 border-white dark:border-surface-dark"
          >
            +{overflow}
          </div>
        )}
      </div>
      <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-semibold ml-1">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
        Live
      </span>
    </div>
  );
}
