import { useState, useRef, useEffect } from 'react';
import { Bell, Check, Circle, AlertCircle, MessageSquare, AtSign, Loader2 } from 'lucide-react';
import { useNotificationStore } from '../store/useNotificationStore';
import { useAuthStore } from '../store/useAuthStore';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { user } = useAuthStore();
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    fetchNotifications, 
    markAsRead, 
    clearAllNotifications,
    subscribeToNotifications,
    unsubscribeFromNotifications
  } = useNotificationStore();

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
      subscribeToNotifications(user.id);
      
      return () => {
        unsubscribeFromNotifications();
      };
    }
  }, [user?.id]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'status_change': return <AlertCircle size={16} className="text-orange-500" />;
      case 'assignment': return <Check size={16} className="text-green-500" />;
      case 'new_comment': return <MessageSquare size={16} className="text-blue-500" />;
      case 'mention': return <AtSign size={16} className="text-purple-500" />;
      default: return <Bell size={16} className="text-gray-500" />;
    }
  };

  return (
    <div className="relative z-50" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none"
      >
        <Bell size={20} className={unreadCount > 0 ? 'text-primary-500' : ''} />
        {unreadCount > 0 && (
          <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-surface-dark" />
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white dark:bg-surface-dark rounded-2xl shadow-xl shadow-black/10 border border-gray-100 dark:border-gray-800 overflow-hidden transform origin-top-left transition-all">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/30">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} New
                </span>
              )}
            </h3>
            {notifications.length > 0 && (
              <button 
                onClick={() => clearAllNotifications()}
                className="text-xs font-semibold text-gray-500 hover:text-red-500 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {isLoading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                <p className="text-sm">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Bell className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No notifications yet</p>
                <p className="text-xs mt-1">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id}
                    onClick={() => {
                        if (!notification.is_read) markAsRead(notification.id);
                        // Future: Could trigger opening TicketDetailPanel here using a global state if desired
                    }}
                    className={`px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer block ${
                      !notification.is_read ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm border border-gray-100 dark:border-gray-800 ${
                        !notification.is_read ? 'bg-white dark:bg-gray-800' : 'bg-gray-100 dark:bg-transparent'
                      }`}>
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className={`text-sm tracking-tight ${!notification.is_read ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-700 dark:text-gray-300'}`}>
                            {notification.title}
                          </p>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0 font-medium">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className={`text-sm leading-snug line-clamp-2 ${!notification.is_read ? 'text-gray-600 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                          {notification.message}
                        </p>
                      </div>
                      {!notification.is_read && (
                        <div className="shrink-0 flex items-center justify-center">
                          <Circle size={8} className="fill-primary-500 text-primary-500" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-3 bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 text-center">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">FlowDesk Inbox</span>
          </div>
        </div>
      )}
    </div>
  );
}
