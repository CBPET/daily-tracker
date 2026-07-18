import { useMemo } from 'react';

export default function BehaviourDashboard({ scoresByUser = [], profileNameById = {} }) {
  const rows = useMemo(
    () =>
      [...scoresByUser].sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0)),
    [scoresByUser]
  );

  if (!rows.length) {
    return (
      <p className="text-sm text-gray-500 font-semibold py-8 text-center">
        No behaviour scores for this period yet. Enable snapshots or ensure entries exist.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 font-semibold">
        Behaviour Score is separate from Analytics Performance Rating. Completion reuses productivity targets; attendance/timeliness use entry habits.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-800/80 text-[10px] uppercase tracking-widest text-gray-500">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Overall</th>
              <th className="px-3 py-2">Attendance</th>
              <th className="px-3 py-2">Consistency</th>
              <th className="px-3 py-2">Timeliness</th>
              <th className="px-3 py-2">Completion</th>
              <th className="px-3 py-2">Missed</th>
              <th className="px-3 py-2">Late</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="px-3 py-2 font-semibold">{profileNameById[r.user_id] || r.user_id?.slice(0, 8)}</td>
                <td className="px-3 py-2 font-black text-blue-600">{r.overall_score}</td>
                <td className="px-3 py-2">{r.attendance_score}</td>
                <td className="px-3 py-2">{r.consistency_score}</td>
                <td className="px-3 py-2">{r.timeliness_score}</td>
                <td className="px-3 py-2">{r.completion_score}</td>
                <td className="px-3 py-2">{r.missed_entries}</td>
                <td className="px-3 py-2">{r.late_entries}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
