import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Info } from 'lucide-react';

const DivisionTargetsManager = ({
    userProfile,
    clients = [],
    divisionTargets = [],
    onRefreshTargets,
    supabase,
    isManager
}) => {
    const [targetClient, setTargetClient] = useState(userProfile?.client_id || 'DEFAULT_CLIENT');
    const [targetSubDivision, setTargetSubDivision] = useState('PreEdit');
    const [targetTaskType, setTargetTaskType] = useState('Preedit');
    const [targetValue, setTargetValue] = useState('');
    const [targetSaving, setTargetSaving] = useState(false);

    // Auto-update task type on division change
    useEffect(() => {
        if (targetSubDivision === 'PreEdit') {
            setTargetTaskType('Preedit');
        } else {
            setTargetTaskType('FP Validation');
        }
    }, [targetSubDivision]);

    const handleSaveTarget = async (e) => {
        e.preventDefault();
        if (!targetValue || Number(targetValue) <= 0) {
            alert('Please enter a valid target value');
            return;
        }

        setTargetSaving(true);
        const targetObj = {
            client_id: targetClient,
            sub_division: targetSubDivision,
            task_type: targetTaskType,
            target_value: parseInt(targetValue, 10),
            updated_at: new Date().toISOString()
        };

        try {
            if (supabase) {
                const { error } = await supabase
                    .from('division_targets')
                    .upsert(targetObj, { onConflict: 'client_id,sub_division,task_type' });
                if (error) throw error;
            } else {
                throw new Error('Supabase client not initialized');
            }
            alert('✅ Division Target Saved successfully!');
            setTargetValue('');
            if (onRefreshTargets) await onRefreshTargets();
        } catch (err) {
            console.warn('DB Save failed, attempting local storage fallback:', err.message);
            const local = localStorage.getItem('cbpet_division_targets');
            let list = [];
            if (local) {
                try {
                    list = JSON.parse(local);
                } catch (e) {}
            }
            list = list.filter(t => !(t.client_id === targetClient && t.sub_division === targetSubDivision && t.task_type === targetTaskType));
            list.push({
                ...targetObj,
                id: Date.now().toString()
            });
            localStorage.setItem('cbpet_division_targets', JSON.stringify(list));
            alert('✅ Target override saved to offline local storage');
            setTargetValue('');
            if (onRefreshTargets) await onRefreshTargets();
        } finally {
            setTargetSaving(false);
        }
    };

    const handleDeleteTarget = async (id, targetItem) => {
        if (!window.confirm('Are you sure you want to remove this division target override?')) return;
        try {
            if (supabase && id && isNaN(Number(id))) {
                const { error } = await supabase
                    .from('division_targets')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
            } else {
                const local = localStorage.getItem('cbpet_division_targets');
                if (local) {
                    let list = JSON.parse(local);
                    list = list.filter(t => !(t.client_id === targetItem.client_id && t.sub_division === targetItem.sub_division && t.task_type === targetItem.task_type));
                    localStorage.setItem('cbpet_division_targets', JSON.stringify(list));
                }
            }
            alert('🗑️ Target override removed');
            if (onRefreshTargets) await onRefreshTargets();
        } catch (err) {
            alert('❌ Failed to delete target: ' + err.message);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Target Overrides Form */}
                <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm h-fit">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-6 flex items-center gap-2">
                        <Plus size={16} className="text-blue-600" />
                        Assign Custom Target
                    </h3>

                    <form onSubmit={handleSaveTarget} className="space-y-5">
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Client Code</label>
                            <select
                                value={targetClient}
                                disabled={!isManager} // Team Leads restricted to their assigned client
                                onChange={e => setTargetClient(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-xl text-xs font-bold font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                            >
                                {!isManager && userProfile?.client_id ? (
                                    <option value={userProfile.client_id}>{userProfile.client_id}</option>
                                ) : (
                                    clients.map(c => <option key={c.id} value={c.code}>{c.code}</option>)
                                )}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Division</label>
                            <select
                                value={targetSubDivision}
                                onChange={e => setTargetSubDivision(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-xl text-xs font-bold font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                            >
                                <option value="PreEdit">PreEdit</option>
                                <option value="Validation">Validation</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Task / Process Type</label>
                            <select
                                value={targetTaskType}
                                onChange={e => setTargetTaskType(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-xl text-xs font-bold font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                            >
                                {targetSubDivision === 'PreEdit' ? (
                                    <>
                                        <option value="Preedit">Preedit (Standard: 300)</option>
                                        <option value="Prestyle">Prestyle (Standard: 900)</option>
                                        <option value="Style Editing">Style Editing (Standard: 80)</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="FP Validation">FP Validation (Standard: 600)</option>
                                        <option value="Revises Validation">Revises Validation (Standard: 1200)</option>
                                    </>
                                )}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Target Value (Pages/8h)</label>
                            <input
                                type="number"
                                placeholder="Enter target pages"
                                value={targetValue}
                                onChange={e => setTargetValue(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-xl text-xs font-bold font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={targetSaving}
                            className="w-full py-3 bg-blue-600 text-white font-black rounded-xl text-xs uppercase tracking-widest hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                            {targetSaving ? 'Saving Target...' : 'Save Target Override'}
                        </button>
                    </form>
                </div>

                {/* Target Overrides List */}
                <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm lg:col-span-2 flex flex-col">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-6 flex justify-between items-center">
                        <span>Active Target Overrides</span>
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full uppercase">Division Scope</span>
                    </h3>

                    <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800/80 flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 dark:bg-gray-850/50 border-b border-gray-100 dark:border-gray-800">
                                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Client</th>
                                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Division</th>
                                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Process Type</th>
                                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-center">Custom Target</th>
                                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {(divisionTargets || []).length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-xs italic text-gray-400">
                                            No division targets defined. System is running standard targets.
                                        </td>
                                    </tr>
                                ) : (
                                    (divisionTargets || []).map((row) => (
                                        <tr key={row.id || `${row.client_id}-${row.sub_division}-${row.task_type}`} className="hover:bg-gray-50/50 dark:hover:bg-gray-850/50 transition-colors">
                                            <td className="p-4 font-bold text-sm text-gray-900 dark:text-white uppercase">{row.client_id}</td>
                                            <td className="p-4 text-xs font-semibold text-gray-500">{row.sub_division}</td>
                                            <td className="p-4 text-xs font-bold text-gray-900 dark:text-white">{row.task_type}</td>
                                            <td className="p-4 text-sm font-black text-center text-blue-600 dark:text-blue-400 font-mono">{row.target_value} pages / 8h</td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => handleDeleteTarget(row.id, row)}
                                                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 rounded-lg transition-colors"
                                                    title="Delete override"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 p-4 rounded-2xl bg-blue-50/40 dark:bg-blue-950/15 border border-blue-100/50 dark:border-blue-900/35 text-[10px] font-medium leading-relaxed flex gap-2.5">
                        <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                        <div className="text-gray-500 dark:text-gray-400">
                            Custom division targets override system standard targets globally for that Client & Division. Any performers assigned to the matching Client & Division will be measured against this custom rate.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DivisionTargetsManager;
