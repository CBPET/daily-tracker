import { useMemo, useState } from 'react';
import { Calendar, RefreshCw, Users, User, Lightbulb } from 'lucide-react';
import {
    aggregateDayMetrics,
    buildTargetSuggestions,
    getCurrentMonthPrefix,
    getCurrentWeekRange,
    getLocalISODate,
    isTargetFreeTask,
} from '../lib/targetUtils';

const PERIOD_DAY = 'day';
const PERIOD_WEEK = 'week';
const PERIOD_MONTH = 'month';

const DailySummary = ({
    entries,
    profile,
    accessibleProfiles = [],
    onDeleteEntry,
    onRefresh,
    isSyncing,
    canDeleteEntry,
    divisionTargets = [],
    getTargetForEntry,
}) => {
    const [summaryDate, setSummaryDate] = useState(() => getLocalISODate());
    const [period, setPeriod] = useState(PERIOD_DAY);
    const [viewMode, setViewMode] = useState('team');
    const [selectedPerformer, setSelectedPerformer] = useState('all');

    const role = profile?.role || 'performer';
    const isManager = ['super_admin', 'general_manager', 'manager'].includes(role);
    const isTeamLead = role === 'team_lead' || role === 'group_lead';
    const isPerformer = role === 'performer';
    const canToggleView = isManager || isTeamLead;

    const performerOptions = useMemo(() => {
        const names = [...new Set(accessibleProfiles.map((p) => p.performer_name).filter(Boolean))];
        if (isPerformer && profile?.performer_name && !names.includes(profile.performer_name)) {
            names.unshift(profile.performer_name);
        }
        return names.sort();
    }, [accessibleProfiles, isPerformer, profile?.performer_name]);

    const periodMeta = useMemo(() => {
        if (period === PERIOD_WEEK) {
            const { start, end } = getCurrentWeekRange();
            return {
                label: 'Current Week',
                emptyLabel: 'No activity for this week',
                subtitle: `${start} → ${end}`,
                rangeHint: 'Monday–Sunday · local time',
            };
        }
        if (period === PERIOD_MONTH) {
            const prefix = getCurrentMonthPrefix();
            return {
                label: 'Current Month',
                emptyLabel: 'No activity for this month',
                subtitle: prefix,
                rangeHint: 'Calendar month · local time',
            };
        }
        return {
            label: 'Daily Summary',
            emptyLabel: 'No activity for this date',
            subtitle: summaryDate,
            rangeHint: 'Selected day',
        };
    }, [period, summaryDate]);

    const periodEntries = useMemo(() => {
        let result = [...entries];

        if (period === PERIOD_WEEK) {
            const { start, end } = getCurrentWeekRange();
            result = result.filter((e) => e.date >= start && e.date <= end);
        } else if (period === PERIOD_MONTH) {
            const prefix = getCurrentMonthPrefix();
            result = result.filter((e) => typeof e.date === 'string' && e.date.startsWith(prefix));
        } else {
            result = result.filter((e) => e.date === summaryDate);
        }

        if (isPerformer) {
            return result.filter((e) => e.performerName === profile?.performer_name);
        }

        if (viewMode === 'individual' && selectedPerformer !== 'all') {
            result = result.filter((e) => e.performerName === selectedPerformer);
        }

        return result;
    }, [entries, period, summaryDate, isPerformer, viewMode, selectedPerformer, profile?.performer_name]);

    const { avgTarget, avgTime, count } = aggregateDayMetrics(periodEntries);

    const groupedByTask = useMemo(() => {
        const groups = {};
        periodEntries.forEach((e) => {
            const key = e.taskType || 'Unknown';
            if (!groups[key]) groups[key] = [];
            groups[key].push(e);
        });
        return groups;
    }, [periodEntries]);

    const suggestions = useMemo(() => {
        const resolveTarget =
            typeof getTargetForEntry === 'function'
                ? getTargetForEntry
                : (task, client, subDiv) => {
                      const custom = (divisionTargets || []).find(
                          (t) =>
                              t.client_id === client &&
                              t.sub_division === subDiv &&
                              t.task_type === task
                      );
                      return custom ? Number(custom.target_value) : 0;
                  };
        return buildTargetSuggestions(periodEntries, resolveTarget);
    }, [periodEntries, divisionTargets, getTargetForEntry]);

    const uniquePerformers = useMemo(
        () => new Set(periodEntries.map((e) => e.performerName)).size,
        [periodEntries]
    );

    return (
        <div className="flex-1 min-w-0 bg-gray-50 dark:bg-gray-800/50 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 flex flex-col max-h-[calc(100vh-12rem)]">
            <div className="flex flex-col gap-4 mb-6 shrink-0">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                            {periodMeta.label}
                        </h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                            {periodMeta.subtitle} · {periodMeta.rangeHint}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {period === PERIOD_DAY && (
                            <div className="relative">
                                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <input
                                    type="date"
                                    value={summaryDate}
                                    onChange={(e) => setSummaryDate(e.target.value)}
                                    className="pl-9 pr-3 py-2 text-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-lg outline-none font-bold focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={onRefresh}
                            disabled={isSyncing}
                            className={`p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${isSyncing ? 'animate-spin' : ''}`}
                            aria-label="Refresh entries"
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>
                </div>

                <div className="flex rounded-xl bg-white dark:bg-gray-900 p-1 border border-gray-200 dark:border-gray-700 w-full sm:w-auto">
                    {[
                        { id: PERIOD_DAY, label: 'Day' },
                        { id: PERIOD_WEEK, label: 'This Week' },
                        { id: PERIOD_MONTH, label: 'This Month' },
                    ].map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => setPeriod(opt.id)}
                            className={`flex-1 sm:flex-none px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                                period === opt.id ? 'bg-blue-600 text-white' : 'text-gray-500'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {canToggleView && (
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex rounded-xl bg-white dark:bg-gray-900 p-1 border border-gray-200 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => {
                                    setViewMode('team');
                                    setSelectedPerformer('all');
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${viewMode === 'team' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                            >
                                <Users size={14} /> Team
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('individual')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${viewMode === 'individual' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                            >
                                <User size={14} /> Individual
                            </button>
                        </div>
                        {viewMode === 'individual' && (
                            <select
                                value={selectedPerformer}
                                onChange={(e) => setSelectedPerformer(e.target.value)}
                                className="flex-1 text-xs font-bold p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">Select performer…</option>
                                {performerOptions.map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 shrink-0">
                <div className="p-4 rounded-2xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900">
                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">
                        Target Achievement
                    </p>
                    <span
                        className={`text-3xl font-extrabold ${
                            Number(avgTarget) >= 100
                                ? 'text-green-700 dark:text-green-400'
                                : 'text-amber-600'
                        }`}
                    >
                        {count ? `${avgTarget}%` : '—'}
                    </span>
                    <p className="text-[9px] text-gray-500 mt-1">
                        {count} task{count !== 1 ? 's' : ''} logged
                        {canToggleView && viewMode === 'team'
                            ? ` · ${uniquePerformers} performer${uniquePerformers !== 1 ? 's' : ''}`
                            : ''}
                    </p>
                </div>
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900">
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">
                        Time Efficiency
                    </p>
                    <span className="text-3xl font-extrabold text-indigo-700 dark:text-indigo-400">
                        {count ? `${avgTime}%` : '—'}
                    </span>
                    <p className="text-[9px] text-gray-500 mt-1">
                        {viewMode === 'team' && canToggleView
                            ? 'Weighted avg · Team'
                            : `Based on ${period === PERIOD_DAY ? 'day' : period === PERIOD_WEEK ? 'week' : 'month'} entries`}
                    </p>
                </div>
            </div>

            {suggestions.length > 0 && (
                <div className="mb-4 shrink-0 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/40">
                    <div className="flex items-center gap-2 mb-3">
                        <Lightbulb size={16} className="text-amber-600" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                            Suggestions · Target Correction
                        </h3>
                    </div>
                    <ul className="space-y-2">
                        {suggestions.map((s) => (
                            <li
                                key={`${s.taskType}-${s.client_id}-${s.sub_division}`}
                                className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed"
                            >
                                <span className="font-black">{s.taskType}</span>
                                {s.client_id && s.client_id !== 'DEFAULT_CLIENT' ? (
                                    <span className="text-amber-600/80"> · {s.client_id}</span>
                                ) : null}
                                {s.sub_division ? (
                                    <span className="text-amber-600/80"> · {s.sub_division}</span>
                                ) : null}
                                <span className="block mt-0.5 text-[11px]">
                                    Avg delay +{s.avgDelayPercent}% across {s.count} log
                                    {s.count !== 1 ? 's' : ''}. Consider lowering target from{' '}
                                    <span className="line-through opacity-70">{s.currentTarget}/d</span> to{' '}
                                    <span className="font-black text-green-700 dark:text-green-400">
                                        {s.suggestedTarget}/d
                                    </span>
                                    .
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar space-y-4">
                {count === 0 ? (
                    <div className="text-center py-16 bg-white/50 dark:bg-gray-900/30 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-black uppercase text-gray-400">{periodMeta.emptyLabel}</p>
                    </div>
                ) : (
                    Object.entries(groupedByTask).map(([taskType, taskEntries]) => (
                        <div key={taskType} className="space-y-2">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 px-1">
                                {taskType}
                                {isTargetFreeTask(taskType) ? (
                                    <span className="ml-2 text-gray-400 normal-case tracking-normal font-bold">
                                        (no target)
                                    </span>
                                ) : null}
                            </h3>
                            {taskEntries.map((e) => (
                                <div
                                    key={e.id}
                                    className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-start justify-between gap-3 group hover:border-blue-200 transition-colors"
                                >
                                    <div className="flex-1 min-w-0">
                                        {(isTeamLead || isManager) && (
                                            <p className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 mb-0.5">
                                                {e.performerName}
                                            </p>
                                        )}
                                        <p className="font-bold text-sm truncate" title={e.titleName}>
                                            {e.titleName}
                                        </p>
                                        <p className="text-[10px] text-gray-500 mt-1">
                                            {period !== PERIOD_DAY ? `${e.date} · ` : ''}
                                            Completed: {e.completedPages} · {e.takenTime}h taken
                                        </p>
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            {e.client_id && e.client_id !== 'DEFAULT_CLIENT' && (
                                                <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-[9px] font-black uppercase tracking-wider">
                                                    {e.client_id}
                                                </span>
                                            )}
                                            {e.sub_division && (
                                                <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-[9px] font-black uppercase tracking-wider">
                                                    {e.sub_division}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        {isTargetFreeTask(e.taskType) ? (
                                            <p className="font-black text-sm text-gray-400">N/A</p>
                                        ) : (
                                            <p
                                                className={`font-black text-sm ${
                                                    Number(e.targetAchieved) >= 100
                                                        ? 'text-green-600'
                                                        : 'text-amber-500'
                                                }`}
                                            >
                                                {e.targetAchieved}%
                                            </p>
                                        )}
                                        <p className="text-[10px] text-indigo-500 font-bold">
                                            {e.timeAchieved}% time
                                        </p>
                                        {canDeleteEntry?.(e) && (
                                            <button
                                                type="button"
                                                onClick={() => onDeleteEntry(e.id)}
                                                className="text-[10px] font-black uppercase text-red-500 opacity-0 group-hover:opacity-100 transition-opacity mt-1"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default DailySummary;
