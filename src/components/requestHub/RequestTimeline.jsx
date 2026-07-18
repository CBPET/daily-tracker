export default function RequestTimeline({ events, profileNameById }) {
  if (!events?.length) {
    return <p className="text-sm text-gray-500 font-semibold">No audit events yet.</p>;
  }

  return (
    <ol className="space-y-3 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
      {events.map((ev) => (
        <li key={ev.id} className="relative">
          <span className="absolute -left-[1.4rem] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500" />
          <div className="text-xs font-black uppercase tracking-widest text-blue-600">{ev.event_type}</div>
          <div className="text-sm font-semibold">
            {profileNameById?.[ev.actor_id] || ev.actor_role || 'System'}
            {ev.old_status && ev.new_status ? ` · ${ev.old_status} → ${ev.new_status}` : null}
            {ev.old_priority && ev.new_priority ? ` · ${ev.old_priority} → ${ev.new_priority}` : null}
          </div>
          {ev.remark && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{ev.remark}</p>}
          <div className="text-[10px] text-gray-400 mt-1">
            {ev.created_date ? new Date(ev.created_date).toLocaleString() : ''}
          </div>
        </li>
      ))}
    </ol>
  );
}
