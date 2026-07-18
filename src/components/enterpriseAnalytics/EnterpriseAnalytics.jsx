import { useEffect, useMemo, useState } from 'react';
import {
  buildHeatmapCells,
  computeLiveBehaviourForUser,
  getDelayedRequestHubTickets,
  getRequestHubContributionMetrics,
  teamHealthScore,
} from '../../lib/enterpriseAnalytics/analyticsService';
import {
  isBehaviourAnalyticsEnabled,
  isFeedbackModuleEnabled,
  isSuperAdminGovernanceEnabled,
} from '../../lib/featureFlags';
import {
  canUseGovernance,
  canViewBehaviourAnalytics,
  canViewFeedback,
} from '../../lib/permissions';
import { getLocalISODate } from '../../lib/targetUtils';
import BehaviourDashboard from './BehaviourDashboard';
import ManagerDashboard from './ManagerDashboard';
import Leaderboards from './Leaderboards';
import HeatmapPanel from './HeatmapPanel';
import FeedbackModule from './FeedbackModule';
import SuperAdminGovernance from './SuperAdminGovernance';

function defaultPeriod() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 27);
  return { start: getLocalISODate(start), end: getLocalISODate(end) };
}

export default function EnterpriseAnalytics({
  userProfile,
  entries = [],
  accessibleProfiles = [],
  clients = [],
  onToast,
}) {
  const role = userProfile?.role;
  const [innerTab, setInnerTab] = useState('behaviour');
  const [period] = useState(defaultPeriod);
  const [scoresByUser, setScoresByUser] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [delayedTickets, setDelayedTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const profileNameById = useMemo(() => {
    const map = {};
    for (const p of accessibleProfiles) {
      map[p.id] = p.performer_name || p.email || p.id;
    }
    return map;
  }, [accessibleProfiles]);

  const scopedProfiles = useMemo(() => {
    if (['super_admin', 'general_manager', 'manager'].includes(role)) return accessibleProfiles;
    return accessibleProfiles;
  }, [accessibleProfiles, role]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const userIds = scopedProfiles.length
          ? scopedProfiles.map((p) => p.id)
          : userProfile?.id
            ? [userProfile.id]
            : [];

        const periodEntries = entries.filter((e) => {
          const d = String(e.date || '').slice(0, 10);
          return d >= period.start && d <= period.end;
        });

        const scores = [];
        for (const uid of userIds) {
          const s = await computeLiveBehaviourForUser(uid, period.start, period.end, periodEntries);
          scores.push({ user_id: uid, ...s });
        }
        if (cancelled) return;
        setScoresByUser(scores);

        try {
          setContributions(await getRequestHubContributionMetrics({ start: period.start, end: period.end }));
          setDelayedTickets(await getDelayedRequestHubTickets({ olderThanDays: 7 }));
        } catch {
          setContributions([]);
          setDelayedTickets([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entries, scopedProfiles, userProfile, period.start, period.end]);

  const inactiveUsers = useMemo(() => {
    const active = new Set(
      entries
        .filter((e) => {
          const d = String(e.date || '').slice(0, 10);
          return d >= period.start && d <= period.end;
        })
        .map((e) => e.user_id)
        .filter(Boolean)
    );
    return scopedProfiles.map((p) => p.id).filter((id) => !active.has(id));
  }, [entries, scopedProfiles, period]);

  const missedLate = useMemo(
    () => scoresByUser.filter((s) => (s.missed_entries || 0) > 0 || (s.late_entries || 0) > 2),
    [scoresByUser]
  );

  const health = useMemo(() => {
    const avg =
      scoresByUser.length
        ? scoresByUser.reduce((a, s) => a + Number(s.overall_score || 0), 0) / scoresByUser.length
        : 0;
    const resolved = contributions.reduce((a, c) => a + (c.resolved || 0), 0);
    const total = contributions.reduce((a, c) => a + (c.total || 0), 0) || 1;
    const coverage =
      scopedProfiles.length
        ? ((scopedProfiles.length - inactiveUsers.length) / scopedProfiles.length) * 100
        : 0;
    return teamHealthScore({
      avgBehaviour: avg,
      resolutionHealth: (resolved / total) * 100,
      entryCoverage: coverage,
    });
  }, [scoresByUser, contributions, inactiveUsers, scopedProfiles]);

  const heatmap = useMemo(() => buildHeatmapCells(entries, 'taskType'), [entries]);

  const tabs = [
    { id: 'behaviour', label: 'Behaviour', show: canViewBehaviourAnalytics(role) },
    { id: 'manager', label: 'Manager', show: canViewBehaviourAnalytics(role) },
    { id: 'leaderboards', label: 'Leaderboards', show: canViewBehaviourAnalytics(role) },
    { id: 'heatmap', label: 'Heatmap', show: canViewBehaviourAnalytics(role) },
    { id: 'feedback', label: 'Feedback', show: isFeedbackModuleEnabled() && canViewFeedback(role) },
    {
      id: 'governance',
      label: 'Governance',
      show: isSuperAdminGovernanceEnabled() && canUseGovernance(role),
    },
  ].filter((t) => t.show);

  if (!isBehaviourAnalyticsEnabled() && !tabs.length) {
    return (
      <p className="text-sm text-gray-500 font-semibold py-8 text-center">
        Behaviour Intelligence is disabled. Set VITE_ENABLE_BEHAVIOUR_ANALYTICS=true after applying Phase 3 SQL.
      </p>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h3 className="text-lg font-black">Behaviour Intelligence</h3>
        <p className="text-xs text-gray-500 font-semibold mt-1">
          Period {period.start} → {period.end} · Distinct from Performance Rating
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setInnerTab(t.id)}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
              innerTab === t.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500 font-semibold">Loading…</p>}

      {!loading && innerTab === 'behaviour' && (
        <BehaviourDashboard scoresByUser={scoresByUser} profileNameById={profileNameById} />
      )}
      {!loading && innerTab === 'manager' && (
        <ManagerDashboard
          inactiveUsers={inactiveUsers}
          delayedTickets={delayedTickets}
          teamHealth={health}
          missedLate={missedLate}
          profileNameById={profileNameById}
        />
      )}
      {!loading && innerTab === 'leaderboards' && (
        <Leaderboards contributions={contributions} profileNameById={profileNameById} />
      )}
      {!loading && innerTab === 'heatmap' && (
        <HeatmapPanel cells={heatmap} title="Entries by task type" />
      )}
      {innerTab === 'feedback' && (
        <FeedbackModule
          profile={userProfile}
          accessibleProfiles={accessibleProfiles}
          clients={clients}
          onToast={onToast}
        />
      )}
      {innerTab === 'governance' && (
        <SuperAdminGovernance
          profile={userProfile}
          accessibleProfiles={accessibleProfiles}
          onToast={onToast}
        />
      )}
    </div>
  );
}
