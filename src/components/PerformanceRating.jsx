import React, { useMemo, useState, useEffect } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Award, Lightbulb, Trophy, Users, Layers } from 'lucide-react';
import {
    aggregatePerformanceRatings,
    buildProfileMap,
    buildRatingSuggestions,
    filterEntriesByPeriod,
    getRatingBand,
    listAvailablePeriods,
    scoreEntry,
    summarizeBandDistribution,
} from '../lib/performanceRating';
import { exportRatingsToCSV, exportRatingsToExcel } from '../lib/exportUtils';
import DataExport from './DataExport';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const GROUP_OPTIONS = [
    { id: 'individual', label: 'Individual', icon: Trophy },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'process', label: 'Process', icon: Layers },
];

const PERIOD_MODES = [
    { id: 'monthly', label: 'Monthly' },
    { id: 'quarterly', label: 'Quarterly' },
    { id: 'yearly', label: 'Yearly' },
];

const PerformanceRating = ({
    entries = [],
    filteredEntries = null,
    userProfile,
    accessibleProfiles = [],
    clients = [],
    initialFilters = {},
    onFiltersApplied,
}) => {
    const baseEntries = filteredEntries ?? entries;
    const periods = useMemo(() => listAvailablePeriods(baseEntries), [baseEntries]);

    const [groupBy, setGroupBy] = useState(initialFilters.groupBy || 'individual');
    const [periodMode, setPeriodMode] = useState(
        initialFilters.period === 'weekly' ? 'monthly' : initialFilters.period || 'monthly'
    );
    const [periodKey, setPeriodKey] = useState('');
    const [clientFilter, setClientFilter] = useState(initialFilters.client || 'all');
    const [divisionFilter, setDivisionFilter] = useState(initialFilters.division || 'all');
    const [rangeStart, setRangeStart] = useState(initialFilters.start || '');
    const [rangeEnd, setRangeEnd] = useState(initialFilters.end || '');

    // Seed period key from available data or deep-link week range
    useEffect(() => {
        if (initialFilters.start && initialFilters.end) {
            setRangeStart(initialFilters.start);
            setRangeEnd(initialFilters.end);
        }
        if (initialFilters.client) setClientFilter(initialFilters.client);
        if (initialFilters.division) setDivisionFilter(initialFilters.division);
        if (initialFilters.groupBy) setGroupBy(initialFilters.groupBy);
        if (initialFilters.period && initialFilters.period !== 'weekly') {
            setPeriodMode(initialFilters.period);
        }
        if (typeof onFiltersApplied === 'function') onFiltersApplied();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const options = periods[periodMode] || [];
        if (!options.length) {
            setPeriodKey('');
            return;
        }
        if (!options.includes(periodKey)) {
            setPeriodKey(options[0]);
        }
    }, [periodMode, periods, periodKey]);

    const profileMap = useMemo(() => buildProfileMap(accessibleProfiles), [accessibleProfiles]);

    const scopedEntries = useMemo(() => {
        let result = [...baseEntries];

        if (clientFilter && clientFilter !== 'all') {
            result = result.filter((e) => e.client_id === clientFilter);
        }
        if (divisionFilter && divisionFilter !== 'all') {
            result = result.filter((e) => (e.sub_division || 'General') === divisionFilter);
        }

        if (rangeStart && rangeEnd) {
            result = filterEntriesByPeriod(result, { start: rangeStart, end: rangeEnd });
        } else if (periodKey) {
            result = filterEntriesByPeriod(result, { mode: periodMode, key: periodKey });
        }

        return result;
    }, [baseEntries, clientFilter, divisionFilter, rangeStart, rangeEnd, periodMode, periodKey]);

    const rankedRows = useMemo(
        () => aggregatePerformanceRatings(scopedEntries, groupBy, profileMap),
        [scopedEntries, groupBy, profileMap]
    );

    const suggestions = useMemo(() => buildRatingSuggestions(rankedRows), [rankedRows]);
    const bandDist = useMemo(() => summarizeBandDistribution(rankedRows), [rankedRows]);

    const overallScore = useMemo(() => {
        if (!scopedEntries.length) return 0;
        let sum = 0;
        let weight = 0;
        scopedEntries.forEach((e) => {
            const h = Number(e.takenTime);
            const w = Number.isFinite(h) && h > 0 ? h : 1;
            sum += scoreEntry(e) * w;
            weight += w;
        });
        return weight > 0 ? Number((sum / weight).toFixed(2)) : 0;
    }, [scopedEntries]);

    const overallBand = getRatingBand(overallScore);

    const clientOptions = useMemo(() => {
        if (clients?.length) return clients.map((c) => c.code);
        return [...new Set(baseEntries.map((e) => e.client_id).filter(Boolean))];
    }, [clients, baseEntries]);

    const divisionOptions = useMemo(() => {
        const set = new Set(
            baseEntries.map((e) => e.sub_division || 'General').filter(Boolean)
        );
        return [...set].sort();
    }, [baseEntries]);

    const barData = useMemo(
        () => ({
            labels: rankedRows.slice(0, 12).map((r) => r.label),
            datasets: [
                {
                    label: 'Performance Score %',
                    data: rankedRows.slice(0, 12).map((r) => r.score),
                    backgroundColor: rankedRows.slice(0, 12).map((r) => {
                        if (r.band === 'excellent') return 'rgba(34, 197, 94, 0.75)';
                        if (r.band === 'good') return 'rgba(59, 130, 246, 0.75)';
                        return 'rgba(245, 158, 11, 0.75)';
                    }),
                    borderRadius: 8,
                },
            ],
        }),
        [rankedRows]
    );

    const doughnutData = useMemo(
        () => ({
            labels: ['Excellent', 'Good', 'Needs Improvement'],
            datasets: [
                {
                    data: [bandDist.excellent, bandDist.good, bandDist.needs_improvement],
                    backgroundColor: [
                        'rgba(34, 197, 94, 0.8)',
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                    ],
                    borderWidth: 0,
                },
            ],
        }),
        [bandDist]
    );

    const periodLabel = rangeStart && rangeEnd
        ? `${rangeStart} → ${rangeEnd}`
        : periodKey || 'All available';

    const handleExportCsv = () => {
        exportRatingsToCSV(rankedRows, scopedEntries, {
            filename: 'cbpet_performance_ratings',
            periodLabel,
            groupBy,
        });
    };

    const handleExportXlsx = () => {
        exportRatingsToExcel(rankedRows, scopedEntries, {
            filename: 'cbpet_performance_ratings',
            periodLabel,
            groupBy,
        });
    };

    const isManager = ['super_admin', 'general_manager', 'manager'].includes(userProfile?.role);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-2xl text-amber-600">
                        <Award size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight">Performance Rating</h2>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">
                            60% target + 40% time · Misc = hours÷8 · {periodLabel}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleExportCsv}
                        disabled={!rankedRows.length}
                        className="px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl bg-green-600 text-white disabled:opacity-40"
                    >
                        CSV
                    </button>
                    <button
                        type="button"
                        onClick={handleExportXlsx}
                        disabled={!rankedRows.length}
                        className="px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl bg-blue-600 text-white disabled:opacity-40"
                    >
                        Excel
                    </button>
                </div>
            </div>

            {/* Group + period controls */}
            <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 flex flex-wrap gap-4 items-end">
                <div className="flex rounded-xl bg-white dark:bg-gray-900 p-1 border border-gray-200 dark:border-gray-700">
                    {GROUP_OPTIONS.map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => setGroupBy(opt.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                                groupBy === opt.id ? 'bg-blue-600 text-white' : 'text-gray-500'
                            }`}
                        >
                            <opt.icon size={14} /> {opt.label}
                        </button>
                    ))}
                </div>

                <div className="flex rounded-xl bg-white dark:bg-gray-900 p-1 border border-gray-200 dark:border-gray-700">
                    {PERIOD_MODES.map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                                setPeriodMode(opt.id);
                                setRangeStart('');
                                setRangeEnd('');
                            }}
                            className={`px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                                periodMode === opt.id && !rangeStart
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-500'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {!rangeStart && (
                    <select
                        value={periodKey}
                        onChange={(e) => setPeriodKey(e.target.value)}
                        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-2.5 rounded-xl text-xs font-bold min-w-[140px]"
                    >
                        {(periods[periodMode] || []).map((k) => (
                            <option key={k} value={k}>
                                {k}
                            </option>
                        ))}
                        {!(periods[periodMode] || []).length && (
                            <option value="">No periods</option>
                        )}
                    </select>
                )}

                {isManager && (
                    <>
                        <select
                            value={clientFilter}
                            onChange={(e) => setClientFilter(e.target.value)}
                            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-2.5 rounded-xl text-xs font-bold min-w-[140px]"
                        >
                            <option value="all">All clients</option>
                            {clientOptions.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                        <select
                            value={divisionFilter}
                            onChange={(e) => setDivisionFilter(e.target.value)}
                            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-2.5 rounded-xl text-xs font-bold min-w-[140px]"
                        >
                            <option value="all">All divisions</option>
                            {divisionOptions.map((d) => (
                                <option key={d} value={d}>
                                    {d}
                                </option>
                            ))}
                        </select>
                    </>
                )}

                {(rangeStart || rangeEnd) && (
                    <button
                        type="button"
                        onClick={() => {
                            setRangeStart('');
                            setRangeEnd('');
                        }}
                        className="text-[10px] font-black uppercase tracking-wider text-blue-600 px-3 py-2"
                    >
                        Clear week link range
                    </button>
                )}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                        Overall Score
                    </p>
                    <p className="text-3xl font-black">{scopedEntries.length ? `${overallScore}%` : '—'}</p>
                    <p className="text-[10px] font-bold text-amber-600 mt-1">{overallBand.label}</p>
                </div>
                <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                        Ranked Units
                    </p>
                    <p className="text-3xl font-black">{rankedRows.length}</p>
                </div>
                <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                        Entries Scored
                    </p>
                    <p className="text-3xl font-black">{scopedEntries.length}</p>
                </div>
                <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                        Excellent / Good / NI
                    </p>
                    <p className="text-xl font-black">
                        {bandDist.excellent} / {bandDist.good} / {bandDist.needs_improvement}
                    </p>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-6">
                        Score Ranking ({groupBy})
                    </h3>
                    <div className="h-[280px]">
                        {rankedRows.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-xs text-gray-400 font-mono">
                                No rating data for this period
                            </div>
                        ) : (
                            <Bar
                                data={barData}
                                options={{
                                    maintainAspectRatio: false,
                                    responsive: true,
                                    plugins: { legend: { display: false } },
                                    scales: {
                                        y: {
                                            beginAtZero: true,
                                            max: 100,
                                            grid: { color: 'rgba(0,0,0,0.05)' },
                                        },
                                        x: { grid: { display: false } },
                                    },
                                }}
                            />
                        )}
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-6">
                        Rating Bands
                    </h3>
                    <div className="h-[220px]">
                        {rankedRows.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-xs text-gray-400">
                                —
                            </div>
                        ) : (
                            <Doughnut
                                data={doughnutData}
                                options={{
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: {
                                            position: 'bottom',
                                            labels: { boxWidth: 10, font: { size: 10, weight: 'bold' } },
                                        },
                                    },
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>

            {suggestions.length > 0 && (
                <div className="p-5 rounded-3xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/40">
                    <div className="flex items-center gap-2 mb-3">
                        <Lightbulb size={16} className="text-amber-600" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                            Ideas & Suggestions
                        </h3>
                    </div>
                    <ul className="space-y-2">
                        {suggestions.map((s) => (
                            <li key={s.id} className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed">
                                {s.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Ranked table */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400">
                                    Rank
                                </th>
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400">
                                    {groupBy === 'process' ? 'Process' : groupBy === 'team' ? 'Team' : 'Performer'}
                                </th>
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">
                                    Score
                                </th>
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-center">
                                    Band
                                </th>
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">
                                    Target %
                                </th>
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">
                                    Time %
                                </th>
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">
                                    Hours
                                </th>
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">
                                    Logs
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {rankedRows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-10 text-center text-xs text-gray-400 italic">
                                        No performance ratings for the selected filters
                                    </td>
                                </tr>
                            ) : (
                                rankedRows.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors"
                                    >
                                        <td className="p-4 font-black text-sm">#{row.rank}</td>
                                        <td className="p-4 font-bold text-sm">{row.label}</td>
                                        <td className="p-4 text-right font-black font-mono text-sm">
                                            {row.score}%
                                        </td>
                                        <td className="p-4 text-center">
                                            <span
                                                className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                                    row.band === 'excellent'
                                                        ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : row.band === 'good'
                                                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                          : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                }`}
                                            >
                                                {row.bandLabel}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right text-sm font-mono text-gray-600 dark:text-gray-400">
                                            {row.avgTarget != null ? `${row.avgTarget}%` : '—'}
                                        </td>
                                        <td className="p-4 text-right text-sm font-mono text-gray-600 dark:text-gray-400">
                                            {row.avgTime != null ? `${row.avgTime}%` : '—'}
                                        </td>
                                        <td className="p-4 text-right text-sm font-mono">{row.totalHours}h</td>
                                        <td className="p-4 text-right text-sm font-mono">
                                            {row.count}
                                            {row.miscCount > 0 ? (
                                                <span className="text-[9px] text-gray-400 ml-1">
                                                    ({row.miscCount} misc)
                                                </span>
                                            ) : null}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Raw scoped export helper for managers who still want entry export */}
            <div className="flex justify-end">
                <DataExport
                    entries={entries}
                    filteredEntries={scopedEntries}
                    label="Raw entries"
                />
            </div>
        </div>
    );
};

export default PerformanceRating;
