import React from 'react';
import { Code2 } from 'lucide-react';

export default function ProjectFieldConfigEditor({
    selectedConfigCode,
    configCodes,
    configDraft,
    saving,
    readOnly = false,
    onCodeChange,
    onDraftChange,
    onSave,
}) {
    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
                <select
                    value={selectedConfigCode}
                    onChange={(event) => onCodeChange(event.target.value)}
                    className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold"
                >
                    {configCodes.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
                {!readOnly ? (
                    <button
                        onClick={onSave}
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
                    >
                        <Code2 size={16} /> Save JSON Config
                    </button>
                ) : (
                    <span className="inline-flex items-center px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500">
                        Read-only view
                    </span>
                )}
            </div>
            <textarea
                value={configDraft}
                onChange={(event) => {
                    if (!readOnly) onDraftChange(event.target.value);
                }}
                readOnly={readOnly}
                rows={18}
                className={`w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-950 text-gray-100 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500 ${
                    readOnly ? 'opacity-90 cursor-default' : ''
                }`}
            />
        </div>
    );
}
