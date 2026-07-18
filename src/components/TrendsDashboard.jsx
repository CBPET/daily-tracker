import React, { useState, useMemo, useEffect } from 'react';
import { 
    Chart as ChartJS, 
    CategoryScale, 
    LinearScale, 
    PointElement, 
    LineElement, 
    Title, 
    Tooltip, 
    Legend 
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { 
    Calendar, 
    Clock, 
    TrendingUp, 
    AlertTriangle, 
    ChevronLeft, 
    ChevronRight, 
    Info 
} from 'lucide-react';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const TrendsDashboard = ({
    filteredEntries,
    userProfile,
    divisionTargets,
    getDynamicTarget,
    getDynamicTargetAchieved,
    STANDARD_TARGETS
}) => {
    const [trendPeriod, setTrendPeriod] = useState('monthly');
    const [milestoneTask, setMilestoneTask] = useState('Preedit');
    const [auditPage, setAuditPage] = useState(0);
    const auditPageSize = 5;

    // ── Trends Analysis & Calculations ──
    const getTrendIntervalKey = (dateStr, period) => {
        if (!dateStr) return 'Unknown';
        if (period === 'yearly') {
            return dateStr.substring(0, 4);
        }
        if (period === 'quarterly') {
            const year = dateStr.substring(0, 4);
            const month = parseInt(dateStr.substring(5, 7), 10);
            if (isNaN(month)) return `${year}-Q1`;
            const q = Math.floor((month - 1) / 3) + 1;
            return `${year}-Q${q}`;
        }
        return dateStr.substring(0, 7); // Default Monthly (YYYY-MM)
    };

    const chronologicalTrendData = useMemo(() => {
        const dataMap = {};
        filteredEntries.forEach(e => {
            const key = getTrendIntervalKey(e.date, trendPeriod);
            if (!dataMap[key]) {
                dataMap[key] = { totalTarget: 0, totalTime: 0, count: 0 };
            }
            dataMap[key].totalTarget += Number(getDynamicTargetAchieved(e) || 0);
            dataMap[key].totalTime += Number(e.timeAchieved || 0);
            dataMap[key].count += 1;
        });

        const sortedKeys = Object.keys(dataMap).sort((a, b) => a.localeCompare(b));

        return {
            labels: sortedKeys,
            targets: sortedKeys.map(k => (dataMap[k].totalTarget / dataMap[k].count).toFixed(2)),
            times: sortedKeys.map(k => (dataMap[k].totalTime / dataMap[k].count).toFixed(2))
        };
    }, [filteredEntries, trendPeriod, divisionTargets, getDynamicTargetAchieved]);

    const lineChartData = {
        labels: chronologicalTrendData.labels,
        datasets: [
            {
                label: 'Avg Target Achievement %',
                data: chronologicalTrendData.targets,
                borderColor: 'rgba(59, 130, 246, 1)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.3,
            },
            {
                label: 'Avg Time Efficiency %',
                data: chronologicalTrendData.times,
                borderColor: 'rgba(16, 185, 129, 1)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.3,
            }
        ]
    };

    // ── Overtime & Delay Calculations ──
    const overtimeData = useMemo(() => {
        const delayedLogs = filteredEntries
            .filter(e => Number(e.estimatedTime) > 0 && Number(e.takenTime) > Number(e.estimatedTime))
            .map(e => {
                const delay = Number(e.takenTime) - Number(e.estimatedTime);
                const delayPct = (delay / Number(e.estimatedTime)) * 100;
                return {
                    ...e,
                    delay,
                    delayPct: delayPct.toFixed(1)
                };
            })
            .sort((a, b) => b.delay - a.delay); // highest delay first
            
        const totalOvertimeLogs = delayedLogs.length;
        const totalDelayHours = delayedLogs.reduce((acc, curr) => acc + curr.delay, 0);
        const avgDelayPercent = totalOvertimeLogs > 0
            ? (delayedLogs.reduce((acc, curr) => acc + Number(curr.delayPct), 0) / totalOvertimeLogs)
            : 0;

        return {
            delayedLogs,
            totalOvertimeLogs,
            totalDelayHours: totalDelayHours.toFixed(1),
            avgDelayPercent: avgDelayPercent.toFixed(2)
        };
    }, [filteredEntries]);

    const bottleneckTasks = useMemo(() => {
        const taskGroup = {};
        overtimeData.delayedLogs.forEach(e => {
            if (!taskGroup[e.taskType]) {
                taskGroup[e.taskType] = { totalDelay: 0, delayPctSum: 0, count: 0 };
            }
            taskGroup[e.taskType].totalDelay += e.delay;
            taskGroup[e.taskType].delayPctSum += Number(e.delayPct);
            taskGroup[e.taskType].count += 1;
        });

        return Object.entries(taskGroup).map(([taskType, data]) => {
            const avgDelayPct = data.delayPctSum / data.count;
            const activeTarget = getDynamicTarget(taskType, userProfile?.client_id || 'DEFAULT_CLIENT', userProfile?.sub_division || 'PreEdit');
            
            // Correction Suggestion if average delay exceeds 20%
            const suggestedTarget = avgDelayPct > 20 && activeTarget > 0
                ? Math.round(activeTarget * (1 - (avgDelayPct / 100)))
                : null;

            return {
                taskType,
                avgDelayHours: (data.totalDelay / data.count).toFixed(1),
                avgDelayPercent: avgDelayPct.toFixed(1),
                count: data.count,
                currentTarget: activeTarget,
                suggestedTarget
            };
        }).sort((a, b) => b.avgDelayPercent - a.avgDelayPercent);
    }, [overtimeData.delayedLogs, divisionTargets, userProfile, getDynamicTarget]);

    // ── Milestone Pages vs Time Chart ──
    const uniqueTasks = useMemo(() => {
        return [...new Set(filteredEntries.map(e => e.taskType))].filter(Boolean);
    }, [filteredEntries]);

    useEffect(() => {
        if (uniqueTasks.length > 0 && !uniqueTasks.includes(milestoneTask)) {
            setMilestoneTask(uniqueTasks[0]);
        }
    }, [uniqueTasks, milestoneTask]);

    const milestoneChartData = useMemo(() => {
        const taskLogs = filteredEntries.filter(e => e.taskType === milestoneTask);
        const currentTarget = getDynamicTarget(milestoneTask, userProfile?.client_id || 'DEFAULT_CLIENT', userProfile?.sub_division || 'PreEdit');
        const targetRate = currentTarget / 8; // pages per hour

        const points = taskLogs.map(e => ({
            x: Number(e.takenTime),
            y: Number(e.completedPages),
            performerName: e.performerName,
            date: e.date
        }));

        const maxHours = Math.max(12, ...points.map(p => p.x), 8);
        const targetLine = [
            { x: 0, y: 0 },
            { x: maxHours, y: Number((targetRate * maxHours).toFixed(1)) }
        ];

        return {
            points,
            targetLine,
            currentTarget,
            targetRate
        };
    }, [filteredEntries, milestoneTask, divisionTargets, userProfile, getDynamicTarget]);

    const scatterChartData = {
        datasets: [
            {
                label: `${milestoneTask} Logs`,
                data: milestoneChartData.points,
                backgroundColor: 'rgba(59, 130, 246, 0.85)',
                borderColor: 'rgba(59, 130, 246, 1)',
                pointRadius: 6,
                pointHoverRadius: 8,
                showLine: false,
            },
            {
                label: `Target Milestone Rate (${milestoneChartData.currentTarget} pages/day)`,
                data: milestoneChartData.targetLine,
                borderColor: 'rgba(239, 68, 68, 1)',
                backgroundColor: 'rgba(239, 68, 68, 0)',
                borderWidth: 2,
                borderDash: [6, 4],
                fill: false,
                showLine: true,
                pointRadius: 0,
            }
        ]
    };

    const scatterChartOptions = {
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
            tooltip: {
                callbacks: {
                    label: (context) => {
                        const pt = context.raw;
                        if (pt.performerName) {
                            return `${pt.performerName} (${pt.date}): ${pt.y} pages in ${pt.x}h`;
                        }
                        return `Milestone: ${pt.y} pages in ${context.parsed.x}h`;
                    }
                }
            }
        },
        scales: {
            x: {
                type: 'linear',
                position: 'bottom',
                title: {
                    display: true,
                    text: 'Hours Spent (Time)',
                    font: { weight: 'black', size: 10 }
                },
                grid: { color: 'rgba(0,0,0,0.04)' }
            },
            y: {
                title: {
                    display: true,
                    text: 'Pages Completed',
                    font: { weight: 'black', size: 10 }
                },
                grid: { color: 'rgba(0,0,0,0.04)' },
                beginAtZero: true
            }
        }
    };

    // ── Paginated Audit Logs ──
    const paginatedAuditLogs = useMemo(() => {
        const start = auditPage * auditPageSize;
        return overtimeData.delayedLogs.slice(start, start + auditPageSize);
    }, [overtimeData.delayedLogs, auditPage]);

    const totalAuditPages = Math.ceil(overtimeData.delayedLogs.length / auditPageSize);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Interval Toggle Bar */}
            <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Calendar size={18} className="text-blue-600" />
                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">Trend Interval Configuration</span>
                </div>
                <div className="flex rounded-xl bg-white dark:bg-gray-900 p-1 border border-gray-200 dark:border-gray-700">
                    {['monthly', 'quarterly', 'yearly'].map((period) => (
                        <button
                            key={period}
                            type="button"
                            onClick={() => setTrendPeriod(period)}
                            className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${trendPeriod === period ? 'bg-blue-600 text-white' : 'text-gray-550'}`}
                        >
                            {period}
                        </button>
                    ))}
                </div>
            </div>

            {/* Double-Line Trend Chart */}
            <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-8">
                    Chronological Performance Trends ({trendPeriod} buckets)
                </h3>
                <div className="h-[300px]">
                    {chronologicalTrendData.labels.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-xs font-mono text-gray-400">No trend data points matching active filters</div>
                    ) : (
                        <Line
                            data={lineChartData}
                            options={{
                                maintainAspectRatio: false,
                                responsive: true,
                                plugins: { legend: { position: 'top', labels: { boxWidth: 12, usePointStyle: true, font: { weight: 'bold', size: 10 } } } },
                                scales: {
                                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                                    x: { grid: { display: false } }
                                }
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Delay & Overtime Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-2xl text-red-600">
                            <Clock size={22} />
                        </div>
                        <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded-md">Overtime logs</span>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Total Overtime Logs</p>
                    <p className="text-3xl font-black text-red-500">{overtimeData.totalOvertimeLogs}</p>
                </div>

                <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-2xl text-amber-600">
                            <Clock size={22} />
                        </div>
                        <span className="text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-md">Accumulated delay</span>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Total Delay Hours</p>
                    <p className="text-3xl font-black text-amber-500">{overtimeData.totalDelayHours} h</p>
                </div>

                <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-rose-50 dark:bg-rose-900/30 rounded-2xl text-rose-600">
                            <TrendingUp size={22} />
                        </div>
                        <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded-md">Avg delay percent</span>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Average Delay %</p>
                    <p className="text-3xl font-black text-rose-500">{overtimeData.avgDelayPercent}%</p>
                </div>
            </div>

            {/* Bottlenecks List & Suggestions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Delay Bottlenecks */}
                <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-6 flex items-center justify-between">
                        <span>Process Delay Bottlenecks</span>
                        <AlertTriangle className="text-red-500" size={16} />
                    </h3>
                    <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800/80 flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 dark:bg-gray-850/50 border-b border-gray-100 dark:border-gray-800">
                                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Process Type</th>
                                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-center">Delayed Logs</th>
                                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-center">Avg Delay</th>
                                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Target Correction</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {bottleneckTasks.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-xs italic text-gray-400">No process bottleneck logs identified</td>
                                    </tr>
                                ) : (
                                    bottleneckTasks.map((row) => (
                                        <tr key={row.taskType} className="hover:bg-gray-50/50 dark:hover:bg-gray-850/50 transition-colors">
                                            <td className="p-4 font-bold text-sm text-gray-900 dark:text-white">{row.taskType}</td>
                                            <td className="p-4 text-sm text-gray-600 dark:text-gray-400 text-center font-semibold font-mono">{row.count}</td>
                                            <td className="p-4 text-sm text-red-500 text-center font-bold font-mono">+{row.avgDelayPercent}%</td>
                                            <td className="p-4 text-sm font-semibold text-right font-mono">
                                                {row.suggestedTarget ? (
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-gray-400 line-through text-xs">{row.currentTarget} /d</span>
                                                        <span className="text-green-600 dark:text-green-400 font-bold">{row.suggestedTarget} /d</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 text-xs">No modification</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Milestone Pages vs Time Chart */}
                <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
                            Pages vs Time Milestone Chart
                        </h3>
                        <select
                            value={milestoneTask}
                            onChange={e => setMilestoneTask(e.target.value)}
                            className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 rounded-xl text-[10px] font-black uppercase tracking-wider focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                            {uniqueTasks.map(t => (
                                <option key={t} value={t}>{t.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>
                    <div className="h-[280px] flex-1">
                        {milestoneChartData.points.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-xs font-mono text-gray-400">No logs for {milestoneTask} to plot</div>
                        ) : (
                            <Line
                                data={scatterChartData}
                                options={scatterChartOptions}
                            />
                        )}
                    </div>
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-855 rounded-xl text-[10px] text-gray-500 font-mono leading-relaxed border border-gray-100 dark:border-gray-800">
                        <span className="text-red-500 font-bold">Dashed Line</span> represents target rate milestone ({milestoneChartData.currentTarget} pages per 8h). Points above the line exceeded target; points below took longer than target rate.
                    </div>
                </div>
            </div>

            {/* Overtime Audit Logs */}
            <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-6 flex justify-between items-center">
                    <span>Overtime Log Audit Table</span>
                    <span className="text-[10px] text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/30 px-3 py-1 rounded-full uppercase">Delay Audit</span>
                </h3>
                <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800/80">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-855/50 border-b border-gray-100 dark:border-gray-800">
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Date</th>
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Performer</th>
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Process Type</th>
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-center">Estimated</th>
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-center">Taken Time</th>
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-center">Delay</th>
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Delay %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-150 dark:divide-gray-800">
                            {paginatedAuditLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-xs italic text-gray-400">No delayed entries located</td>
                                </tr>
                            ) : (
                                paginatedAuditLogs.map((row) => (
                                    <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-850/50 transition-colors">
                                        <td className="p-4 font-semibold text-xs text-gray-500 dark:text-gray-400 font-mono">{row.date}</td>
                                        <td className="p-4 font-bold text-sm text-gray-900 dark:text-white uppercase">{row.performerName}</td>
                                        <td className="p-4 font-semibold text-xs text-gray-700 dark:text-gray-300">{row.taskType}</td>
                                        <td className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center font-mono">{row.estimatedTime}h</td>
                                        <td className="p-4 text-sm text-gray-900 dark:text-white text-center font-bold font-mono">{row.takenTime}h</td>
                                        <td className="p-4 text-sm text-red-500 text-center font-black font-mono">+{row.delay.toFixed(1)}h</td>
                                        <td className="p-4 text-sm font-black text-right text-red-500 font-mono">+{row.delayPct}%</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination controls */}
                {totalAuditPages > 1 && (
                    <div className="flex items-center justify-between mt-6">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            Page {auditPage + 1} of {totalAuditPages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                disabled={auditPage === 0}
                                onClick={() => setAuditPage(prev => prev - 1)}
                                className="p-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-500 disabled:opacity-50 rounded-xl transition-all"
                                aria-label="Previous page"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                disabled={auditPage >= totalAuditPages - 1}
                                onClick={() => setAuditPage(prev => prev + 1)}
                                className="p-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-500 disabled:opacity-50 rounded-xl transition-all"
                                aria-label="Next page"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrendsDashboard;
