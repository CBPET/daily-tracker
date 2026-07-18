export default function Leaderboards({ contributions = [], profileNameById = {} }) {
  const boards = [
    { key: 'bugs', label: 'Top Bug Reporter', field: 'bugs' },
    { key: 'features', label: 'Feature Contributor', field: 'features' },
    { key: 'improvements', label: 'Improvement Contributor', field: 'improvements' },
    { key: 'resolved', label: 'Fast Resolver (resolved count)', field: 'resolved' },
  ];

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {boards.map((b) => {
        const ranked = [...contributions]
          .filter((c) => (c[b.field] || 0) > 0 && (c.total || 0) - (c.rejected || 0) > 0)
          .sort((a, c) => (c[b.field] || 0) - (a[b.field] || 0))
          .slice(0, 10);
        return (
          <div key={b.key} className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">{b.label}</h4>
            {!ranked.length && <p className="text-sm text-gray-500 font-semibold">No data</p>}
            <ol className="space-y-2 text-sm">
              {ranked.map((r, i) => (
                <li key={r.user_id} className="flex justify-between">
                  <span>
                    <span className="text-gray-400 mr-2">{i + 1}.</span>
                    {profileNameById[r.user_id] || r.user_id?.slice(0, 8)}
                  </span>
                  <span className="font-black text-blue-600">{r[b.field]}</span>
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
