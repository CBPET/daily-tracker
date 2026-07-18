const CARDS = [
  { key: 'open', label: 'Open Requests', color: 'border-blue-500' },
  { key: 'critical', label: 'Critical', color: 'border-red-500' },
  { key: 'assigned', label: 'Assigned', color: 'border-indigo-500' },
  { key: 'resolved', label: 'Resolved', color: 'border-emerald-500' },
  { key: 'rejected', label: 'Rejected', color: 'border-orange-500' },
  { key: 'overdue', label: 'Overdue (7d+)', color: 'border-amber-500' },
];

function DistList({ title, data }) {
  const entries = Object.entries(data || {});
  if (!entries.length) return null;
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
      <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">{title}</h4>
      <ul className="space-y-2">
        {entries.map(([k, v]) => (
          <li key={k} className="flex justify-between text-sm font-semibold">
            <span>{k}</span>
            <span className="text-blue-600">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RequestHubDashboard({ stats, myCount, onOpenList }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {CARDS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={onOpenList}
            className={`text-left rounded-2xl border-l-4 ${c.color} bg-gray-50 dark:bg-gray-800/60 p-4 shadow-sm`}
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">{c.label}</div>
            <div className="text-2xl font-black mt-1">{stats?.[c.key] ?? 0}</div>
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">My Requests</div>
        <div className="text-2xl font-black mt-1">{myCount ?? 0}</div>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DistList title="By Priority" data={stats?.byPriority} />
        <DistList title="By Category" data={stats?.byCategory} />
        <DistList title="By Status" data={stats?.byStatus} />
        <DistList title="By Client" data={stats?.byClient} />
      </div>
    </div>
  );
}
