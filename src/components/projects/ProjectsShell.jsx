import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    Database,
    LayoutDashboard,
    RefreshCw,
} from 'lucide-react';
import {
    buildProjectRecordPayload,
    buildScheduleTemplateRows,
    fallbackConfigRows,
    fetchPubKitProjects,
    getConfigForClient,
    getVisibleProjectFields,
    normalizeClientCode,
    parsePastedProjectRows,
    validateProjectValues,
} from '../../lib/projects/projectFieldConfig';
import {
    canEditProjectFieldConfig,
    canManageProjectDatabase,
    filterProjectsForTasks,
    filterTasksForRole,
} from '../../lib/projects/projectScheduleScope';
import {
    isDateFieldPatch,
    logScheduleEvent,
    pickDateValues,
} from '../../lib/projects/projectScheduleEvents';
import ProjectManualForm from './ProjectManualForm';
import ProjectPasteIntake from './ProjectPasteIntake';
import ProjectPubKitImport from './ProjectPubKitImport';
import ProjectFieldConfigEditor from './ProjectFieldConfigEditor';
import ProjectTracker from './ProjectTracker';
import ProjectScheduleDashboard from './ProjectScheduleDashboard';

const emptyFormValues = (clientCode = '') => ({
    title: '',
    client: clientCode,
    status: 'new',
});

export default function ProjectsShell({
    supabase,
    session,
    profile,
    allProfiles = [],
    clients = [],
}) {
    const canManage = canManageProjectDatabase(profile);
    const canEditConfig = canEditProjectFieldConfig(profile);
    const defaultClientCode = clients[0]?.code || profile?.client_id || 'OUP';
    const [mode, setMode] = useState(canManage ? 'manual' : 'dashboard');
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

    const scopedTasks = useMemo(
        () => filterTasksForRole(scheduleTasks, profile, session),
        [scheduleTasks, profile, session]
    );
    const scopedProjects = useMemo(
        () => (canManage ? projects : filterProjectsForTasks(projects, scopedTasks)),
        [canManage, projects, scopedTasks]
    );
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

    const updateTask = async (task, patch, meta = {}) => {
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

            const dateChange = meta.isDateChange || isDateFieldPatch(patch);
            const oldValues = dateChange ? pickDateValues(task) : null;

            const { error } = await supabase
                .from('project_schedule_tasks')
                .update(nextPatch)
                .eq('id', task.id);
            if (error) throw error;

            if (dateChange) {
                await logScheduleEvent({
                    supabase,
                    projectId: task.project_id,
                    scheduleTaskId: task.id,
                    eventType: 'schedule_date_change',
                    oldValues,
                    newValues: pickDateValues({ ...task, ...nextPatch }),
                    note: meta.note || null,
                    reasonCode: meta.reasonCode || null,
                    userId: session.user.id,
                });
            }

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

    const tabClass = (key) => `px-4 py-3 text-xs font-black uppercase tracking-widest border-b-2 ${
        mode === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'
    }`;

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
                        <button type="button" onClick={() => setMode('paste')} className={tabClass('paste')}>
                            Paste Preview
                        </button>
                        <button type="button" onClick={() => setMode('manual')} className={tabClass('manual')}>
                            Manual Entry
                        </button>
                        <button type="button" onClick={() => setMode('pubkit')} className={tabClass('pubkit')}>
                            PubKit Import
                        </button>
                    </>
                ) : null}
                <button type="button" onClick={() => setMode('dashboard')} className={tabClass('dashboard')}>
                    <span className="inline-flex items-center gap-1"><LayoutDashboard size={14} /> Dashboard</span>
                </button>
                <button type="button" onClick={() => setMode('assigned')} className={tabClass('assigned')}>
                    Project Tracker
                </button>
                {canEditConfig ? (
                    <button type="button" onClick={() => setMode('config')} className={tabClass('config')}>
                        Field Config
                    </button>
                ) : null}
            </div>

            {mode === 'manual' && canManage ? (
                <ProjectManualForm
                    visibleFields={visibleFields}
                    formValues={formValues}
                    clients={clients}
                    workflowKey={workflowKey}
                    workflowOptions={workflowOptions}
                    saving={saving}
                    onFieldChange={setFieldValue}
                    onWorkflowChange={setWorkflowKey}
                    onSave={handleManualSave}
                />
            ) : null}

            {mode === 'paste' && canManage ? (
                <ProjectPasteIntake
                    pasteText={pasteText}
                    workflowKey={workflowKey}
                    workflowOptions={workflowOptions}
                    previewRows={previewRows}
                    saving={saving}
                    onPasteChange={setPasteText}
                    onWorkflowChange={setWorkflowKey}
                    onParse={handleParsePaste}
                    onToggleRow={togglePreviewRow}
                    onSaveSelected={handleSavePreview}
                />
            ) : null}

            {mode === 'pubkit' && canManage ? (
                <ProjectPubKitImport
                    pubKitQuery={pubKitQuery}
                    saving={saving}
                    onQueryChange={setPubKitQuery}
                    onFetch={handlePubKitFetch}
                />
            ) : null}

            {mode === 'config' && canEditConfig ? (
                <ProjectFieldConfigEditor
                    selectedConfigCode={selectedConfigCode}
                    configCodes={configCodes}
                    configDraft={configDraft}
                    saving={saving}
                    onCodeChange={setSelectedConfigCode}
                    onDraftChange={setConfigDraft}
                    onSave={handleSaveConfig}
                />
            ) : null}

            {mode === 'dashboard' ? (
                <ProjectScheduleDashboard
                    supabase={supabase}
                    profile={profile}
                    projects={scopedProjects}
                    scheduleTasks={scopedTasks}
                    loading={loading}
                />
            ) : null}

            {mode === 'assigned' ? (
                <ProjectTracker
                    loading={loading}
                    projects={canManage ? projects : scopedProjects}
                    tasksByProject={tasksByProject}
                    profiles={allProfiles}
                    canManage={canManage}
                    profile={profile}
                    session={session}
                    saving={saving}
                    onTaskUpdate={updateTask}
                />
            ) : null}
        </div>
    );
}
