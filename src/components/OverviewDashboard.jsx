import React from 'react';
import { 
    Chart as ChartJS, 
    CategoryScale, 
    LinearScale, 
    BarElement, 
    ArcElement, 
    Title, 
    Tooltip, 
    Legend 
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { Target, Clock, Users, TrendingUp, Trophy } from 'lucide-react';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

const OverviewDashboard = ({
    filteredEntries,
    avgTargetAchieved,
    avgTimeEfficiency,
    userRank,
    role,
    isPerformer,
    isLead,
    isAdmin,
    groupBy,
    groupedData,
    barData,
    pieData
}) => {
    const totalEntries = filteredEntries.length;

    return (
        <React.Fragment>
            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl text-blue-600">
                            <Target size={24} />
                        </div>
                        {role === 'performer' && userRank > 0 && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg text-[10px] font-black underline decoration-2">
                                <Trophy size={14} /> RANK #{userRank}
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Target Achievement</p>
                    <p className="text-3xl font-black">{avgTargetAchieved}%</p>
                </div>

                <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-2xl text-green-600">
                            <Clock size={24} />
                        </div>
                        <div className="text-[10px] font-black text-green-600 px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded-lg uppercase">System Sync</div>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Time Efficiency</p>
                    <p className="text-3xl font-black">{avgTimeEfficiency}%</p>
                </div>

                <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-2xl text-purple-600">
                            <Users size={24} />
                        </div>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Scale Group</p>
                    <p className="text-3xl font-black">
                        {isPerformer ? 'Personal' : (isLead ? 'Team' : (isAdmin ? 'Organization' : 'Multi-Team'))}
                    </p>
                </div>

                <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-2xl text-amber-600">
                            <TrendingUp size={24} />
                        </div>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Total Logs Count</p>
                    <p className="text-3xl font-black">{totalEntries}</p>
                </div>
            </div>

            {/* ── Charts Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-8 flex items-center gap-2">
                        Performance Comparison ({groupBy.replace('_', ' ')} breakdown)
                    </h3>
                    <div className="h-[300px]">
                        <Bar
                            data={barData}
                            options={{
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: {
                                    y: { beginAtZero: true, max: 120, grid: { color: 'rgba(0,0,0,0.05)' } },
                                    x: { grid: { display: false } }
                                }
                            }}
                        />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-8">Process Breakdown</h3>
                    <div className="aspect-square max-h-[300px] mx-auto">
                        <Pie
                            data={pieData}
                            options={{
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, font: { size: 10, weight: 'bold' } } }
                                }
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* ── Detailed Performance Breakdown Report Table ── */}
            <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-6 flex justify-between items-center">
                    <span>Performance Breakdown ({groupBy.replace('_', ' ')} report)</span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full uppercase">Overall Data</span>
                </h3>
                <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800/80">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-850/50 border-b border-gray-100 dark:border-gray-800">
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">{groupBy.replace('_', ' ')} Name</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Total Logs</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Completed Tasks (Pages)</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Total Hours</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Avg Target Achievement</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Avg Time Efficiency</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-150 dark:divide-gray-800">
                            {groupedData.map((row) => (
                                <tr key={row.name} className="hover:bg-gray-50/50 dark:hover:bg-gray-850/50 transition-colors">
                                    <td className="p-4 font-bold text-sm text-gray-900 dark:text-white uppercase">{row.name}</td>
                                    <td className="p-4 text-sm text-gray-600 dark:text-gray-400 text-center font-semibold font-mono">{row.count}</td>
                                    <td className="p-4 text-sm text-gray-600 dark:text-gray-400 text-center font-semibold font-mono">{row.completedPages}</td>
                                    <td className="p-4 text-sm text-gray-600 dark:text-gray-400 text-center font-semibold font-mono">{row.takenTime}h</td>
                                    <td className={`p-4 text-sm font-black text-right font-mono ${Number(row.avgTarget) >= 100 ? 'text-green-600' : 'text-amber-500'}`}>{row.avgTarget}%</td>
                                    <td className="p-4 text-sm font-black text-right text-indigo-500 font-mono">{row.avgTime}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </React.Fragment>
    );
};

export default OverviewDashboard;
