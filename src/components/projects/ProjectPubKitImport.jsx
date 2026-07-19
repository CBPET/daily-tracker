import React from 'react';
import { DownloadCloud, Loader2 } from 'lucide-react';

export default function ProjectPubKitImport({
    pubKitQuery,
    saving,
    onQueryChange,
    onFetch,
}) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <input
                    value={pubKitQuery}
                    onChange={(event) => onQueryChange(event.target.value)}
                    placeholder="PubKit query, title id, or endpoint parameter"
                    className="px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                    onClick={onFetch}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />}
                    Load PubKit Preview
                </button>
            </div>
            <p className="text-sm font-semibold text-gray-500">
                PubKit v1 uses the same preview pipeline. The endpoint adapter is ready for contract details.
            </p>
        </div>
    );
}
