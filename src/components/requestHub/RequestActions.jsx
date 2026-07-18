import { useState } from 'react';
import { getAvailableRequestActions } from '../../lib/requestHub/requestHubWorkflow';

const ACTION_LABELS = {
  approve: 'Approve',
  reject: 'Reject',
  need_information: 'Need Information',
  assign: 'Assign',
  reassign: 'Reassign',
  start_work: 'Start Work',
  mark_resolved: 'Mark Resolved',
  close: 'Close',
  change_priority: 'Change Priority',
  add_remark: 'Add Remark',
  add_information: 'Add Information',
};

export default function RequestActions({ ticket, profile, assignableUsers, onAction, busy }) {
  const actions = getAvailableRequestActions(ticket, profile);
  const [remark, setRemark] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState(ticket?.priority || 'Medium');
  const [error, setError] = useState('');

  if (!actions.length) {
    return <p className="text-sm text-gray-500 font-semibold">No actions available for your role on this ticket.</p>;
  }

  const run = async (action) => {
    setError('');
    try {
      await onAction(action, { remark, assigneeId, priority });
      setRemark('');
    } catch (err) {
      setError(err.message || 'Action failed');
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
      <h4 className="text-xs font-black uppercase tracking-widest text-gray-500">Actions</h4>

      {(actions.includes('assign') || actions.includes('reassign') || actions.includes('change_priority') || actions.includes('add_remark') || actions.includes('add_information') || actions.includes('need_information') || actions.includes('reject')) && (
        <div className="grid md:grid-cols-2 gap-3">
          {(actions.includes('assign') || actions.includes('reassign')) && (
            <label className="block space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Assignee</span>
              <select
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">Select user</option>
                {(assignableUsers || []).map((u) => (
                  <option key={u.id} value={u.id}>{u.performer_name || u.email}</option>
                ))}
              </select>
            </label>
          )}
          {actions.includes('change_priority') && (
            <label className="block space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Priority</span>
              <select
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {['Low', 'Medium', 'High', 'Critical'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          )}
          <label className="block space-y-1 md:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Remark / information</span>
            <textarea
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-[72px]"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />
          </label>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={busy}
            onClick={() => run(action)}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
          >
            {ACTION_LABELS[action] || action}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}
    </div>
  );
}
