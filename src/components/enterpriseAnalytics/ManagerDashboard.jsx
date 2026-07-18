export default function ManagerDashboard({
  inactiveUsers = [],
  delayedTickets = [],
  teamHealth = 0,
  missedLate = [],
  profileNameById = {},
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border-l-4 border-blue-500 bg-gray-50 dark:bg-gray-800/60 p-4">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Team Health Score</div>
        <div className="text-3xl font-black mt-1">{teamHealth}</div>
        <p className="text-xs text-gray-500 mt-1">0.5× Behaviour + 0.25× Request resolution + 0.25× Entry coverage</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Inactive users (no entries in period)">
          {!inactiveUsers.length && <Empty />}
          <ul className="space-y-1 text-sm">
            {inactiveUsers.map((u) => (
              <li key={u}>{profileNameById[u] || u}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="Missed / late patterns">
          {!missedLate.length && <Empty />}
          <ul className="space-y-2 text-sm">
            {missedLate.map((r) => (
              <li key={r.user_id} className="flex justify-between gap-2">
                <span className="font-semibold">{profileNameById[r.user_id] || r.user_id?.slice(0, 8)}</span>
                <span className="text-xs text-gray-500">missed {r.missed_entries} · late {r.late_entries}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Delayed Smart Request Hub tickets (7d+)">
        {!delayedTickets.length && <Empty />}
        <ul className="space-y-2 text-sm">
          {delayedTickets.map((t) => (
            <li key={t.id} className="flex justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
              <span className="font-mono text-xs text-blue-600">{t.ticket_number}</span>
              <span className="font-semibold truncate">{t.title}</span>
              <span className="text-xs text-gray-500">{t.status}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
      <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">{title}</h4>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-gray-500 font-semibold">None</p>;
}
