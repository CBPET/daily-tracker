export default function HeatmapPanel({ cells = [], title = 'Activity heatmap' }) {
  const max = Math.max(1, ...cells.map((c) => c.count || 0));

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
      <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">{title}</h4>
      {!cells.length && <p className="text-sm text-gray-500 font-semibold">No data</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {cells.map((c) => {
          const intensity = (c.count || 0) / max;
          return (
            <div
              key={c.key}
              className="rounded-xl p-3 border border-gray-100 dark:border-gray-800"
              style={{ backgroundColor: `rgba(37, 99, 235, ${0.08 + intensity * 0.45})` }}
            >
              <div className="text-xs font-bold truncate">{c.key}</div>
              <div className="text-lg font-black">{c.count}</div>
              <div className="text-[10px] text-gray-500">late {c.late || 0}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
