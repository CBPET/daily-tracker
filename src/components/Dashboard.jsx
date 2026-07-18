import React, { useState, useMemo, useEffect } from 'react';
import { Filter, Calendar } from 'lucide-react';
import DataExport from './DataExport';
import OverviewDashboard from './OverviewDashboard';
import TrendsDashboard from './TrendsDashboard';
import DivisionTargetsManager from './DivisionTargetsManager';
import PerformanceRating from './PerformanceRating';
import EnterpriseAnalytics from './enterpriseAnalytics/EnterpriseAnalytics';
import { isBehaviourAnalyticsEnabled } from '../lib/featureFlags';
import { canViewBehaviourAnalytics } from '../lib/permissions';

const STANDARD_TARGETS = {
    Prestyle: 900,
    Preedit: 300,
    'FL Validation': 600,
    'FP Validation': 600,
    'Revises Validation': 1200,
    Normalisation: 300,
    'Cast-off XML Conversion': 4,
    'Ref Edit': 400,
    'Style Editing': 80,
};

const Dashboard = ({
    entries,
    userProfile,
    clients = [],
    divisionTargets = [],
    onRefreshTargets,
    supabase,
    accessibleProfiles = [],
    analyticsDeepLink = null,
    onDeepLinkConsumed,
}) => {
    const [selectedPerformer, setSelectedPerformer] = useState('all');
    const [selectedClient, setSelectedClient] = useState(() => analyticsDeepLink?.client || 'all');
    const [viewMode, setViewMode] = useState('team');
    const [groupBy, setGroupBy] = useState(() => {
        if (['manager', 'general_manager', 'super_admin'].includes(userProfile?.role)) return 'client';
        if (['lead', 'team_lead', 'group_lead'].includes(userProfile?.role)) return 'performer';
        return 'task_type';
    });

    // Sub-tab navigation
    const [analyticsSubTab, setAnalyticsSubTab] = useState(() =>
        analyticsDeepLink?.tab === 'ratings'
            ? 'ratings'
            : analyticsDeepLink?.tab === 'behaviour'
              ? 'behaviour'
              : 'overview'
    );
    const [ratingDeepLink, setRatingDeepLink] = useState(analyticsDeepLink);

    useEffect(() => {
        if (!analyticsDeepLink) return;
        if (analyticsDeepLink.tab === 'ratings') {
            setAnalyticsSubTab('ratings');
            setRatingDeepLink(analyticsDeepLink);
            if (analyticsDeepLink.client) setSelectedClient(analyticsDeepLink.client);
        } else if (analyticsDeepLink.tab === 'behaviour') {
            setAnalyticsSubTab('behaviour');
        }
        if (typeof onDeepLinkConsumed === 'function') onDeepLinkConsumed();
    }, [analyticsDeepLink, onDeepLinkConsumed]);

    // Normalize roles
    const rawRole = userProfile?.role || 'performer';
    const isAdmin = ['admin', 'super_admin', 'general_manager'].includes(rawRole);
    const isManager = ['manager', 'general_manager', 'super_admin'].includes(rawRole);
    const isLead = ['lead', 'team_lead', 'group_lead'].includes(rawRole);
    const isPerformer = rawRole === 'performer';
    const role = rawRole;

    // ── Helper: Dynamic Targets ──
    const getDynamicTarget = (task, clientCode, subDiv) => {
        const custom = (divisionTargets || []).find(t => 
            t.client_id === clientCode && 
            t.sub_division === subDiv && 
            t.task_type === task
        );
        if (custom) return Number(custom.target_value);
        return STANDARD_TARGETS[task] || 0;
    };

    const getDynamicTargetAchieved = (e) => {
        const target = getDynamicTarget(e.taskType, e.client_id, e.sub_division);
        if (target > 0 && Number(e.takenTime) > 0) {
            return Number(((Number(e.completedPages) / ((target / 8) * Number(e.takenTime))) * 100).toFixed(2));
        }
        return 0;
    };

    // ── Helper: Filters ──
    const filteredEntries = useMemo(() => {
        let result = [...entries];
        
        // Scope leads and performers to their respective client only
        if (!isManager && userProfile?.client_id) {
            result = result.filter(e => e.client_id === userProfile.client_id);
        }
        
        if (isManager && viewMode === 'individual' && selectedPerformer !== 'all') {
            result = result.filter(e => e.performerName === selectedPerformer);
        } else if (!isManager && selectedPerformer !== 'all') {
            result = result.filter(e => e.performerName === selectedPerformer);
        }
        
        // Only managers can filter by any client
        if (isManager && selectedClient !== 'all') {
            result = result.filter(e => e.client_id === selectedClient);
        }
        
        return result;
    }, [entries, selectedPerformer, selectedClient, isManager, viewMode, userProfile]);

    // ── Stats Calculation ──
    const totalEntries = filteredEntries.length;
    const avgTargetAchieved = totalEntries > 0 
        ? (filteredEntries.reduce((acc, curr) => acc + Number(getDynamicTargetAchieved(curr)), 0) / totalEntries).toFixed(2) 
        : 0;
    const avgTimeEfficiency = totalEntries > 0 
        ? (filteredEntries.reduce((acc, curr) => acc + Number(curr.timeAchieved), 0) / totalEntries).toFixed(2) 
        : 0;

    // Performer Score & Rank (Current Month)
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const monthEntries = entries.filter(e => e.date.startsWith(currentMonth));

    const performanceScores = {}; // performerName -> avgTarget
    monthEntries.forEach(e => {
        if (!performanceScores[e.performerName]) performanceScores[e.performerName] = { total: 0, count: 0 };
        performanceScores[e.performerName].total += Number(getDynamicTargetAchieved(e));
        performanceScores[e.performerName].count += 1;
    });

    const rankings = Object.keys(performanceScores)
        .map(name => ({ name, score: (performanceScores[name].total / performanceScores[name].count).toFixed(2) }))
        .sort((a, b) => b.score - a.score);

    const userRank = rankings.findIndex(r => r.name === userProfile?.performer_name) + 1;

    // ── Chart Data Preparations ──
    const groupField = useMemo(() => {
        if (groupBy === 'client') return 'client_id';
        if (groupBy === 'sub_division') return 'sub_division';
        if (groupBy === 'performer') return 'performerName';
        return 'taskType';
    }, [groupBy]);

    const groupedData = useMemo(() => {
        const dataMap = {};
        filteredEntries.forEach(e => {
            const key = e[groupField] || (groupField === 'sub_division' ? 'General' : 'Unknown');
            if (!dataMap[key]) {
                dataMap[key] = { 
                    totalTarget: 0, 
                    totalTime: 0, 
                    count: 0, 
                    completedPages: 0,
                    estimatedTime: 0,
                    takenTime: 0
                };
            }
            dataMap[key].totalTarget += Number(getDynamicTargetAchieved(e) || 0);
            dataMap[key].totalTime += Number(e.timeAchieved || 0);
            dataMap[key].count += 1;
            dataMap[key].completedPages += Number(e.completedPages || 0);
            dataMap[key].estimatedTime += Number(e.estimatedTime || 0);
            dataMap[key].takenTime += Number(e.takenTime || 0);
        });

        return Object.entries(dataMap).map(([key, data]) => ({
            name: key,
            count: data.count,
            avgTarget: (data.totalTarget / data.count).toFixed(2),
            avgTime: (data.totalTime / data.count).toFixed(2),
            completedPages: data.completedPages,
            estimatedTime: data.estimatedTime.toFixed(1),
            takenTime: data.takenTime.toFixed(1)
        })).sort((a, b) => b.avgTarget - a.avgTarget);
    }, [filteredEntries, groupField, divisionTargets]);

    const barData = {
        labels: groupedData.map(g => g.name),
        datasets: [{
            label: 'Avg Achievement %',
            data: groupedData.map(g => g.avgTarget),
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            borderRadius: 8,
        }]
    };

    const taskTypes = {};
    filteredEntries.forEach(e => {
        taskTypes[e.taskType] = (taskTypes[e.taskType] || 0) + 1;
    });

    const pieData = {
        labels: Object.keys(taskTypes),
        datasets: [{
            data: Object.values(taskTypes),
            backgroundColor: [
                'rgba(59, 130, 246, 0.7)',
                'rgba(147, 51, 234, 0.7)',
                'rgba(236, 72, 153, 0.7)',
                'rgba(249, 115, 22, 0.7)',
                'rgba(34, 197, 94, 0.7)',
            ],
            borderWidth: 0,
        }]
    };

    // ── Early return: no data (placed AFTER all hooks to avoid React error #310) ──
    if (!entries || entries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 dark:bg-gray-800/30 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                <Calendar className="w-12 h-12 text-gray-300 mb-4" />
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">System Ready • No Analytical Data</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* ── Analytics Sub-Tab Navigation ── */}
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-150 dark:border-gray-800 pb-4">
                <div className="flex rounded-xl bg-white dark:bg-gray-900 p-1 border border-gray-200 dark:border-gray-700">
                    <button
                        type="button"
                        onClick={() => setAnalyticsSubTab('overview')}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${analyticsSubTab === 'overview' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-550 hover:text-gray-900 dark:hover:text-gray-300'}`}
                    >
                        Overview
                    </button>
                    <button
                        type="button"
                        onClick={() => setAnalyticsSubTab('trends')}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${analyticsSubTab === 'trends' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-550 hover:text-gray-900 dark:hover:text-gray-300'}`}
                    >
                        Trends & Bottlenecks
                    </button>
                    {['super_admin', 'general_manager', 'manager', 'team_lead', 'group_lead'].includes(userProfile?.role) && (
                        <button
                            type="button"
                            onClick={() => setAnalyticsSubTab('targets')}
                            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${analyticsSubTab === 'targets' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-550 hover:text-gray-900 dark:hover:text-gray-300'}`}
                        >
                            Division Targets
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setAnalyticsSubTab('ratings')}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${analyticsSubTab === 'ratings' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-550 hover:text-gray-900 dark:hover:text-gray-300'}`}
                    >
                        Performance Rating
                    </button>
                    {isBehaviourAnalyticsEnabled() && canViewBehaviourAnalytics(userProfile?.role) && (
                        <button
                            type="button"
                            onClick={() => setAnalyticsSubTab('behaviour')}
                            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${analyticsSubTab === 'behaviour' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-550 hover:text-gray-900 dark:hover:text-gray-300'}`}
                        >
                            Behaviour Intelligence
                        </button>
                    )}
                </div>
            </div>

            {/* Filters Bar (Common to overview/trends; ratings has its own controls) */}
            {analyticsSubTab !== 'targets' && analyticsSubTab !== 'ratings' && analyticsSubTab !== 'behaviour' && !isPerformer && (
                <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-800/80 flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-3">
                        <Filter size={18} className="text-blue-600" />
                        <span className="text-xs font-black uppercase tracking-widest text-gray-500">Filters</span>
                    </div>

                    {(isAdmin || isManager) && (
                        <div className="flex-1 min-w-[200px]">
                            <select
                                value={selectedClient}
                                onChange={e => setSelectedClient(e.target.value)}
                                className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-xs font-bold font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="all">ALL CLIENTS</option>
                                {clients && clients.length > 0 ? (
                                    clients.map(c => <option key={c.id} value={c.code}>{c.code}</option>)
                                ) : (
                                    [...new Set(entries.map(e => e.client_id))].map(c => <option key={c} value={c}>{c}</option>)
                                )}
                            </select>
                        </div>
                    )}

                    {isManager && (
                        <div className="flex rounded-xl bg-white dark:bg-gray-900 p-1 border border-gray-200 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => { setViewMode('team'); setSelectedPerformer('all'); }}
                                className={`px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${viewMode === 'team' ? 'bg-blue-600 text-white' : 'text-gray-550'}`}
                            >
                                Team Performance
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('individual')}
                                className={`px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${viewMode === 'individual' ? 'bg-blue-600 text-white' : 'text-gray-550'}`}
                            >
                                Individual
                            </button>
                        </div>
                    )}

                    {(!isManager || viewMode === 'individual' || isLead) && (
                        <div className="flex-1 min-w-[200px]">
                            <select
                                value={selectedPerformer}
                                onChange={e => setSelectedPerformer(e.target.value)}
                                className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-xs font-bold font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="all">{isLead ? 'ALL TEAMMATES' : 'ALL PERFORMERS'}</option>
                                {[...new Set(entries.map(e => e.performerName))].map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    )}

                    {(isManager || isLead) && (
                        <div className="flex-1 min-w-[150px]">
                            <select
                                value={groupBy}
                                onChange={e => setGroupBy(e.target.value)}
                                className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-xs font-bold font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                {isManager && <option value="client">GROUP BY: CLIENT</option>}
                                {(isManager || isLead) && <option value="sub_division">GROUP BY: SUB-DIVISION</option>}
                                {(isManager || isLead) && <option value="performer">GROUP BY: PERFORMER</option>}
                                <option value="task_type">GROUP BY: PROCESS</option>
                            </select>
                        </div>
                    )}

                    <div className="flex-1 min-w-[280px] flex justify-end">
                        <DataExport 
                            entries={entries} 
                            filteredEntries={filteredEntries} 
                            label="Export" 
                        />
                    </div>
                </div>
            )}

            {/* Render subcomponents based on selected tab */}
            {analyticsSubTab === 'overview' && (
                <OverviewDashboard
                    filteredEntries={filteredEntries}
                    avgTargetAchieved={avgTargetAchieved}
                    avgTimeEfficiency={avgTimeEfficiency}
                    userRank={userRank}
                    role={role}
                    isPerformer={isPerformer}
                    isLead={isLead}
                    isAdmin={isAdmin}
                    groupBy={groupBy}
                    groupedData={groupedData}
                    barData={barData}
                    pieData={pieData}
                />
            )}

            {analyticsSubTab === 'trends' && (
                <TrendsDashboard
                    filteredEntries={filteredEntries}
                    userProfile={userProfile}
                    divisionTargets={divisionTargets}
                    getDynamicTarget={getDynamicTarget}
                    getDynamicTargetAchieved={getDynamicTargetAchieved}
                    STANDARD_TARGETS={STANDARD_TARGETS}
                />
            )}

            {analyticsSubTab === 'targets' && ['super_admin', 'general_manager', 'manager', 'team_lead', 'group_lead'].includes(userProfile?.role) && (
                <DivisionTargetsManager
                    userProfile={userProfile}
                    clients={clients}
                    divisionTargets={divisionTargets}
                    onRefreshTargets={onRefreshTargets}
                    supabase={supabase}
                    isManager={isManager}
                />
            )}

            {analyticsSubTab === 'ratings' && (
                <PerformanceRating
                    entries={entries}
                    filteredEntries={filteredEntries}
                    userProfile={userProfile}
                    accessibleProfiles={accessibleProfiles.length ? accessibleProfiles : (userProfile ? [userProfile] : [])}
                    clients={clients}
                    initialFilters={{
                        client: ratingDeepLink?.client || (selectedClient !== 'all' ? selectedClient : null),
                        division: ratingDeepLink?.division || null,
                        period: ratingDeepLink?.period || null,
                        start: ratingDeepLink?.start || null,
                        end: ratingDeepLink?.end || null,
                        groupBy: ratingDeepLink?.groupBy || 'individual',
                    }}
                    onFiltersApplied={() => setRatingDeepLink(null)}
                />
            )}

            {analyticsSubTab === 'behaviour' && isBehaviourAnalyticsEnabled() && canViewBehaviourAnalytics(userProfile?.role) && (
                <EnterpriseAnalytics
                    userProfile={userProfile}
                    entries={entries}
                    accessibleProfiles={accessibleProfiles.length ? accessibleProfiles : (userProfile ? [userProfile] : [])}
                    clients={clients}
                    onToast={(msg) => {
                        if (typeof window !== 'undefined') {
                            // Lightweight fallback if App toast not plumbed
                            console.info(msg);
                        }
                    }}
                />
            )}
        </div>
    );
};

export default Dashboard;
