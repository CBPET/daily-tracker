import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    Check,
    ClipboardPaste,
    Code2,
    Database,
    DownloadCloud,
    Loader2,
    Plus,
    RefreshCw,
    Save,
    Settings,
    UserCheck,
} from 'lucide-react';
import {
    PROJECT_MANAGER_ROLES,
    buildProjectRecordPayload,
    buildScheduleTemplateRows,
    fallbackConfigRows,
    fetchPubKitProjects,
    getConfigForClient,
    getVisibleProjectFields,
    normalizeClientCode,
    parsePastedProjectRows,
    validateProjectValues,
} from '../lib/projectFieldConfig';

const emptyFormValues = (clientCode = '') => ({
    title: '',
    client: clientCode,
    status: 'new',
});

function formatDisplayDate(value) {
    if (!value) return '-';
    return String(value).slice(0, 10);
}

function profileName(profiles, userId, fallback = '-') {
    return profiles.find((profile) => profile.id === userId)?.performer_name || fallback;
}

function ProjectField({ field, value, clients, disabled, onChange }) {
    const commonClass = 'w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500';
    const label = (
        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
            {field.label || field.key}{field.required ? ' *' : ''}
        </label>
    );

    if (field.type === 'textarea') {
        return (
            <div>
                {label}
                <textarea
                    value={value || ''}
                    disabled={disabled}
                    onChange={(event) => onChange(field.key, event.target.value)}
                    rows={3}
                    className={commonClass}
                />
            </div>
        );
    }

    if (field.type === 'select') {
        return (
            <div>
                {label}
                <select
                    value={value || ''}
                    disabled={disabled}
                    onChange={(event) => onChange(field.key, event.target.value)}
                    className={commonClass}
                >
                    <option value="">Select</option>
                    {(field.options || []).map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            </div>
        );
    }

    if (field.type === 'client') {
        return (
            <div>
                {label}
                <select
                    value={value || ''}
                    disabled={disabled}
                    onChange={(event) => onChange(field.key, event.target.value)}
                    className={commonClass}
                >
                    <option value="">Select client</option>
                    {clients.map((client) => (
                        <option key={client.id || client.code} value={client.code}>{client.code}</option>
                    ))}
                </select>
            </div>
        );
    }

    return (
        <div>
            {label}
            <input
                type={field.type === 'number' || field.type === 'date' ? field.type : 'text'}
                min={field.min}
                max={field.max}
                value={value || ''}
                disabled={disabled}
                onChange={(event) => onChange(field.key, event.target.value)}
                className={commonClass}
            />
        </div>
    );
}

export default function ProjectDatabaseManager({
    supabase,
    session,
    profile,
    allProfiles = [],
    clients = [],
}) {
    const canManage = PROJECT_MANAGER_ROLES.includes(profile?.role);
    const canEditConfig = ['super_admin', 'general_manager', 'manager'].includes(profile?.role);
    const defaultClientCode = clients[0]?.code || profile?.client_id || 'OUP';
    const [mode, setMode] = useState(canManage ? 'manual' : 'assigned');
    const [fieldConfigs, setFieldConfigs] = useState(fallbackConfigRows());
    const [projects, setProjects] = useState([]);
    const [scheduleTasks, setScheduleTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [formValues, setFormValues] = useState(() => emptyFormValues(defaultClientCode));
    const [workflowKey, setWorkflowKey] = useState('preedit');
    const [pasteText, setPasteText] = useState('');
    const [previewRows, setPreviewRows] = useState([]);
    const [selectedConfigCode, setSelectedConfigCode] = useState('DEFAULT');
    const [configDraft, setConfigDraft] = useState('');
    const [pubKitQuery, setPubKitQuery] = useState('');

    const activeConfig = useMemo(
        () => getConfigForClient(fieldConfigs, formValues.client || defaultClientCode),
        [fieldConfigs, formValues.client, defaultClientCode]
    );
    const visibleFields = useMemo(
        () => getVisibleProjectFields(fieldConfigs, formValues.client || defaultClientCode),
        [fieldConfigs, formValues.client, defaultClientCode]
    );
    const workflowOptions = Object.entries(activeConfig.workflowTemplates || {});
    const tasksByProject = useMemo(() => {
        return scheduleTasks.reduce((acc, task) => {
            if (!acc[task.project_id]) acc[task.project_id] = [];
            acc[task.project_id].push(task);
            return acc;
        }, {});
    }, [scheduleTasks]);

    const fetchFieldConfigs = async () => {
        try {
            const { data, error } = await supabase
                .from('project_field_configs')
                .select('*')
                .eq('is_active', true)
                .order('client_code', { ascending: true });
            if (error) throw error;
            setFieldConfigs(data?.length ? data : fallbackConfigRows());
        } catch (error) {
            console.warn('Project field config fallback:', error.message);
            setFieldConfigs(fallbackConfigRows());
        }
    };

    const fetchProjects = async () => {
        setLoading(true);
        try {
            const [{ data: projectData, error: projectError }, { data: taskData, error: taskError }] = await Promise.all([
                supabase.from('project_records').select('*').order('created_at', { ascending: false }),
                supabase.from('project_schedule_tasks').select('*').order('stage_order', { ascending: true }),
            ]);
            if (projectError) throw projectError;
            if (taskError) throw taskError;
            setProjects(projectData || []);
            setScheduleTasks(taskData || []);
        } catch (error) {
            setMessage(`Project fetch failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!supabase || !session) return;
        fetchFieldConfigs();
        fetchProjects();
    }, [supabase, session]);

    useEffect(() => {
        const row = fieldConfigs.find((item) => normalizeClientCode(item.client_code) === normalizeClientCode(selectedConfigCode));
        setConfigDraft(JSON.stringify(row?.config || {}, null, 2));
    }, [fieldConfigs, selectedConfigCode]);

    const setFieldValue = (key, value) => {
        setFormValues((current) => ({ ...current, [key]: value }));
    };

    const createScheduleTasks = async (projectId, config, selectedWorkflowKey) => {
        const rows = buildScheduleTemplateRows(selectedWorkflowKey, config).map((row) => ({
            project_id: projectId,
            stage_order: row.stageOrder,
            workflow_stage: row.workflowStage,
            task_type: row.taskType,
            division: row.division,
            allocation_status: row.allocationStatus,
            assigned_by: session.user.id,
        }));
        if (!rows.length) return;
        const { error } = await supabase.from('project_schedule_tasks').insert(rows);
        if (error) throw error;
    };

    const saveOneProject = async (values, rawSource = {}) => {
        const fields = getVisibleProjectFields(fieldConfigs, values.client || defaultClientCode);
        const errors = validateProjectValues(values, fields);
        if (errors.length) throw new Error(errors.join('; '));

        const config = getConfigForClient(fieldConfigs, values.client || defaultClientCode);
        const payload = buildProjectRecordPayload(
            values,
            fields,
            clients,
            session.user.id,
            rawSource
        );
        if (payload.status === 'new') payload.status = 'scheduled';

        const { data, error } = await supabase
            .from('project_records')
            .insert([payload])
            .select()
            .single();
        if (error) throw error;
        await createScheduleTasks(data.id, config, workflowKey);
        return data;
    };

    const handleManualSave = async () => {
        if (!canManage) return;
        setSaving(true);
        setMessage('');
        try {
            await saveOneProject(formValues, { source: 'manual' });
            setFormValues(emptyFormValues(defaultClientCode));
            await fetchProjects();
            setMessage('Project saved and workflow schedule created.');
        } catch (error) {
            setMessage(error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleParsePaste = () => {
        const rows = parsePastedProjectRows(pasteText, fieldConfigs);
        setPreviewRows(rows);
        setMessage(rows.length ? `${rows.length} pasted row(s) ready for review.` : 'Paste must include a header row and at least one data row.');
    };

    const togglePreviewRow = (rowId) => {
        setPreviewRows((rows) => rows.map((row) => (
            row.id === rowId ? { ...row, selected: !row.selected } : row
        )));
    };

    const handleSavePreview = async () => {
        if (!canManage) return;
        const rows = previewRows.filter((row) => row.selected && row.errors.length === 0);
        if (!rows.length) {
            setMessage('Select at least one valid preview row.');
            return;
        }
        setSaving(true);
        setMessage('');
        try {
            for (const row of rows) {
                await saveOneProject(row.values, { source: row.source, rawRow: row.rawRow });
            }
            setPreviewRows([]);
            setPasteText('');
            await fetchProjects();
            setMessage(`${rows.length} project(s) saved and scheduled.`);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePubKitFetch = async () => {
        setSaving(true);
        setMessage('');
        try {
            const rows = await fetchPubKitProjects({ query: pubKitQuery });
            setPreviewRows(rows);
            setMode('paste');
            setMessage(rows.length ? 'PubKit rows loaded for review.' : 'PubKit endpoint is configured as a v1 placeholder. No rows returned yet.');
        } catch (error) {
            setMessage(error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveConfig = async () => {
        if (!canEditConfig) return;
        setSaving(true);
        setMessage('');
        try {
            const parsed = JSON.parse(configDraft);
            const { error } = await supabase
                .from('project_field_configs')
                .upsert({
                    client_code: normalizeClientCode(selectedConfigCode),
                    display_name: selectedConfigCode,
                    config: parsed,
                    is_active: true,
                    updated_by: session.user.id,
                    created_by: session.user.id,
                }, { onConflict: 'client_code' });
            if (error) throw error;
            await fetchFieldConfigs();
            setMessage('Field configuration saved.');
        } catch (error) {
            setMessage(`Config save failed: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const updateTask = async (task, patch) => {
        setSaving(true);
        setMessage('');
        try {
            const nextPatch = { ...patch };
            if (patch.assigned_to) {
                nextPatch.assigned_by = session.user.id;
                nextPatch.allocated_at = new Date().toISOString();
                nextPatch.allocation_status = 'assigned';
            }
            if (patch.completed_date || patch.completed_from_performer) {
                nextPatch.completed_by = session.user.id;
                nextPatch.allocation_status = 'completed';
            }
            const { error } = await supabase
                .from('project_schedule_tasks')
                .update(nextPatch)
                .eq('id', task.id);
            if (error) throw error;
            await fetchProjects();
            setMessage('Schedule task updated.');
        } catch (error) {
            setMessage(error.message);
        } finally {
            setSaving(false);
        }
    };

    const configCodes = Array.from(new Set([
        ...fieldConfigs.map((row) => row.client_code),
        ...clients.map((client) => client.code),
        'DEFAULT',
    ])).sort();

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Database className="text-indigo-600" />
                        Project Database
                    </h2>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-1">
                        Project master data, configurable fields, workflow schedules
                    </p>
                </div>
                <button
                    onClick={() => { fetchFieldConfigs(); fetchProjects(); }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 text-xs font-black uppercase tracking-widest"
                >
                    <RefreshCw size={15} /> Refresh
                </button>
            </div>

            {message ? (
                <div className="flex items-center gap-2 rounded-xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-3 text-sm font-bold text-indigo-800 dark:text-indigo-200">
                    <AlertCircle size={16} />
                    <span>{message}</span>
                </div>
            ) : null}

            <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800">
                {canManage ? (
                    <>
                        <button onClick={() => setMode('paste')} className={`px-4 py-3 text-xs font-black uppercase tracking-widest border-b-2 ${mode === 'paste' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>
                            Paste Preview
                        </button>
                        <button onClick={() => setMode('manual')} className={`px-4 py-3 text-xs font-black uppercase tracking-widest border-b-2 ${mode === 'manual' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>
                            Manual Entry
                        </button>
                        <button onClick={() => setMode('pubkit')} className={`px-4 py-3 text-xs font-black uppercase tracking-widest border-b-2 ${mode === 'pubkit' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>
                            PubKit Import
                        </button>
                    </>
                ) : null}
                <button onClick={() => setMode('assigned')} className={`px-4 py-3 text-xs font-black uppercase tracking-widest border-b-2 ${mode === 'assigned' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>
                    Project Tracker
                </button>
                {canEditConfig ? (
                    <button onClick={() => setMode('config')} className={`px-4 py-3 text-xs font-black uppercase tracking-widest border-b-2 ${mode === 'config' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>
                        Field Config
                    </button>
                ) : null}
            </div>

            {mode === 'manual' && canManage ? (
                <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {visibleFields.map((field) => (
                            <ProjectField
                                key={field.key}
                                field={field}
                                value={formValues[field.key]}
                                clients={clients}
                                onChange={setFieldValue}
                            />
                        ))}
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Workflow</label>
                            <select
                                value={workflowKey}
                                onChange={(event) => setWorkflowKey(event.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {workflowOptions.map(([key, template]) => (
                                    <option key={key} value={key}>{template.label || key}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={handleManualSave}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        Save Project and Create Workflow
                    </button>
                </div>
            ) : null}

            {mode === 'paste' && canManage ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4 items-end">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Paste Google Sheet rows</label>
                            <textarea
                                value={pasteText}
                                onChange={(event) => setPasteText(event.target.value)}
                                rows={6}
                                placeholder="Title\tClient\tSUB_DIV\tPages"
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Workflow</label>
                            <select
                                value={workflowKey}
                                onChange={(event) => setWorkflowKey(event.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
                            >
                                {workflowOptions.map(([key, template]) => (
                                    <option key={key} value={key}>{template.label || key}</option>
                                ))}
                            </select>
                            <button onClick={handleParsePaste} className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest">
                                <ClipboardPaste size={16} /> Preview
                            </button>
                        </div>
                    </div>
                    <PreviewTable rows={previewRows} onToggle={togglePreviewRow} />
                    {previewRows.length ? (
                        <button
                            onClick={handleSavePreview}
                            disabled={saving}
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-green-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Save Selected Projects
                        </button>
                    ) : null}
                </div>
            ) : null}

            {mode === 'pubkit' && canManage ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                        <input
                            value={pubKitQuery}
                            onChange={(event) => setPubKitQuery(event.target.value)}
                            placeholder="PubKit query, title id, or endpoint parameter"
                            className="px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                            onClick={handlePubKitFetch}
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
            ) : null}

            {mode === 'config' && canEditConfig ? (
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-3">
                        <select
                            value={selectedConfigCode}
                            onChange={(event) => setSelectedConfigCode(event.target.value)}
                            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold"
                        >
                            {configCodes.map((code) => <option key={code} value={code}>{code}</option>)}
                        </select>
                        <button
                            onClick={handleSaveConfig}
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
                        >
                            <Code2 size={16} /> Save JSON Config
                        </button>
                    </div>
                    <textarea
                        value={configDraft}
                        onChange={(event) => setConfigDraft(event.target.value)}
                        rows={18}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-950 text-gray-100 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            ) : null}

            {mode === 'assigned' ? (
                <ProjectTracker
                    loading={loading}
                    projects={projects}
                    tasksByProject={tasksByProject}
                    profiles={allProfiles}
                    canManage={canManage}
                    session={session}
                    onTaskUpdate={updateTask}
                />
            ) : null}
        </div>
    );
}

function PreviewTable({ rows, onToggle }) {
    if (!rows.length) return null;
    const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row.values || {}))));
    return (
        <div className="overflow-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Save</th>
                        <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                        {keys.map((key) => (
                            <th key={key} className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">{key}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {rows.map((row) => (
                        <tr key={row.id}>
                            <td className="p-3">
                                <input type="checkbox" checked={row.selected} onChange={() => onToggle(row.id)} />
                            </td>
                            <td className="p-3">
                                {row.errors.length ? (
                                    <span className="text-xs font-bold text-red-600">{row.errors.join('; ')}</span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600"><Check size={13} /> Valid</span>
                                )}
                            </td>
                            {keys.map((key) => (
                                <td key={key} className="p-3 font-semibold text-gray-700 dark:text-gray-200">{row.values[key] || '-'}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function ProjectTracker({ loading, projects, tasksByProject, profiles, canManage, session, onTaskUpdate }) {
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

    return (
        <div className="space-y-4">
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
                                        <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Completed</th>
                                        <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {tasks.map((task) => {
                                        const isAssignee = task.assigned_to === session?.user?.id;
                                        const canUpdate = canManage || isAssignee;
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
                                                            {profiles.map((profile) => (
                                                                <option key={profile.id} value={profile.id}>{profile.performer_name}</option>
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
                                                        disabled={!canManage}
                                                        onChange={(event) => onTaskUpdate(task, { due_from_performer: event.target.value || null })}
                                                        className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-bold disabled:opacity-60"
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <input
                                                        type="date"
                                                        value={task.completed_date || ''}
                                                        disabled={!canUpdate}
                                                        onChange={(event) => onTaskUpdate(task, { completed_date: event.target.value || null, completed_from_performer: event.target.value || null })}
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

