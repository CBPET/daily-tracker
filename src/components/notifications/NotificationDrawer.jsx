import { useNotifications } from './NotificationProvider';
import NotificationItem from './NotificationItem';

export default function NotificationDrawer() {
  const {
    enabled,
    drawerOpen,
    setDrawerOpen,
    setCenterOpen,
    notifications,
    loading,
    markAllRead,
    unreadCount,
  } = useNotifications();

  if (!enabled || !drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        aria-label="Close notifications"
        onClick={() => setDrawerOpen(false)}
      />
      <aside className="relative w-full max-w-md h-full bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-100 dark:border-gray-800 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-lg">Notifications {unreadCount > 0 ? `(${unreadCount})` : ''}</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => markAllRead()}
              className="text-[10px] font-black uppercase tracking-widest text-blue-600"
            >
              Mark all read
            </button>
            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                setCenterOpen(true);
              }}
              className="text-[10px] font-black uppercase tracking-widest text-gray-500"
            >
              Open center
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3">
          {loading && <p className="text-sm text-gray-500 font-semibold">Loading…</p>}
          {!loading && !notifications.length && (
            <p className="text-sm text-gray-500 font-semibold">No notifications</p>
          )}
          {notifications.map((n) => (
            <NotificationItem key={n.id} item={n} />
          ))}
        </div>
      </aside>
    </div>
  );
}
