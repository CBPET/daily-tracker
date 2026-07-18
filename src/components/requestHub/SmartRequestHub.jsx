import { useCallback, useEffect, useMemo, useState } from 'react';
import { Inbox, LayoutDashboard, List, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  createRequest,
  getRequests,
  getRequestById,
  getRequestHubDashboardStats,
  runRequestAction,
} from '../../lib/requestHub/requestHubService';
import { canManageRequestHub } from '../../lib/permissions';
import RequestHubDashboard from './RequestHubDashboard';
import RequestList from './RequestList';
import RequestCreateForm from './RequestCreateForm';
import RequestDetail from './RequestDetail';

export default function SmartRequestHub({ profile, clients = [], onToast, initialTicketId }) {
  const [view, setView] = useState('dashboard');
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState({ status: '', priority: '', search: '' });

  const profileNameById = useMemo(() => {
    const map = {};
    for (const u of assignableUsers) {
      map[u.id] = u.performer_name || u.email || u.id;
    }
    if (profile?.id) map[profile.id] = profile.performer_name || profile.email;
    return map;
  }, [assignableUsers, profile]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRequests({
        status: filters.status || undefined,
        priority: filters.priority || undefined,
        search: filters.search || undefined,
        limit: 50,
      });
      setTickets(data);
    } catch (err) {
      onToast?.(`❌ ${err.message || 'Failed to load requests'}`);
    } finally {
      setLoading(false);
    }
  }, [filters, onToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    (async () => {
      try {
        let query = supabase.from('profiles').select('id, performer_name, email, role, team_id, client_ref, sub_division').order('performer_name');
        if (profile?.role === 'team_lead' && profile.team_id) {
          query = query.eq('team_id', profile.team_id);
        } else if (profile?.role === 'group_lead' && profile.client_ref) {
          query = query.eq('client_ref', profile.client_ref);
          if (profile.sub_division) query = query.eq('sub_division', profile.sub_division);
        } else if (!canManageRequestHub(profile?.role) && profile?.role !== 'manager') {
          // performers: still show self for assignee display
        }
        const { data, error } = await query;
        if (error) throw error;
        setAssignableUsers(data || []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [profile]);

  useEffect(() => {
    if (!initialTicketId) return;
    (async () => {
      try {
        const t = await getRequestById(initialTicketId);
        setSelected(t);
        setView('detail');
      } catch (err) {
        console.warn(err);
      }
    })();
  }, [initialTicketId]);

  useEffect(() => {
    const onOpen = async (e) => {
      const id = e?.detail?.id;
      if (!id) return;
      try {
        const t = await getRequestById(id);
        setSelected(t);
        setView('detail');
      } catch (err) {
        console.warn(err);
      }
    };
    window.addEventListener('srh-open-ticket', onOpen);
    return () => window.removeEventListener('srh-open-ticket', onOpen);
  }, []);

  const stats = useMemo(() => getRequestHubDashboardStats(tickets), [tickets]);
  const myCount = useMemo(
    () => tickets.filter((t) => t.created_by === profile?.id).length,
    [tickets, profile]
  );

  const handleCreate = async (payload, files) => {
    setBusy(true);
    try {
      const ticket = await createRequest(payload, files, profile);
      onToast?.(`✅ Request ${ticket.ticket_number} created`);
      await refresh();
      setSelected(ticket);
      setView('detail');
    } finally {
      setBusy(false);
    }
  };

  const handleAction = async (action, opts) => {
    if (!selected) return;
    setBusy(true);
    try {
      const updated = await runRequestAction(selected.id, action, profile, opts);
      setSelected(updated);
      onToast?.('✅ Request updated');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-black flex items-center gap-3">
          <Inbox className="text-blue-600" />
          Smart Request Hub
        </h2>
        <div className="flex flex-wrap gap-2">
          <TabBtn active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={LayoutDashboard} label="Dashboard" />
          <TabBtn active={view === 'list'} onClick={() => setView('list')} icon={List} label="List" />
          <TabBtn active={view === 'create'} onClick={() => setView('create')} icon={Plus} label="New Request" />
        </div>
      </div>

      {view === 'list' && (
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">All statuses</option>
            {['Request', 'Verified', 'Assigned', 'In Progress', 'Need Information', 'Resolved', 'Rejected', 'Closed'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            value={filters.priority}
            onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
          >
            <option value="">All priorities</option>
            {['Low', 'Medium', 'High', 'Critical'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-w-[180px]"
            placeholder="Search…"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
      )}

      {loading && view !== 'create' && view !== 'detail' ? (
        <div className="py-16 text-center text-gray-500 font-semibold">Loading…</div>
      ) : null}

      {view === 'dashboard' && !loading && (
        <RequestHubDashboard stats={stats} myCount={myCount} onOpenList={() => setView('list')} />
      )}

      {view === 'list' && !loading && (
        <RequestList
          tickets={tickets}
          profileNameById={profileNameById}
          onSelect={(t) => {
            setSelected(t);
            setView('detail');
          }}
        />
      )}

      {view === 'create' && (
        <RequestCreateForm
          clients={clients}
          profile={profile}
          busy={busy}
          onCancel={() => setView('list')}
          onSubmit={handleCreate}
        />
      )}

      {view === 'detail' && selected && (
        <RequestDetail
          ticket={selected}
          profile={profile}
          assignableUsers={assignableUsers}
          profileNameById={profileNameById}
          busy={busy}
          onBack={() => {
            setSelected(null);
            setView('list');
          }}
          onAction={handleAction}
        />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
        active
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
          : 'bg-gray-50 dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
