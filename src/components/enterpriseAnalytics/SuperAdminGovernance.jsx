import { useEffect, useState } from 'react';
import {
  archiveTicket,
  editTicketPriority,
  getGovernanceAuditLog,
  listGovernanceTickets,
  mergeTickets,
  overrideTicketStatus,
  restoreTicket,
  transferOwnership,
} from '../../lib/enterpriseAnalytics/governanceService';

const STATUSES = ['Request', 'Verified', 'Assigned', 'In Progress', 'Need Information', 'Resolved', 'Rejected', 'Closed'];

export default function SuperAdminGovernance({ profile, accessibleProfiles = [], onToast }) {
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [reason, setReason] = useState('');
  const [nextStatus, setNextStatus] = useState('Closed');
  const [priority, setPriority] = useState('High');
  const [newOwner, setNewOwner] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [audit, setAudit] = useState([]);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const data = await listGovernanceTickets({ includeArchived });
    setTickets(data);
    if (selectedId) {
      setAudit(await getGovernanceAuditLog({ entityId: selectedId }));
    }
  };

  useEffect(() => {
    refresh().catch((e) => onToast?.(`❌ ${e.message}`));
  }, [includeArchived]);

  useEffect(() => {
    if (!selectedId) return;
    getGovernanceAuditLog({ entityId: selectedId }).then(setAudit).catch(() => {});
  }, [selectedId]);

  const run = async (fn) => {
    if (!selectedId) {
      onToast?.('❌ Select a ticket');
      return;
    }
    setBusy(true);
    try {
      await fn();
      onToast?.('✅ Governance action applied');
      setReason('');
      await refresh();
    } catch (err) {
      onToast?.(`❌ ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 font-semibold">
        Super Admin governance — every action requires a reason and writes to enterprise_audit_log.
      </p>
      <label className="text-xs font-bold flex items-center gap-2">
        <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
        Include archived
      </label>
      <select
        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
      >
        <option value="">Select ticket</option>
        {tickets.map((t) => (
          <option key={t.id} value={t.id}>
            {t.ticket_number} · {t.status} {t.archived_at ? '(archived)' : ''} — {t.title}
          </option>
        ))}
      </select>
      <textarea
        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm min-h-[72px]"
        placeholder="Reason (required)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />

      <div className="grid md:grid-cols-2 gap-3">
        <div className="flex gap-2 items-center">
          <select className="flex-1 rounded-xl border px-3 py-2 text-sm bg-transparent" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="button" disabled={busy} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase" onClick={() => run(() => overrideTicketStatus(selectedId, nextStatus, reason, profile))}>
            Override status
          </button>
        </div>
        <div className="flex gap-2 items-center">
          <select className="flex-1 rounded-xl border px-3 py-2 text-sm bg-transparent" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {['Low', 'Medium', 'High', 'Critical'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button type="button" disabled={busy} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase" onClick={() => run(() => editTicketPriority(selectedId, priority, reason, profile))}>
            Edit priority
          </button>
        </div>
        <div className="flex gap-2 items-center">
          <select className="flex-1 rounded-xl border px-3 py-2 text-sm bg-transparent" value={newOwner} onChange={(e) => setNewOwner(e.target.value)}>
            <option value="">New owner</option>
            {accessibleProfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.performer_name || p.email}</option>
            ))}
          </select>
          <button type="button" disabled={busy} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase" onClick={() => run(() => transferOwnership(selectedId, newOwner, reason, profile))}>
            Transfer
          </button>
        </div>
        <div className="flex gap-2 items-center">
          <select className="flex-1 rounded-xl border px-3 py-2 text-sm bg-transparent" value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}>
            <option value="">Merge into…</option>
            {tickets.filter((t) => t.id !== selectedId).map((t) => (
              <option key={t.id} value={t.id}>{t.ticket_number}</option>
            ))}
          </select>
          <button type="button" disabled={busy} className="px-3 py-2 rounded-xl bg-amber-600 text-white text-[10px] font-black uppercase" onClick={() => run(() => mergeTickets(selectedId, mergeTarget, reason, profile))}>
            Merge
          </button>
        </div>
        <button type="button" disabled={busy} className="px-3 py-2 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase" onClick={() => run(() => archiveTicket(selectedId, reason, profile))}>
          Archive
        </button>
        <button type="button" disabled={busy} className="px-3 py-2 rounded-xl border text-[10px] font-black uppercase" onClick={() => run(() => restoreTicket(selectedId, reason, profile))}>
          Restore
        </button>
      </div>

      <div>
        <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Audit (latest 100)</h4>
        <ol className="space-y-2 text-xs max-h-64 overflow-y-auto">
          {audit.map((a) => (
            <li key={a.id} className="border-b border-gray-100 dark:border-gray-800 pb-2">
              <span className="font-black text-blue-600">{a.action}</span> · {a.reason}
              <div className="text-gray-400">{a.created_date ? new Date(a.created_date).toLocaleString() : ''}</div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
