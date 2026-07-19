import { useState } from 'react';
import ScreenshotUploader from './ScreenshotUploader';

const CATEGORIES = ['Bug', 'Improvement', 'Feature Update', 'Enhancement'];

export default function RequestCreateForm({ onSubmit, onCancel, busy }) {
  const [form, setForm] = useState({
    category: 'Bug',
    title: '',
    description: '',
    additional_information: '',
    priority: 'Medium',
  });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.category || !form.title.trim() || !form.description.trim()) {
      setError('Category, title, and description are required');
      return;
    }
    try {
      await onSubmit(form, files);
    } catch (err) {
      setError(err.message || 'Failed to create request');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
      <div className="grid md:grid-cols-2 gap-4">
        <label className="block space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Category *</span>
          <select
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
            value={form.category}
            onChange={(e) => setField('category', e.target.value)}
            required
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Priority</span>
          <select
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
            value={form.priority}
            onChange={(e) => setField('priority', e.target.value)}
          >
            {['Low', 'Medium', 'High', 'Critical'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Title *</span>
        <input
          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
          value={form.title}
          onChange={(e) => setField('title', e.target.value)}
          required
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Description *</span>
        <textarea
          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 min-h-[120px]"
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
          required
        />
      </label>

      <details className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-widest text-gray-500">
          Additional information
        </summary>
        <textarea
          className="mt-3 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 min-h-[80px]"
          value={form.additional_information}
          onChange={(e) => setField('additional_information', e.target.value)}
        />
      </details>

      <ScreenshotUploader files={files} onChange={setFiles} disabled={busy} />

      {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="px-6 py-3 rounded-xl bg-blue-600 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-500/30 disabled:opacity-50"
        >
          {busy ? 'Submitting…' : 'Raise Request'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-xs uppercase tracking-widest"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
