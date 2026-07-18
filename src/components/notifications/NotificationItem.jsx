import { useNotifications } from './NotificationProvider';

export default function NotificationItem({ item }) {
  const { markAsRead, deleteNotification, setDrawerOpen, setCenterOpen } = useNotifications();

  const openTicket = async () => {
    if (!item.read) await markAsRead(item.id);
    const ref = item.reference_id;
    if (item.module === 'smart_request_hub' && ref) {
      window.location.hash = `#request-hub`;
      // Soft signal for hub deep-link via sessionStorage
      sessionStorage.setItem('srh_open_ticket', ref);
      setDrawerOpen(false);
      setCenterOpen(false);
      window.dispatchEvent(new CustomEvent('srh-open-ticket', { detail: { id: ref } }));
    }
  };

  return (
    <div
      className={`p-3 rounded-xl border ${
        item.read
          ? 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'
          : 'border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30'
      }`}
    >
      <button type="button" onClick={openTicket} className="text-left w-full">
        <div className="text-sm font-bold">{item.title}</div>
        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{item.message}</p>
        <div className="text-[10px] text-gray-400 mt-2">
          {item.created_date ? new Date(item.created_date).toLocaleString() : ''}
          {item.action_required ? ' · Action required' : ''}
        </div>
      </button>
      <div className="flex flex-wrap gap-2 mt-2">
        {(item.notification_actions || []).map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={openTicket}
            className="px-2 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider"
          >
            {a.label}
          </button>
        ))}
        {!item.read && (
          <button
            type="button"
            onClick={() => markAsRead(item.id)}
            className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-[10px] font-bold uppercase"
          >
            Mark read
          </button>
        )}
        <button
          type="button"
          onClick={() => deleteNotification(item.id)}
          className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-[10px] font-bold uppercase text-red-600"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
