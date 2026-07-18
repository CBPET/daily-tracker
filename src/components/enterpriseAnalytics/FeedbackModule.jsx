import { useEffect, useState } from 'react';
import { createFeedback, listFeedback, archiveFeedback } from '../../lib/enterpriseAnalytics/feedbackService';

export default function FeedbackModule({ profile, accessibleProfiles = [], clients = [], onToast }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState({ feedback_type: '', search: '' });
  const [form, setForm] = useState({
    feedback_type: 'Internal',
    title: '',
    description: '',
    severity: 'Normal',
    performer_id: '',
    client_id: '',
    project_name: '',
    task_type: '',
  });

  const refresh = async () => {
    try {
      const data = await listFeedback(filters);
      setItems(data);
    } catch (err) {
      onToast?.(`❌ ${err.message}`);
    }
  };

  useEffect(() => {
    refresh();
  }, [filters.feedback_type, filters.search]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createFeedback(form, profile);
      onToast?.('✅ Feedback saved');
      setForm((f) => ({ ...f, title: '', description: '' }));
      await refresh();
    } catch (err) {
      onToast?.(`❌ ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-3 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
        <select
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
          value={form.feedback_type}
          onChange={(e) => setForm((f) => ({ ...f, feedback_type: e.target.value }))}
        >
          <option value="Internal">Internal</option>
          <option value="External">External</option>
        </select>
        <select
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
          value={form.severity}
          onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
        >
          {['Low', 'Normal', 'High', 'Critical'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
          value={form.performer_id}
          onChange={(e) => setForm((f) => ({ ...f, performer_id: e.target.value }))}
        >
          <option value="">Performer (optional)</option>
          {accessibleProfiles.map((p) => (
            <option key={p.id} value={p.id}>{p.performer_name || p.email}</option>
          ))}
        </select>
        <select
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
          value={form.client_id}
          onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
        >
          <option value="">Client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.code}>{c.code}</option>
          ))}
        </select>
        <input
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm md:col-span-2"
          placeholder="Title *"
          required
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <textarea
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm md:col-span-2 min-h-[80px]"
          placeholder="Description *"
          required
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        <button
          type="submit"
          disabled={busy}
          className="md:col-span-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
        >
          Save feedback
        </button>
      </form>

      <div className="flex gap-2">
        <select
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
          value={filters.feedback_type}
          onChange={(e) => setFilters((f) => ({ ...f, feedback_type: e.target.value }))}
        >
          <option value="">All types</option>
          <option value="Internal">Internal</option>
          <option value="External">External</option>
        </select>
        <input
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
          placeholder="Search…"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
      </div>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
            <div className="flex justify-between gap-2">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">{item.feedback_type}</span>
                <h4 className="font-bold">{item.title}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{item.description}</p>
              </div>
              <button
                type="button"
                className="text-[10px] font-black uppercase text-red-600"
                onClick={async () => {
                  await archiveFeedback(item.id, 'Archived from UI', profile);
                  onToast?.('🗑️ Feedback archived');
                  refresh();
                }}
              >
                Archive
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
