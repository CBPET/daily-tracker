import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Toast from './Toast';
import { 
    Plus, 
    Edit2, 
    Trash2, 
    ChevronDown, 
    ChevronUp, 
    Building2, 
    Users, 
    UserPlus, 
    X,
    UserMinus,
    CheckCircle,
    XCircle
} from 'lucide-react';

export default function ClientManagement({ session, profile, allProfiles, onRefresh }) {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expandedClient, setExpandedClient] = useState(null);
    const [toast, setToast] = useState(null);
    
    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
    const [selectedClient, setSelectedClient] = useState(null);
    const [clientCode, setClientCode] = useState('');
    const [clientName, setClientName] = useState('');
    
    // Performer Assignment State
    const [selectedPerformerId, setSelectedPerformerId] = useState('');
    const [selectedSubDivision, setSelectedSubDivision] = useState('PreEdit');

    const showToastMsg = (message, type = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const isAuthorized = ['super_admin', 'general_manager', 'manager'].includes(profile?.role);

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .order('code', { ascending: true });
            
            if (error) throw error;
            setClients(data || []);
        } catch (error) {
            console.error('Error fetching clients:', error.message);
            showToastMsg('❌ Error fetching clients: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAddModal = () => {
        setModalMode('add');
        setSelectedClient(null);
        setClientCode('');
        setClientName('');
        setShowModal(true);
    };

    const handleOpenEditModal = (client, e) => {
        e.stopPropagation();
        setModalMode('edit');
        setSelectedClient(client);
        setClientCode(client.code);
        setClientName(client.name);
        setShowModal(true);
    };

    const handleSubmitClient = async (e) => {
        e.preventDefault();
        if (!isAuthorized) {
            showToastMsg('❌ Access Denied: Insufficient permissions', 'error');
            return;
        }

        if (!clientCode || !clientName) {
            showToastMsg('❌ Code and Name are required', 'error');
            return;
        }

        try {
            setLoading(true);
            if (modalMode === 'add') {
                const { error } = await supabase
                    .from('clients')
                    .insert([{ 
                        code: clientCode.trim().toUpperCase(), 
                        name: clientName.trim(),
                        is_active: true
                    }]);
                
                if (error) throw error;
                showToastMsg('✅ Client created successfully', 'success');
            } else {
                const { error } = await supabase
                    .from('clients')
                    .update({ 
                        code: clientCode.trim().toUpperCase(), 
                        name: clientName.trim() 
                    })
                    .eq('id', selectedClient.id);
                
                if (error) throw error;
                showToastMsg('✅ Client updated successfully', 'success');
            }
            setShowModal(false);
            fetchClients();
            if (onRefresh) onRefresh();
        } catch (error) {
            showToastMsg('❌ Error saving client: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleActive = async (client, e) => {
        e.stopPropagation();
        if (!isAuthorized) {
            showToastMsg('❌ Access Denied: Insufficient permissions', 'error');
            return;
        }

        const newStatus = !client.is_active;
        if (!newStatus && !window.confirm(`Are you sure you want to deactivate client "${client.code}"?`)) {
            return;
        }

        try {
            setLoading(true);
            const { error } = await supabase
                .from('clients')
                .update({ is_active: newStatus })
                .eq('id', client.id);

            if (error) throw error;
            showToastMsg(`✅ Client ${newStatus ? 'activated' : 'deactivated'} successfully`, 'success');
            fetchClients();
        } catch (error) {
            showToastMsg('❌ Error updating client status: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAssignPerformer = async (clientId) => {
        if (!isAuthorized) {
            showToastMsg('❌ Access Denied', 'error');
            return;
        }
        if (!selectedPerformerId) {
            showToastMsg('⚠️ Please select a performer', 'info');
            return;
        }

        const targetClient = clients.find(c => c.id === clientId);
        if (!targetClient) return;

        try {
            setLoading(true);
            const { error } = await supabase
                .from('profiles')
                .update({ 
                    client_ref: clientId,
                    client_id: targetClient.code, // Keep text client_id in sync for backward compat
                    sub_division: selectedSubDivision 
                })
                .eq('id', selectedPerformerId);

            if (error) throw error;
            showToastMsg('✅ Performer assigned successfully', 'success');
            setSelectedPerformerId('');
            if (onRefresh) onRefresh();
        } catch (error) {
            showToastMsg('❌ Error assigning performer: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRemovePerformer = async (performerId, performerName) => {
        if (!isAuthorized) {
            showToastMsg('❌ Access Denied', 'error');
            return;
        }
        if (!window.confirm(`Remove performer "${performerName}" from this client assignment?`)) {
            return;
        }

        try {
            setLoading(true);
            const { error } = await supabase
                .from('profiles')
                .update({ 
                    client_ref: null, 
                    client_id: 'DEFAULT_CLIENT', // Reset to fallback text client_id
                    sub_division: null 
                })
                .eq('id', performerId);

            if (error) throw error;
            showToastMsg('✅ Performer removed from client', 'success');
            if (onRefresh) onRefresh();
        } catch (error) {
            showToastMsg('❌ Error removing performer: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const toggleExpandClient = (clientId) => {
        setExpandedClient(expandedClient === clientId ? null : clientId);
    };

    // Filter performers based on client and sub_division
    const getPerformersForClient = (clientId, subDiv) => {
        return allProfiles.filter(p => p.client_ref === clientId && p.sub_division === subDiv);
    };

    // Unassigned performers are those with performer or team_lead/group_lead roles who don't have a client_ref
    // Note: Performers must be assignable.
    const unassignedPerformers = allProfiles.filter(p => 
        ['performer', 'team_lead', 'group_lead'].includes(p.role) && !p.client_ref
    );

    if (!isAuthorized) {
        return (
            <div className="p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-3xl text-center">
                <p className="text-red-700 dark:text-red-400 font-bold">⚠️ Access Denied: You do not have permissions to manage clients.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                        <Building2 className="text-purple-600 dark:text-purple-400" />
                        Client & Performer Provisioning
                    </h3>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-1">
                        Map Performers to Clients [OUP, T&F, OOH, MCB, SPW] and Sub-divisions
                    </p>
                </div>
                <button
                    onClick={handleOpenAddModal}
                    className="flex items-center gap-2 px-5 py-3 bg-purple-600 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-purple-500/20 hover:bg-purple-700 transition-all active:scale-95 shrink-0"
                >
                    <Plus size={16} /> Add Client
                </button>
            </div>

            {/* Clients Grid */}
            <div className="grid grid-cols-1 gap-4">
                {loading && clients.length === 0 ? (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                    </div>
                ) : clients.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50/50 dark:bg-gray-800/30 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                        <p className="text-xs font-black uppercase text-gray-400 tracking-wider">No clients registered in system</p>
                    </div>
                ) : (
                    clients.map((client) => {
                        const isExpanded = expandedClient === client.id;
                        const preEditPerformers = getPerformersForClient(client.id, 'PreEdit');
                        const validationPerformers = getPerformersForClient(client.id, 'Validation');
                        const totalAssigned = preEditPerformers.length + validationPerformers.length;

                        return (
                            <div 
                                key={client.id}
                                className={`bg-white dark:bg-gray-900 border transition-all duration-200 rounded-3xl shadow-sm ${
                                    isExpanded 
                                        ? 'border-purple-200 dark:border-purple-900 ring-1 ring-purple-100 dark:ring-purple-900/30' 
                                        : 'border-gray-100 dark:border-gray-800 hover:border-purple-100 dark:hover:border-purple-900/50'
                                }`}
                            >
                                {/* Client Header Card */}
                                <div 
                                    onClick={() => toggleExpandClient(client.id)}
                                    className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer select-none"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
                                            client.is_active 
                                                ? 'bg-purple-55 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' 
                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                                        }`}>
                                            {client.code}
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                                                {client.name}
                                                {!client.is_active && (
                                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-full border border-gray-200 dark:border-gray-700">Inactive</span>
                                                )}
                                            </h4>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5 flex items-center gap-2">
                                                <span>{totalAssigned} Performer{totalAssigned !== 1 ? 's' : ''} Assigned</span>
                                                <span>•</span>
                                                <span>PreEdit: {preEditPerformers.length}</span>
                                                <span>•</span>
                                                <span>Validation: {validationPerformers.length}</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 self-end sm:self-auto">
                                        <button
                                            onClick={(e) => handleOpenEditModal(client, e)}
                                            className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-850 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all"
                                            title="Edit Client"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => handleToggleActive(client, e)}
                                            className={`p-2.5 rounded-xl transition-all ${
                                                client.is_active 
                                                    ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20' 
                                                    : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                            }`}
                                            title={client.is_active ? "Deactivate Client" : "Activate Client"}
                                        >
                                            {client.is_active ? <CheckCircle size={18} /> : <XCircle size={18} />}
                                        </button>
                                        <div className="p-2.5 text-gray-400">
                                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Panel */}
                                {isExpanded && (
                                    <div className="px-6 pb-8 pt-2 border-t border-gray-100 dark:border-gray-800 space-y-6">
                                        
                                        {/* Performer Assignment Form */}
                                        {client.is_active && (
                                            <div className="bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800/60 flex flex-col md:flex-row items-end gap-4">
                                                <div className="flex-1 w-full">
                                                    <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Assign Performer</label>
                                                    <select
                                                        value={selectedPerformerId}
                                                        onChange={(e) => setSelectedPerformerId(e.target.value)}
                                                        className="w-full p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none font-bold text-xs"
                                                    >
                                                        <option value="">Select unassigned performer…</option>
                                                        {unassignedPerformers.map(p => (
                                                            <option key={p.id} value={p.id}>{p.performer_name} ({p.role.replace('_', ' ')})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="w-full md:w-48">
                                                    <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Sub-division</label>
                                                    <select
                                                        value={selectedSubDivision}
                                                        onChange={(e) => setSelectedSubDivision(e.target.value)}
                                                        className="w-full p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none font-bold text-xs"
                                                    >
                                                        <option value="PreEdit">PreEdit</option>
                                                        <option value="Validation">Validation</option>
                                                    </select>
                                                </div>
                                                <button
                                                    onClick={() => handleAssignPerformer(client.id)}
                                                    className="w-full md:w-auto px-5 py-3 bg-purple-600 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-md shadow-purple-500/10 hover:bg-purple-700 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <UserPlus size={14} /> Assign
                                                </button>
                                            </div>
                                        )}

                                        {/* Performance Grouping lists */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* PreEdit Sub-Division */}
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center px-1 border-b border-gray-100 dark:border-gray-800 pb-2">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                                                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                                                        PreEdit Sub-division
                                                    </span>
                                                    <span className="text-xs font-bold text-gray-500">{preEditPerformers.length}</span>
                                                </div>

                                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                                                    {preEditPerformers.length === 0 ? (
                                                        <p className="text-xs italic text-gray-400 p-2 text-center">No performers assigned</p>
                                                    ) : (
                                                        preEditPerformers.map(p => (
                                                            <div key={p.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-850 rounded-xl border border-gray-100/50 dark:border-gray-800/50 text-sm">
                                                                <span className="font-bold text-gray-900 dark:text-white">{p.performer_name}</span>
                                                                <button
                                                                    onClick={() => handleRemovePerformer(p.id, p.performer_name)}
                                                                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 rounded-lg transition-colors"
                                                                    title="Remove Performer"
                                                                >
                                                                    <UserMinus size={14} />
                                                                </button>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>

                                            {/* Validation Sub-Division */}
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center px-1 border-b border-gray-100 dark:border-gray-800 pb-2">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                                                        <span className="w-2 h-2 rounded-full bg-green-500" />
                                                        Validation Sub-division
                                                    </span>
                                                    <span className="text-xs font-bold text-gray-500">{validationPerformers.length}</span>
                                                </div>

                                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                                                    {validationPerformers.length === 0 ? (
                                                        <p className="text-xs italic text-gray-400 p-2 text-center">No performers assigned</p>
                                                    ) : (
                                                        validationPerformers.map(p => (
                                                            <div key={p.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-850 rounded-xl border border-gray-100/50 dark:border-gray-800/50 text-sm">
                                                                <span className="font-bold text-gray-900 dark:text-white">{p.performer_name}</span>
                                                                <button
                                                                    onClick={() => handleRemovePerformer(p.id, p.performer_name)}
                                                                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 rounded-lg transition-colors"
                                                                    title="Remove Performer"
                                                                >
                                                                    <UserMinus size={14} />
                                                                </button>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Add / Edit Client Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-800 relative overflow-hidden">
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-850 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-all"
                            aria-label="Close modal"
                        >
                            <X size={18} />
                        </button>

                        <h3 className="text-xl font-black mb-2 tracking-tight">
                            {modalMode === 'add' ? 'Add Client' : 'Edit Client'}
                        </h3>
                        <p className="text-gray-400 dark:text-gray-500 text-xs font-semibold uppercase tracking-widest mb-6">
                            {modalMode === 'add' ? 'Register new client profile' : 'Modify client description'}
                        </p>

                        <form onSubmit={handleSubmitClient} className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Client Short Code</label>
                                <input
                                    type="text"
                                    value={clientCode}
                                    onChange={(e) => setClientCode(e.target.value)}
                                    placeholder="e.g. OUP"
                                    maxLength={10}
                                    disabled={modalMode === 'edit'}
                                    className="w-full p-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none focus:border-purple-500 font-bold text-sm uppercase disabled:opacity-55"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Client Name</label>
                                <input
                                    type="text"
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    placeholder="e.g. Oxford University Press"
                                    className="w-full p-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none focus:border-purple-500 font-bold text-sm"
                                    required
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 py-3.5 bg-purple-600 text-white font-black rounded-xl uppercase tracking-widest text-xs shadow-lg shadow-purple-500/20 hover:bg-purple-700 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : (modalMode === 'add' ? 'Add Client' : 'Save Changes')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3.5 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-black rounded-xl uppercase tracking-widest text-xs hover:bg-gray-300 dark:hover:bg-gray-700 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
