import React from 'react';
import { ClipboardPaste, Loader2, Save } from 'lucide-react';
import PreviewTable from './PreviewTable';

export default function ProjectPasteIntake({
    pasteText,
    workflowKey,
    workflowOptions,
    previewRows,
    saving,
    onPasteChange,
    onWorkflowChange,
    onParse,
    onToggleRow,
    onSaveSelected,
}) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4 items-end">
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Paste Google Sheet rows</label>
                    <textarea
                        value={pasteText}
                        onChange={(event) => onPasteChange(event.target.value)}
                        rows={6}
                        placeholder="Title\tClient\tSUB_DIV\tPages"
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Workflow</label>
                    <select
                        value={workflowKey}
                        onChange={(event) => onWorkflowChange(event.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
                    >
                        {workflowOptions.map(([key, template]) => (
                            <option key={key} value={key}>{template.label || key}</option>
                        ))}
                    </select>
                    <button onClick={onParse} className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest">
                        <ClipboardPaste size={16} /> Preview
                    </button>
                </div>
            </div>
            <PreviewTable rows={previewRows} onToggle={onToggleRow} />
            {previewRows.length ? (
                <button
                    onClick={onSaveSelected}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-green-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Save Selected Projects
                </button>
            ) : null}
        </div>
    );
}
