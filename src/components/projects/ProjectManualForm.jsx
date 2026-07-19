import React from 'react';
import { Loader2, Plus } from 'lucide-react';
import ProjectField from './ProjectField';

export default function ProjectManualForm({
    visibleFields,
    formValues,
    clients,
    workflowKey,
    workflowOptions,
    saving,
    onFieldChange,
    onWorkflowChange,
    onSave,
}) {
    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {visibleFields.map((field) => (
                    <ProjectField
                        key={field.key}
                        field={field}
                        value={formValues[field.key]}
                        clients={clients}
                        onChange={onFieldChange}
                    />
                ))}
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Workflow</label>
                    <select
                        value={workflowKey}
                        onChange={(event) => onWorkflowChange(event.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {workflowOptions.map(([key, template]) => (
                            <option key={key} value={key}>{template.label || key}</option>
                        ))}
                    </select>
                </div>
            </div>
            <button
                onClick={onSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
            >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Save Project and Create Workflow
            </button>
        </div>
    );
}
