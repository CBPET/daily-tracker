import React, { useState, useMemo } from 'react';
import {
    Plus,
    Trash2,
    ChevronDown,
    ChevronUp,
    Loader2,
    AlertCircle,
    Check,
    X,
    Edit2,
    Users,
    Briefcase
} from 'lucide-react';

const WorkflowManager = ({ supabase, session, allProfiles = [], onRefresh }) => {
    const [workflows, setWorkflows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expandedWorkflow, setExpandedWorkflow] = useState(null);
    const [showNewWorkflowForm, setShowNewWorkflowForm] = useState(false);
    const [newWorkflowName, setNewWorkflowName] = useState('');
    const [newWorkflowDesc, setNewWorkflowDesc] = useState('');
    const [workflowAssignments, setWorkflowAssignments] = useState({});
    const [assigningUser, setAssigningUser] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Fetch all workflows
    const fetchWorkflows = async () => {
        if (!supabase || !session) return;
        setLoading(true);
        try {
            const { data: wfData, error: wfError } = await supabase
                .from('workflows')
                .select('*')
                .order('created_at', { ascending: false });

            if (wfError) throw wfError;
            setWorkflows(wfData || []);

            // Fetch assignments for each workflow
            if (wfData && wfData.length > 0) {
                const assignments = {};
                for (const wf of wfData) {
                    const { data: assignData, error: assignError } = await supabase
                        .from('workflow_assignments')
                        .select('user_id')
                        .eq('workflow_id', wf.id);

                    if (!assignError) {
                        assignments[wf.id] = (assignData || []).map(a => a.user_id);
                    }
                }
                setWorkflowAssignments(assignments);
            }
        } catch (err) {
            setError('Failed to fetch workflows: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Create new workflow
    const handleCreateWorkflow = async () => {
        if (!newWorkflowName.trim()) {
            setError('Workflow name is required');
            return;
        }

        try {
            const { data, error: err } = await supabase
                .from('workflows')
                .insert([{
                    name: newWorkflowName,
                    description: newWorkflowDesc,
                    created_by: session.user.id,
                    is_active: true
                }])
                .select();

            if (err) throw err;

            setSuccess('✅ Workflow created: ' + newWorkflowName);
            setNewWorkflowName('');
            setNewWorkflowDesc('');
            setShowNewWorkflowForm(false);
            await fetchWorkflows();

            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError('Failed to create workflow: ' + err.message);
        }
    };

    // Assign user to workflow
    const handleAssignUser = async (workflowId, userId) => {
        if (!userId) {
            setError('Please select a user');
            return;
        }

        setAssigningUser({ workflowId, userId, isLoading: true });
        try {
            const { error: err } = await supabase
                .from('workflow_assignments')
                .insert([{
                    user_id: userId,
                    workflow_id: workflowId,
                    assigned_by: session.user.id
                }]);

            if (err && !err.message.includes('duplicate')) throw err;

            setSuccess('✅ User assigned to workflow');
            await fetchWorkflows();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError('Failed to assign user: ' + err.message);
        } finally {
            setAssigningUser(null);
        }
    };

    // Remove user from workflow
    const handleRemoveUserFromWorkflow = async (workflowId, userId) => {
        if (!window.confirm('Remove this user from the workflow?')) return;

        try {
            const { error: err } = await supabase
                .from('workflow_assignments')
                .delete()
                .eq('workflow_id', workflowId)
                .eq('user_id', userId);

            if (err) throw err;

            setSuccess('🗑️ User removed from workflow');
            await fetchWorkflows();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError('Failed to remove user: ' + err.message);
        }
    };

    // Delete workflow
    const handleDeleteWorkflow = async (workflowId) => {
        if (!window.confirm('Delete this workflow? This will remove all assignments.')) return;

        try {
            const { error: err } = await supabase
                .from('workflows')
                .delete()
                .eq('id', workflowId);

            if (err) throw err;

            setSuccess('🗑️ Workflow deleted');
            await fetchWorkflows();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError('Failed to delete workflow: ' + err.message);
        }
    };

    // Initialize on mount
    React.useEffect(() => {
        fetchWorkflows();
    }, [supabase, session]);

    const assignedUsersForWorkflow = (workflowId) => {
        const userIds = workflowAssignments[workflowId] || [];
        return allProfiles.filter(p => userIds.includes(p.id));
    };

    const unassignedUsersForWorkflow = (workflowId) => {
        const userIds = workflowAssignments[workflowId] || [];
        return allProfiles.filter(p => !userIds.includes(p.id));
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <Briefcase className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                        Workflow Management
                    </h2>
                </div>
                <button
                    onClick={() => setShowNewWorkflowForm(!showNewWorkflowForm)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                    <Plus className="w-4 h-4" />
                    <span>New Workflow</span>
                </button>
            </div>

            {/* New Workflow Form */}
            {showNewWorkflowForm && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
                    <input
                        type="text"
                        placeholder="Workflow Name (e.g., Q1 2026 Performance)"
                        value={newWorkflowName}
                        onChange={(e) => setNewWorkflowName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                    <textarea
                        placeholder="Description (optional)"
                        value={newWorkflowDesc}
                        onChange={(e) => setNewWorkflowDesc(e.target.value)}
                        rows="2"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                    <div className="flex space-x-2">
                        <button
                            onClick={handleCreateWorkflow}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            Create Workflow
                        </button>
                        <button
                            onClick={() => setShowNewWorkflowForm(false)}
                            className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-400 transition"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Messages */}
            {error && (
                <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg flex items-center space-x-2 text-red-700 dark:text-red-300">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="ml-auto">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {success && (
                <div className="p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg flex items-center space-x-2 text-green-700 dark:text-green-300">
                    <Check className="w-4 h-4" />
                    <span>{success}</span>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
            )}

            {/* Workflows List */}
            {!loading && workflows.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                    <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-600 dark:text-gray-400">No workflows yet</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">Click "New Workflow" to get started</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {workflows.map((workflow) => (
                        <div
                            key={workflow.id}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800"
                        >
                            {/* Workflow Header */}
                            <div
                                className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between"
                                onClick={() =>
                                    setExpandedWorkflow(expandedWorkflow === workflow.id ? null : workflow.id)
                                }
                            >
                                <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900 dark:text-white">
                                        {workflow.name}
                                    </h3>
                                    {workflow.description && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {workflow.description}
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                        {(workflowAssignments[workflow.id] || []).length} users assigned
                                    </p>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteWorkflow(workflow.id);
                                        }}
                                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    {expandedWorkflow === workflow.id ? (
                                        <ChevronUp className="w-5 h-5 text-gray-500" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-gray-500" />
                                    )}
                                </div>
                            </div>

                            {/* Expanded Content - User Assignments */}
                            {expandedWorkflow === workflow.id && (
                                <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50 space-y-4">
                                    {/* Assigned Users */}
                                    <div>
                                        <h4 className="font-semibold text-gray-700 dark:text-gray-300 flex items-center space-x-2 mb-3">
                                            <Users className="w-4 h-4" />
                                            <span>Assigned Users ({(workflowAssignments[workflow.id] || []).length})</span>
                                        </h4>
                                        <div className="space-y-2">
                                            {assignedUsersForWorkflow(workflow.id).length === 0 ? (
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    No users assigned yet
                                                </p>
                                            ) : (
                                                assignedUsersForWorkflow(workflow.id).map((user) => (
                                                    <div
                                                        key={user.id}
                                                        className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
                                                    >
                                                        <div>
                                                            <p className="font-medium text-gray-900 dark:text-white text-sm">
                                                                {user.performer_name}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {user.role} {user.client_id && `• ${user.client_id}`}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() =>
                                                                handleRemoveUserFromWorkflow(workflow.id, user.id)
                                                            }
                                                            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Assign New User */}
                                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                            Add User to Workflow
                                        </h4>
                                        <div className="flex space-x-2">
                                            <select
                                                id={`workflow-select-${workflow.id}`}
                                                defaultValue=""
                                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                            >
                                                <option value="">Select a user...</option>
                                                {unassignedUsersForWorkflow(workflow.id).map((user) => (
                                                    <option key={user.id} value={user.id}>
                                                        {user.performer_name} ({user.role})
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => {
                                                    const select = document.getElementById(`workflow-select-${workflow.id}`);
                                                    handleAssignUser(workflow.id, select.value);
                                                    select.value = '';
                                                }}
                                                disabled={assigningUser?.isLoading}
                                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition flex items-center space-x-1"
                                            >
                                                {assigningUser?.isLoading ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Plus className="w-4 h-4" />
                                                )}
                                                <span>Assign</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default WorkflowManager;
