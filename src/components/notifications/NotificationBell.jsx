import { Bell } from 'lucide-react';
import { useNotifications } from './NotificationProvider';

export default function NotificationBell() {
  const { enabled, unreadCount, drawerOpen, setDrawerOpen } = useNotifications();
  if (!enabled) return null;

  return (
    <button
      type="button"
      onClick={() => setDrawerOpen(!drawerOpen)}
      className="relative p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      aria-label="Notifications"
    >
      <Bell size={18} />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
