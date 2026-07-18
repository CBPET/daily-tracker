import { useMemo, useState } from 'react';
import { useNotifications } from './NotificationProvider';
import NotificationItem from './NotificationItem';

export default function NotificationCenter() {
  const { enabled, centerOpen, setCenterOpen, notifications, markAllRead, loading } = useNotifications();
  const [moduleFilter, setModuleFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const filtered = useMemo(() => {
    return (notifications || []).filter((n) => {
      if (moduleFilter && n.module !== moduleFilter) return false;
      if (unreadOnly && n.read) return false;
      return true;
    });
  }, [notifications, moduleFilter, unreadOnly]);

  if (!enabled || !centerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close notification center"
        onClick={() => setCenterOpen(false)}
      />
      <div className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-3xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-2xl flex flex-col">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-black text-xl">Notification Center</h3>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-1.5 text-xs"
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
            >
              <option value="">All modules</option>
              <option value="smart_request_hub">Smart Request Hub</option>
              <option value="daily_tracker">Daily Tracker</option>
              <option value="admin">Admin</option>
              <option value="system">System</option>
            </select>
            <label className="text-xs font-bold flex items-center gap-1">
              <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
              Unread only
            </label>
            <button type="button" onClick={() => markAllRead()} className="text-[10px] font-black uppercase text-blue-600">
              Mark all read
            </button>
            <button type="button" onClick={() => setCenterOpen(false)} className="text-[10px] font-black uppercase text-gray-500">
              Close
            </button>
          </div>
        </div>
        <div className="p-4 overflow-y-auto space-y-3">
          {loading && <p className="text-sm text-gray-500 font-semibold">Loading…</p>}
          {!loading && !filtered.length && <p className="text-sm text-gray-500 font-semibold">No notifications</p>}
          {filtered.map((n) => (
            <NotificationItem key={n.id} item={n} />
          ))}
        </div>
      </div>
    </div>
  );
}
