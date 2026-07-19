import React, { useEffect, useMemo, useState } from 'react';
import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    Title,
    Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Loader2 } from 'lucide-react';
import {
    PERIOD_OPTIONS,
    computeScheduleKpis,
    effectiveDueDate,
    filterTasksByKpi,
    reasonBreakdown,
} from '../../lib/projects/projectScheduleMetrics';
import { dashboardRoleTier } from '../../lib/projects/projectScheduleScope';
import { fetchScheduleEvents, reasonLabel } from '../../lib/projects/projectScheduleEvents';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const KPI_DEFS = [
    { key: 'ontime', label: 'Ontime', leadOnly: true },
    { key: 'ahead', label: 'Ahead', leadOnly: true },
    { key: 'delay', label: 'Delay', leadOnly: true },
    { key: 'todayDue', label: 'Today Due', leadOnly: false },
    { key: 'longDelay', label: 'Long Delay', leadOnly: false },
    { key: 'delivery', label: 'Delivery', leadOnly: false },
];

function formatDisplayDate(value) {
    if (!value) return '-';
    return String(value).slice(0, 10);
}

export default function ProjectScheduleDashboard({
    supabase,
    profile,
    projects,
    scheduleTasks,
    loading,
}) {
    const tier = dashboardRoleTier(profile);
    const [periodKey, setPeriodKey] = useState('month');
    const [activeKpi, setActiveKpi] = useState(tier === 'performer' ? 'todayDue' : 'ontime');
    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(false);

    const visibleKpis = KPI_DEFS.filter((item) => tier !== 'performer' || !item.leadOnly);

    const kpis = useMemo(
        () => computeScheduleKpis(scheduleTasks, { periodKey }),
        [scheduleTasks, periodKey]
    );

    const filteredTasks = useMemo(
        () => filterTasksByKpi(scheduleTasks, activeKpi, { periodKey }),
        [scheduleTasks, activeKpi, periodKey]
    );

    const projectById = useMemo(() => {
        return (projects || []).reduce((acc, project) => {
            acc[project.id] = project;
            return acc;
        }, {});
    }, [projects]);

    useEffect(() => {
        if (!supabase || tier === 'performer') return;
        let cancelled = false;
        (async () => {
            setEventsLoading(true);
            try {
                const rows = await fetchScheduleEvents(supabase, { limit: 200 });
                if (!cancelled) setEvents(rows);
            } catch {
                if (!cancelled) setEvents([]);
            } finally {
                if (!cancelled) setEventsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [supabase, tier]);

    const reasonCounts = useMemo(() => reasonBreakdown(events), [events]);

    const chartData = useMemo(() => {
        if (tier === 'performer') {
            return {
                labels: ['Today Due', 'Long Delay', 'Delivery'],
                datasets: [{
                    label: 'Count',
                    data: [kpis.counts.todayDue, kpis.counts.longDelay, kpis.counts.delivery],
                    backgroundColor: ['#4f46e5', '#dc2626', '#16a34a'],
                }],
            };
        }
        return {
            labels: ['Ontime', 'Ahead', 'Delay', 'Today Due', 'Long Delay', 'Delivery'],
            datasets: [{
                label: 'Count',
                data: [
                    kpis.counts.ontime,
                    kpis.counts.ahead,
                    kpis.counts.delay,
                    kpis.counts.todayDue,
                    kpis.counts.longDelay,
                    kpis.counts.delivery,
                ],
                backgroundColor: ['#16a34a', '#2563eb', '#dc2626', '#4f46e5', '#b45309', '#0d9488'],
            }],
        };
    }, [kpis, tier]);

    const reasonChart = useMemo(() => {
        const labels = Object.keys(reasonCounts);
        return {
            labels: labels.map(reasonLabel),
            datasets: [{
                label: 'Date change reasons',
                data: labels.map((key) => reasonCounts[key]),
                backgroundColor: '#6366f1',
            }],
        };
    }, [reasonCounts]);

    if (loading) {
        return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-indigo-600" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">Project Schedule Dashboard</h3>
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                        {tier === 'performer' ? 'My assigned tasks' : tier === 'lead' ? 'Team / lead scope' : 'All visible projects'}
                        {' · '}
                        {kpis.window.start} → {kpis.window.end}
                    </p>
                </div>
                <select
                    value={periodKey}
                    onChange={(event) => setPeriodKey(event.target.value)}
                    className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-black uppercase tracking-widest"
                >
                    {PERIOD_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>{option.label}</option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {visibleKpis.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        onClick={() => setActiveKpi(item.key)}
                        className={`rounded-2xl border p-4 text-left transition ${
                            activeKpi === item.key
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
                                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
                        }`}
                    >
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">{item.label}</div>
                        <div className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
                            {kpis.counts[item.key] ?? 0}
                        </div>
                    </button>
                ))}
            </div>

            <div className={`grid grid-cols-1 ${tier === 'manager' ? 'xl:grid-cols-2' : ''} gap-4`}>
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">KPI chart</h4>
                    <div className="h-56">
                        <Bar
                            data={chartData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                            }}
                        />
                    </div>
                </div>
                {tier === 'manager' ? (
                    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">
                            Date-change reasons {eventsLoading ? '(loading…)' : ''}
                        </h4>
                        <div className="h-56">
                            {Object.keys(reasonCounts).length ? (
                                <Bar
                                    data={reasonChart}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: { legend: { display: false } },
                                        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                                    }}
                                />
                            ) : (
                                <p className="text-sm font-semibold text-gray-500 py-12 text-center">No date-change events yet</p>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                    <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">
                        {visibleKpis.find((item) => item.key === activeKpi)?.label || activeKpi} · {filteredTasks.length} task(s)
                    </h4>
                </div>
                <div className="overflow-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Project</th>
                                <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Stage</th>
                                <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Effective Due</th>
                                <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {filteredTasks.length ? filteredTasks.map((task) => {
                                const project = projectById[task.project_id];
                                return (
                                    <tr key={task.id}>
                                        <td className="p-3 font-bold text-gray-900 dark:text-white">{project?.title || task.project_id}</td>
                                        <td className="p-3 font-semibold text-gray-600 dark:text-gray-300">{task.stage_order}. {task.workflow_stage}</td>
                                        <td className="p-3 font-semibold text-gray-600 dark:text-gray-300">{formatDisplayDate(effectiveDueDate(task))}</td>
                                        <td className="p-3 text-xs font-black uppercase tracking-widest text-gray-500">{task.allocation_status}</td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={4} className="p-6 text-center text-sm font-semibold text-gray-500">No tasks in this bucket</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
