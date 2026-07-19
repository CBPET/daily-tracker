import React, { useMemo, useState } from 'react';
import { Loader2, Settings, UserCheck } from 'lucide-react';
import DateReasonModal from './DateReasonModal';
import { canEditProjectScheduleDates, canUpdateScheduleTask } from '../../lib/projects/projectScheduleScope';

function formatDisplayDate(value) {
    if (!value) return '-';
    return String(value).slice(0, 10);
}

function profileName(profiles, userId, fallback = '-') {
    return profiles.find((profile) => profile.id === userId)?.performer_name || fallback;
}

/**
 * Date fields that require reason + audit event (leads only).
 * completed_date for assignees does not require reason modal.
 */
const LEAD_DATE_FIELDS = ['due_from_performer', 'due_date', 'revised_due_date'];

export default function ProjectTracker({
    loading,
    projects,
    tasksByProject,
    profiles,
    canManage,
    profile,
    session,
    saving,
    onTaskUpdate,
}) {
    const canEditDates = canEditProjectScheduleDates(profile);
    const [pendingDateEdit, setPendingDateEdit] = useState(null);

    const pendingSummary = useMemo(() => {
        if (!pendingDateEdit) return '';
        const { field, nextValue, task } = pendingDateEdit;
        return `${task.workflow_stage}: ${field} → ${nextValue || '(clear)'}`;
    }, [pendingDateEdit]);

    if (loading) {
        return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-indigo-600" /></div>;
    }
    if (!projects.length) {
        return (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
                <Settings className="mx-auto mb-3 text-gray-400" />
                <p className="text-sm font-bold text-gray-500">No projects visible yet</p>
            </div>
        );
    }

    const requestDateEdit = (task, field, nextValue) => {
        const current = task[field] || '';
        const normalized = nextValue || null;
        if ((current || '') === (normalized || '')) return;

        if (LEAD_DATE_FIELDS.includes(field) && canEditDates) {
            setPendingDateEdit({ task, field, nextValue: normalized });
            return;
        }
        onTaskUpdate(task, { [field]: normalized });
    };

    const confirmDateEdit = async ({ reasonCode, note }) => {
        if (!pendingDateEdit) return;
        const { task, field, nextValue } = pendingDateEdit;
        await onTaskUpdate(task, { [field]: nextValue }, { reasonCode, note, isDateChange: true });
        setPendingDateEdit(null);
    };

    return (
        <div className="space-y-4">
            <DateReasonModal
                show={Boolean(pendingDateEdit)}
                title="Confirm schedule date change"
                summary={pendingSummary}
                saving={saving}
                onClose={() => setPendingDateEdit(null)}
                onConfirm={confirmDateEdit}
            />

            {projects.map((project) => {
                const tasks = tasksByProject[project.id] || [];
                return (
                    <div key={project.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white">{project.title}</h3>
                                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                                    {project.client_id} {project.sub_division ? `/ ${project.sub_division}` : ''} / {project.status}
                                </p>
                            </div>
                            <div className="text-xs font-bold text-gray-500">
                                Due: {formatDisplayDate(project.revised_due_date || project.due_date)}
                            </div>
                        </div>
                        <div className="overflow-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                        <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Stage</th>
                                        <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Division</th>
                                        <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Performer</th>
                                        <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Due from Performer</th>
                                        <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Due</th>
                                        <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Revised Due</th>
                                        <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Completed</th>
                                        <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {tasks.map((task) => {
                                        const isAssignee = task.assigned_to === session?.user?.id;
                                        const canUpdate = canUpdateScheduleTask(task, session, canManage);
                                        return (
                                            <tr key={task.id}>
                                                <td className="p-3 font-bold text-gray-900 dark:text-white">{task.stage_order}. {task.workflow_stage}</td>
                                                <td className="p-3 font-semibold text-gray-600 dark:text-gray-300">{task.division || '-'}</td>
                                                <td className="p-3 min-w-[220px]">
                                                    {canManage ? (
                                                        <select
                                                            value={task.assigned_to || ''}
                                                            onChange={(event) => onTaskUpdate(task, { assigned_to: event.target.value || null })}
                                                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-bold"
                                                        >
                                                            <option value="">Unassigned</option>
                                                            {profiles.map((item) => (
                                                                <option key={item.id} value={item.id}>{item.performer_name}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 font-semibold text-gray-600 dark:text-gray-300">
                                                            <UserCheck size={14} /> {profileName(profiles, task.assigned_to, isAssignee ? 'You' : '-')}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <input
                                                        type="date"
                                                        value={task.due_from_performer || ''}
                                                        disabled={!canEditDates}
                                                        onChange={(event) => requestDateEdit(task, 'due_from_performer', event.target.value)}
                                                        className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-bold disabled:opacity-60"
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <input
                                                        type="date"
                                                        value={task.due_date || ''}
                                                        disabled={!canEditDates}
                                                        onChange={(event) => requestDateEdit(task, 'due_date', event.target.value)}
                                                        className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-bold disabled:opacity-60"
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <input
                                                        type="date"
                                                        value={task.revised_due_date || ''}
                                                        disabled={!canEditDates}
                                                        onChange={(event) => requestDateEdit(task, 'revised_due_date', event.target.value)}
                                                        className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-bold disabled:opacity-60"
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <input
                                                        type="date"
                                                        value={task.completed_date || ''}
                                                        disabled={!canUpdate}
                                                        onChange={(event) => {
                                                            const value = event.target.value || null;
                                                            onTaskUpdate(task, {
                                                                completed_date: value,
                                                                completed_from_performer: value,
                                                            });
                                                        }}
                                                        className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-bold disabled:opacity-60"
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">{task.allocation_status}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
