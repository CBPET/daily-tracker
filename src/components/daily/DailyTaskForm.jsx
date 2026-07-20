import { useState, useEffect, useRef } from 'react';
import Modal from '../Modal';
import { supabase } from '../../lib/supabase';
import {
    loadDailyEntryDrafts,
    saveDailyEntryDrafts,
    clearDailyEntryDrafts,
} from '../../lib/dailyEntryDraftQueue';
import {
    STANDARD_TARGETS,
    STANDARD_WORK_HOURS_PER_DAY,
    TARGET_INFO_ROWS,
    TARGET_UNITS,
    calcEstimatedHours,
    normalizeTaskType,
} from '../../lib/targetUtils';
import { isEntryDuplicateGuardEnabled, isNotificationsEnabled } from '../../lib/featureFlags';
import { notifyDailyTrackerEvent } from '../../lib/notifications/notificationRules';
import {
    Briefcase,
    ShieldCheck,
    Loader2,
    Trash2,
    Info,
    Send,
} from 'lucide-react';

const MIN_HOURS = 1;
const MAX_HOURS = 4;
const MOTIVATIONAL_MESSAGE = 'Keep Trying!';

const getTodayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Daily task entry form + local draft queue.
 * Parent should pass DailySummary (or other) via summarySlot to preserve the form | summary layout.
 */
const DailyTaskForm = ({
    session,
    profile,
    statusEntries = [],
    accessibleProfiles = [],
    divisionTargets = [],
    clients = [],
    isSyncing = false,
    setIsSyncing,
    onRefresh,
    onToast,
    summarySlot = null,
}) => {
    const notificationsEnabled = isNotificationsEnabled();
    const canSelectPerformerOnForm = ['super_admin', 'general_manager', 'manager'].includes(profile?.role);

    const [performerName, setPerformerName] = useState('');
    const [titleName, setTitleName] = useState('');
    const [batchFlow, setBatchFlow] = useState(false);
    const [batchNumber, setBatchNumber] = useState('');
    const [completedPages, setCompletedPages] = useState('');
    const [castOffPages, setCastOffPages] = useState('');
    const [taskType, setTaskType] = useState('');
    const [estimatedTime, setEstimatedTime] = useState('');
    const [takenTime, setTakenTime] = useState('');
    const [entryDate, setEntryDate] = useState(getTodayISO);
    const [draftEntries, setDraftEntries] = useState([]);
    const draftsReadyRef = useRef(false);
    const [selectedClient, setSelectedClient] = useState('');
    const [selectedSubDivision, setSelectedSubDivision] = useState('');
    const [showTargetInfoModal, setShowTargetInfoModal] = useState(false);

    const toast = (message) => {
        if (typeof onToast === 'function') onToast(message);
    };

    useEffect(() => {
        if (profile?.performer_name) setPerformerName(profile.performer_name);
    }, [profile?.performer_name]);

    useEffect(() => {
        if (!session?.user?.id) {
            setDraftEntries([]);
            draftsReadyRef.current = false;
            return;
        }
        setDraftEntries(loadDailyEntryDrafts(session.user.id));
        draftsReadyRef.current = false;
    }, [session?.user?.id]);

    useEffect(() => {
        if (!session?.user?.id) return;
        if (!draftsReadyRef.current) {
            draftsReadyRef.current = true;
            return;
        }
        saveDailyEntryDrafts(session.user.id, draftEntries);
    }, [session?.user?.id, draftEntries]);

    useEffect(() => {
        if (!profile) return;

        if (!canSelectPerformerOnForm || performerName === profile.performer_name) {
            setSelectedClient(profile.client_id || 'DEFAULT_CLIENT');
            setSelectedSubDivision(profile.sub_division || '');
        } else {
            const selectedProf = accessibleProfiles.find((p) => p.performer_name === performerName);
            if (selectedProf) {
                setSelectedClient(selectedProf.client_id || 'DEFAULT_CLIENT');
                setSelectedSubDivision(selectedProf.sub_division || '');
            }
        }
    }, [performerName, profile, accessibleProfiles, canSelectPerformerOnForm]);

    const standardTargets = STANDARD_TARGETS;
    const taskTypeOptions = [...Object.keys(standardTargets).filter((task) => task !== 'FL Validation'), 'Miscellaneous'];

    const getDivisionTargetOverride = (task, client, subDiv) => {
        const canonicalTask = normalizeTaskType(task);
        return divisionTargets.find((t) =>
            t.client_id === client &&
            t.sub_division === subDiv &&
            normalizeTaskType(t.task_type) === canonicalTask
        );
    };

    const getTargetForEntry = (task, client, subDiv) => {
        if (task === 'Miscellaneous') return 0;
        const custom = getDivisionTargetOverride(task, client, subDiv);
        if (custom) return Number(custom.target_value);
        const canonicalTask = normalizeTaskType(task);
        return standardTargets[canonicalTask] || standardTargets[task] || 0;
    };

    const isPositiveHours = (value) => {
        const n = Number(value);
        return Number.isFinite(n) && n > 0;
    };

    const isMiscHoursInRange = (value) => {
        const n = Number(value);
        return Number.isFinite(n) && n >= MIN_HOURS && n <= MAX_HOURS;
    };

    const timeAchievedPercentage = estimatedTime > 0 && takenTime > 0 ? ((estimatedTime / takenTime) * 100).toFixed(2) : 0;

    const activeTargetVal = taskType ? getTargetForEntry(taskType, selectedClient, selectedSubDivision) : 0;
    const isMiscellaneous = taskType === 'Miscellaneous';
    const activeTargetOverride = taskType ? getDivisionTargetOverride(taskType, selectedClient, selectedSubDivision) : null;
    const activeTargetSource = activeTargetOverride ? 'Division Override' : 'Standard Target';
    const activeTargetUnit = TARGET_UNITS[normalizeTaskType(taskType)] || TARGET_UNITS[taskType] || 'items/day';
    const isTitlesTask = activeTargetUnit.startsWith('titles');
    const completedWorkMeta = (() => {
        if (!taskType) {
            return { label: 'Completed Work', placeholder: '150', unitWord: 'item' };
        }
        if (activeTargetUnit.startsWith('titles')) {
            return { label: 'Completed Titles', placeholder: '1', unitWord: 'title' };
        }
        if (activeTargetUnit.startsWith('refs')) {
            return { label: 'Completed References', placeholder: '50', unitWord: 'ref' };
        }
        if (activeTargetUnit.startsWith('pages')) {
            return { label: 'Completed Pages', placeholder: '150', unitWord: 'page' };
        }
        return { label: 'Completed Work', placeholder: '150', unitWord: 'item' };
    })();
    const hoursPerUnit =
        !isMiscellaneous && activeTargetVal > 0
            ? Number((STANDARD_WORK_HOURS_PER_DAY / activeTargetVal).toFixed(2))
            : 0;
    const targetAchievedPercentage = !isMiscellaneous && taskType && activeTargetVal > 0 && takenTime > 0
        ? ((completedPages / ((activeTargetVal / STANDARD_WORK_HOURS_PER_DAY) * takenTime)) * 100).toFixed(2) : 0;

    const prevTaskUnitRef = useRef('');
    useEffect(() => {
        const prevUnit = prevTaskUnitRef.current;
        if (isTitlesTask && !String(prevUnit).startsWith('titles')) {
            setCompletedPages('1');
            setCastOffPages('');
        }
        if (!isTitlesTask && String(prevUnit).startsWith('titles')) {
            setCastOffPages('');
        }
        prevTaskUnitRef.current = taskType ? activeTargetUnit : '';
    }, [taskType, activeTargetUnit, isTitlesTask]);

    useEffect(() => {
        if (isTitlesTask && completedPages !== '1') {
            setCompletedPages('1');
        }
    }, [isTitlesTask, completedPages]);

    useEffect(() => {
        if (!taskType) {
            setEstimatedTime('');
            return;
        }
        if (isMiscellaneous) {
            setEstimatedTime('');
            return;
        }
        if (isTitlesTask) {
            const autoEstimatedHours = calcEstimatedHours(taskType, 1, activeTargetVal);
            setEstimatedTime(autoEstimatedHours > 0 ? autoEstimatedHours.toFixed(2) : '');
            return;
        }
        const autoEstimatedHours = calcEstimatedHours(taskType, completedPages, activeTargetVal);
        setEstimatedTime(autoEstimatedHours > 0 ? autoEstimatedHours.toFixed(2) : '');
    }, [taskType, completedPages, activeTargetVal, isMiscellaneous, isTitlesTask]);

    const syncDraftBatchToSupabase = async (entries) => {
        if (!supabase || !session) throw new Error('Not signed in');
        const payload = entries.map((newEntry) => ({
            id: newEntry.id,
            date: newEntry.date,
            performerName: newEntry.performerName,
            titleName: newEntry.titleName,
            completedPages: newEntry.completedPages,
            taskType: newEntry.taskType,
            estimatedTime: newEntry.estimatedTime,
            takenTime: newEntry.takenTime,
            timeAchieved: newEntry.timeAchieved,
            targetAchieved: newEntry.targetAchieved,
            status: newEntry.status,
            user_id: session.user.id,
            client_id: newEntry.client_id || 'DEFAULT_CLIENT',
            sub_division: newEntry.sub_division || null,
            batch_number: newEntry.batch_number ?? null,
        }));
        const { error } = await supabase.from('status_entries').insert(payload);
        if (error) throw error;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const workUnits = isTitlesTask ? 1 : Number(completedPages);
        if (!performerName || !titleName || !taskType || !estimatedTime || !takenTime || !entryDate) {
            toast('❌ Please fill in all required fields');
            return;
        }
        if (!isTitlesTask && !completedPages) {
            toast('❌ Please fill in all required fields');
            return;
        }
        if (batchFlow && !batchNumber) {
            toast('❌ Batch Number is required when Batch flow is enabled');
            return;
        }
        if (isEntryDuplicateGuardEnabled()) {
            const sameKey = (row) =>
                String(row.date).slice(0, 10) === entryDate &&
                row.titleName === titleName.trim() &&
                row.taskType === taskType &&
                (row.performerName === performerName.trim() || row.user_id === session?.user?.id);
            const dup = statusEntries.find(sameKey) || draftEntries.find(sameKey);
            if (dup) {
                const edit = window.confirm(
                    statusEntries.find(sameKey)
                        ? 'Already Submitted. Edit Existing?'
                        : 'Already staged locally. Add another anyway?'
                );
                if (!edit) return;
            }
        }
        if (isMiscellaneous) {
            if (!isMiscHoursInRange(estimatedTime) || !isMiscHoursInRange(takenTime)) {
                toast(`❌ Miscellaneous Estimated and Taken Hours must be between ${MIN_HOURS} and ${MAX_HOURS}`);
                return;
            }
        } else if (!isPositiveHours(estimatedTime) || !isPositiveHours(takenTime)) {
            toast('❌ Estimated and Taken Hours must be greater than 0');
            return;
        }
        const titlesTargetPct = isTitlesTask && activeTargetVal > 0 && takenTime > 0
            ? ((1 / ((activeTargetVal / STANDARD_WORK_HOURS_PER_DAY) * takenTime)) * 100).toFixed(2)
            : targetAchievedPercentage;
        const achievementStatus = isMiscellaneous
            ? 'N/A'
            : (Number(titlesTargetPct) >= 100 ? 'Achieved' : MOTIVATIONAL_MESSAGE);
        const newEntry = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            date: entryDate,
            performerName: performerName.trim(),
            titleName: titleName.trim(),
            completedPages: workUnits,
            taskType,
            estimatedTime: Number(estimatedTime),
            takenTime: Number(takenTime),
            timeAchieved: timeAchievedPercentage,
            targetAchieved: isMiscellaneous ? 0 : titlesTargetPct,
            status: achievementStatus,
            client_id: selectedClient || 'DEFAULT_CLIENT',
            sub_division: selectedSubDivision || null,
            batch_number: batchFlow && batchNumber ? Number(batchNumber) : null,
            selected: true,
        };
        setDraftEntries((prev) => [newEntry, ...prev]);
        setTitleName(''); setBatchFlow(false); setBatchNumber(''); setCompletedPages(''); setCastOffPages(''); setTaskType(''); setEstimatedTime(''); setTakenTime('');
        toast(`✅ Staged locally (${draftEntries.length + 1} pending) — use Preview & Submit when ready`);
    };

    const toggleDraftSelected = (id) => {
        setDraftEntries((prev) => prev.map((row) => (
            row.id === id ? { ...row, selected: !row.selected } : row
        )));
    };

    const removeDraftEntry = (id) => {
        setDraftEntries((prev) => prev.filter((row) => row.id !== id));
    };

    const clearAllDrafts = () => {
        if (!draftEntries.length) return;
        if (!window.confirm('Clear all pending local entries?')) return;
        setDraftEntries([]);
        if (session?.user?.id) clearDailyEntryDrafts(session.user.id);
    };

    const handleSubmitDrafts = async () => {
        const selected = draftEntries.filter((row) => row.selected !== false);
        if (!selected.length) {
            toast('❌ Select at least one pending entry to submit');
            return;
        }
        if (isSyncing) return;
        if (typeof setIsSyncing === 'function') setIsSyncing(true);
        try {
            await syncDraftBatchToSupabase(selected);
            const selectedIds = new Set(selected.map((row) => row.id));
            setDraftEntries((prev) => prev.filter((row) => !selectedIds.has(row.id)));
            if (typeof onRefresh === 'function') await onRefresh();
            toast(`✅ Submitted ${selected.length} entr${selected.length === 1 ? 'y' : 'ies'} to the database`);

            if (notificationsEnabled && canSelectPerformerOnForm) {
                selected.forEach((entry) => {
                    if (entry.performerName === profile?.performer_name) return;
                    const selectedProf = accessibleProfiles.find((p) => p.performer_name === entry.performerName);
                    if (selectedProf?.id && selectedProf.id !== session?.user?.id) {
                        notifyDailyTrackerEvent({
                            type: 'entry_on_behalf',
                            receiverIds: [selectedProf.id],
                            title: 'Entry logged on your behalf',
                            message: `${profile?.performer_name || 'A manager'} logged an entry for ${entry.date}`,
                            senderId: session?.user?.id,
                            entryId: null,
                        }).catch(() => {});
                    }
                });
            }
        } catch (error) {
            console.error('Batch submit failed:', error.message);
            toast('❌ Submit failed: ' + error.message);
        } finally {
            if (typeof setIsSyncing === 'function') setIsSyncing(false);
        }
    };

    return (
        <div className="space-y-8 w-full">
            <div className="flex flex-col lg:flex-row gap-12">
                <div className="flex-1 max-w-xl">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600"><Briefcase size={24} /></div>
                        <h2 className="text-2xl font-bold">Add Task</h2>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Performer</label>
                                {canSelectPerformerOnForm ? (
                                    <select
                                        value={performerName}
                                        onChange={(e) => setPerformerName(e.target.value)}
                                        className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:20px_20px] bg-[right_1rem_center] bg-no-repeat"
                                    >
                                        <option value={profile.performer_name}>{profile.performer_name} (You)</option>
                                        {accessibleProfiles.filter((p) => p.id !== session.user.id).map((p) => (
                                            <option key={p.id} value={p.performer_name}>{p.performer_name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input type="text" value={performerName} readOnly className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 cursor-not-allowed font-medium" />
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Date</label>
                                <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium" required />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Client</label>
                                {canSelectPerformerOnForm ? (
                                    <select
                                        value={selectedClient}
                                        onChange={(e) => setSelectedClient(e.target.value)}
                                        className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:20px_20px] bg-[right_1rem_center] bg-no-repeat"
                                    >
                                        <option value="DEFAULT_CLIENT">DEFAULT_CLIENT</option>
                                        {clients.map((c) => (
                                            <option key={c.id} value={c.code}>{c.code}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input type="text" value={selectedClient || 'DEFAULT_CLIENT'} readOnly className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 cursor-not-allowed font-medium uppercase" />
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Sub-division</label>
                                {canSelectPerformerOnForm ? (
                                    <select
                                        value={selectedSubDivision}
                                        onChange={(e) => setSelectedSubDivision(e.target.value)}
                                        className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:20px_20px] bg-[right_1rem_center] bg-no-repeat pr-10"
                                    >
                                        <option value="">None</option>
                                        <option value="PreEdit">PreEdit</option>
                                        <option value="Validation">Validation</option>
                                    </select>
                                ) : (
                                    <input type="text" value={selectedSubDivision || 'None'} readOnly className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 cursor-not-allowed font-medium" />
                                )}
                            </div>
                        </div>

                        {isTitlesTask ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Project/Title Name</label>
                                    <input type="text" value={titleName} onChange={(e) => setTitleName(e.target.value)} className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium" placeholder="e.g., Springer Nature Vol 42" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Pages</label>
                                    <input
                                        type="number"
                                        value={castOffPages}
                                        onChange={(e) => setCastOffPages(e.target.value)}
                                        className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                                        placeholder="Optional"
                                        min={0}
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1 ml-1">
                                        Reference only — not used in estimate
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Project/Title Name</label>
                                <input type="text" value={titleName} onChange={(e) => setTitleName(e.target.value)} className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium" placeholder="e.g., Springer Nature Vol 42" required />
                            </div>
                        )}

                        <div>
                            <label className="inline-flex items-center gap-2 cursor-pointer select-none mb-2 ml-1">
                                <input
                                    type="checkbox"
                                    checked={batchFlow}
                                    onChange={(e) => {
                                        const on = e.target.checked;
                                        setBatchFlow(on);
                                        if (!on) setBatchNumber('');
                                    }}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs font-black uppercase tracking-widest text-gray-400">Batch flow</span>
                            </label>
                            {batchFlow && (
                                <>
                                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">
                                        Batch Number <span className="text-red-500 normal-case tracking-normal">(required)</span>
                                    </label>
                                    <select
                                        value={batchNumber}
                                        onChange={(e) => setBatchNumber(e.target.value)}
                                        required
                                        className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none font-medium"
                                    >
                                        <option value="">Select batch</option>
                                        {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => (
                                            <option key={n} value={n}>Batch {n}</option>
                                        ))}
                                    </select>
                                </>
                            )}
                        </div>

                        <div className={`grid grid-cols-1 gap-6 ${isTitlesTask ? '' : 'md:grid-cols-2'}`}>
                            <div>
                                <div className="flex items-center justify-between gap-3 mb-2 ml-1">
                                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400">Task Type</label>
                                    <button
                                        type="button"
                                        onClick={() => setShowTargetInfoModal(true)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                    >
                                        <Info size={13} /> Target Info
                                    </button>
                                </div>
                                <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:20px_20px] bg-[right_1rem_center] bg-no-repeat font-medium" required>
                                    <option value="">Select Task</option>
                                    {taskTypeOptions.map((k) => <option key={k} value={k}>{k}</option>)}
                                </select>
                                {taskType && !isMiscellaneous ? (
                                    <p className="text-[10px] text-gray-400 mt-1 ml-1">
                                        Target: {activeTargetVal} {activeTargetUnit} · Source: {activeTargetSource}
                                        {isTitlesTask ? ' · 1 title per entry' : ''}
                                    </p>
                                ) : null}
                            </div>
                            {!isTitlesTask ? (
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">{completedWorkMeta.label}</label>
                                    <input
                                        type="number"
                                        value={completedPages}
                                        onChange={(e) => setCompletedPages(e.target.value)}
                                        className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                                        placeholder={completedWorkMeta.placeholder}
                                        required
                                    />
                                </div>
                            ) : null}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Estimated Hours</label>
                                <input
                                    type="number"
                                    value={estimatedTime}
                                    onChange={(e) => setEstimatedTime(e.target.value)}
                                    className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                                    step="0.1"
                                    min={isMiscellaneous ? MIN_HOURS : 0.1}
                                    max={isMiscellaneous ? MAX_HOURS : undefined}
                                    placeholder={isMiscellaneous ? '1.0 – 4.0' : 'Auto'}
                                    readOnly={!isMiscellaneous}
                                    required
                                />
                                {isMiscellaneous ? (
                                    <p className="text-[10px] text-gray-400 mt-1 ml-1">Miscellaneous only: {MIN_HOURS}–{MAX_HOURS} hours</p>
                                ) : isTitlesTask && hoursPerUnit > 0 ? (
                                    <p className="text-[10px] text-gray-400 mt-1 ml-1">
                                        1 title per entry ≈ {hoursPerUnit.toFixed(2)}h · add another entry for more titles
                                    </p>
                                ) : hoursPerUnit > 0 ? (
                                    <p className="text-[10px] text-gray-400 mt-1 ml-1">
                                        1 {completedWorkMeta.unitWord} ≈ {hoursPerUnit.toFixed(2)}h
                                        {completedPages
                                            ? ` · Est = ${completedPages} × ${hoursPerUnit.toFixed(2)}h`
                                            : ''}
                                    </p>
                                ) : (
                                    <p className="text-[10px] text-gray-400 mt-1 ml-1">Auto: Completed Work × 8 ÷ Daily Target</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Taken Hours</label>
                                <input
                                    type="number"
                                    value={takenTime}
                                    onChange={(e) => setTakenTime(e.target.value)}
                                    className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                                    step="0.1"
                                    min={isMiscellaneous ? MIN_HOURS : 0.1}
                                    max={isMiscellaneous ? MAX_HOURS : undefined}
                                    placeholder={isMiscellaneous ? '1.0 – 4.0' : '7.5'}
                                    required
                                />
                                {isMiscellaneous ? (
                                    <p className="text-[10px] text-gray-400 mt-1 ml-1">Miscellaneous only: {MIN_HOURS}–{MAX_HOURS} hours</p>
                                ) : null}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSyncing}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm disabled:opacity-50"
                        >
                            <ShieldCheck size={20} /> Authorize and Log
                        </button>
                    </form>
                </div>

                {summarySlot}
            </div>

            {draftEntries.length ? (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-sm p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-amber-800 dark:text-amber-200">
                                Pending entries (local) · {draftEntries.length}
                            </h3>
                            <p className="text-[10px] font-semibold text-gray-500 mt-1">
                                Staged in this browser only — not in the database until you submit
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={clearAllDrafts}
                                disabled={isSyncing}
                                className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 disabled:opacity-50"
                            >
                                Clear all
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmitDrafts}
                                disabled={isSyncing || !draftEntries.some((row) => row.selected !== false)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                            >
                                {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                Preview &amp; Submit
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                        <table className="min-w-full text-left text-xs">
                            <thead className="bg-gray-50 dark:bg-gray-800/80 text-[10px] font-black uppercase tracking-widest text-gray-500">
                                <tr>
                                    <th className="px-3 py-2">Sel</th>
                                    <th className="px-3 py-2">Date</th>
                                    <th className="px-3 py-2">Title</th>
                                    <th className="px-3 py-2">Task</th>
                                    <th className="px-3 py-2">Work</th>
                                    <th className="px-3 py-2">Taken h</th>
                                    <th className="px-3 py-2">Client</th>
                                    <th className="px-3 py-2" />
                                </tr>
                            </thead>
                            <tbody>
                                {draftEntries.map((row) => (
                                    <tr key={row.id} className="border-t border-gray-100 dark:border-gray-800">
                                        <td className="px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={row.selected !== false}
                                                onChange={() => toggleDraftSelected(row.id)}
                                                disabled={isSyncing}
                                            />
                                        </td>
                                        <td className="px-3 py-2 font-semibold whitespace-nowrap">{String(row.date).slice(0, 10)}</td>
                                        <td className="px-3 py-2 font-semibold">{row.titleName}</td>
                                        <td className="px-3 py-2">{row.taskType}</td>
                                        <td className="px-3 py-2">{row.completedPages}</td>
                                        <td className="px-3 py-2">{row.takenTime}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {row.client_id}{row.sub_division ? ` / ${row.sub_division}` : ''}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <button
                                                type="button"
                                                onClick={() => removeDraftEntry(row.id)}
                                                disabled={isSyncing}
                                                className="text-red-600 hover:text-red-700 disabled:opacity-50"
                                                title="Remove"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}

            <Modal
                show={showTargetInfoModal}
                onClose={() => setShowTargetInfoModal(false)}
                maxWidth="max-w-5xl"
            >
                <div className="text-left flex flex-col min-h-0 flex-1 overflow-hidden">
                    <div className="flex items-start justify-between gap-4 mb-4 shrink-0">
                        <div className="min-w-0 pr-2">
                            <h2 className="text-xl font-black text-gray-900 dark:text-white">Daily Targets & Score Formula</h2>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1">
                                Estimated Hours are calculated from completed work against the active daily target.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowTargetInfoModal(false)}
                            className="shrink-0 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs font-black uppercase tracking-wider text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            Close
                        </button>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
                        <div className="mb-4 rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/30 px-4 py-3">
                            {taskType ? (
                                <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
                                    {isMiscellaneous
                                        ? 'Current task is Miscellaneous: estimated and taken hours are manual, allowed range 1-4 hours.'
                                        : `Current task uses ${activeTargetSource.toLowerCase()}: ${activeTargetVal} ${activeTargetUnit}.`}
                                </p>
                            ) : (
                                <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
                                    Select a task to highlight its target and active source.
                                </p>
                            )}
                        </div>

                        <div className="max-h-[40vh] overflow-auto rounded-xl border border-gray-200 dark:border-gray-700">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-500">Task Type</th>
                                        <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-gray-500">Daily Target</th>
                                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-500">Unit</th>
                                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-500">Estimated Hours Formula</th>
                                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-500">Example</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                                    {TARGET_INFO_ROWS.map((row) => {
                                        const isActiveRow = normalizeTaskType(taskType) === row.taskType || taskType === row.taskType;
                                        return (
                                            <tr
                                                key={row.taskType}
                                                className={isActiveRow ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'}
                                            >
                                                <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{row.taskType}</td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">{row.target ?? 'none'}</td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.unit}</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{row.formula}</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{row.example}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
                                <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Productive Task Formula</h3>
                                <div className="space-y-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    <p><span className="font-mono">Estimated Hours = Completed Work × 8 ÷ Daily Target</span></p>
                                    <p><span className="font-mono">Time Achieved % = Estimated Hours ÷ Taken Hours × 100</span></p>
                                    <p><span className="font-mono">Target Achieved % = Completed Work ÷ ((Daily Target ÷ 8) × Taken Hours) × 100</span></p>
                                    <p><span className="font-mono">Performance Score = 60% Target Achieved + 40% Time Achieved</span></p>
                                </div>
                            </div>
                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
                                <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Miscellaneous Rule</h3>
                                <div className="space-y-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    <p>Miscellaneous has no productivity target.</p>
                                    <p>Estimated Hours and Taken Hours are entered manually.</p>
                                    <p>Allowed range: 1-4 hours.</p>
                                    <p><span className="font-mono">Misc Score = min((Taken Hours ÷ 8) × 100, 100)</span></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>

        </div>
    );
};

export default DailyTaskForm;
