const STATUS_COLORS = {
  Request: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  Verified: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  Assigned: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  'In Progress': 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  'Need Information': 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  Resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  Rejected: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  Closed: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
};

const PRIORITY_COLORS = {
  Low: 'text-slate-500',
  Medium: 'text-blue-600',
  High: 'text-orange-600',
  Critical: 'text-red-600 font-black',
};

export function StatusBadge({ status }) {
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${STATUS_COLORS[status] || STATUS_COLORS.Request}`}>
      {status}
    </span>
  );
}

export function PriorityLabel({ priority }) {
  return <span className={`text-xs font-bold ${PRIORITY_COLORS[priority] || ''}`}>{priority}</span>;
}

export default function RequestList({ tickets, onSelect, profileNameById }) {
  if (!tickets?.length) {
    return (
      <div className="text-center py-16 text-gray-500 font-semibold">
        No requests yet. Create one to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800/80 text-[10px] uppercase tracking-widest text-gray-500">
          <tr>
            <th className="px-4 py-3">Ticket</th>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Assignee</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr
              key={t.id}
              onClick={() => onSelect(t)}
              className="border-t border-gray-100 dark:border-gray-800 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 cursor-pointer"
            >
              <td className="px-4 py-3 font-mono text-xs font-bold text-blue-600">{t.ticket_number}</td>
              <td className="px-4 py-3 font-semibold max-w-[240px] truncate">{t.title}</td>
              <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
              <td className="px-4 py-3"><PriorityLabel priority={t.priority} /></td>
              <td className="px-4 py-3">{t.client_id || '—'}</td>
              <td className="px-4 py-3">{t.assigned_to ? (profileNameById?.[t.assigned_to] || 'Assigned') : '—'}</td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {t.created_date ? new Date(t.created_date).toLocaleDateString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
