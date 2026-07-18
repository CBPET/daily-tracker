import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Toast from './Toast';
import { Users, Trash2, Search, Shield, CheckCircle, Clock, Archive, Mail } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'active',  label: '✅ Active',   description: 'Working normally',         colorClass: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200'  },
  { value: 'idle',    label: '⏸ Idle',     description: 'On leave / medical leave', colorClass: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200' },
  { value: 'archive', label: '🗄 Archived', description: 'No longer active',         colorClass: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'           },
];

const STATUS_FILTER_TABS = [
  { value: 'all',     label: 'All' },
  { value: 'active',  label: '✅ Active' },
  { value: 'idle',    label: '⏸ Idle' },
  { value: 'archive', label: '🗄 Archived' },
];

const VERIFY_FILTER_TABS = [
  { value: 'all', label: 'All email' },
  { value: 'verified', label: 'Verified' },
  { value: 'pending', label: 'Pending' },
];

export default function UserManagement({ currentUserRole, onResendInvite }) {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [verifyFilter, setVerifyFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [resendingId, setResendingId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editingSubDivision, setEditingSubDivision] = useState(null);
  const [editingStatus, setEditingStatus] = useState(null);
  const [teams, setTeams] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch users and teams on mount
  useEffect(() => {
    fetchUsers();
    fetchTeams();
  }, []);

  const isAdmin = ['super_admin', 'general_manager', 'manager'].includes(currentUserRole);
  const canInvite = ['super_admin', 'general_manager'].includes(currentUserRole);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, performer_name, role, team_id, client_id, client_ref, sub_division, email, status, email_confirmed_at')
        .order('performer_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      showToast('Error loading users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTeams(data || []);
    } catch (err) {
      console.error('Error fetching clients as teams:', err);
    }
  };

  // ── Filtered users (search + status tab + email verify) ──
  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.performer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (user.status || 'active') === statusFilter;
    const verified = Boolean(user.email_confirmed_at);
    const matchesVerify =
      verifyFilter === 'all' ||
      (verifyFilter === 'verified' && verified) ||
      (verifyFilter === 'pending' && !verified);
    return matchesSearch && matchesStatus && matchesVerify;
  });

  const handleResendInvite = async (user) => {
    if (!canInvite || !onResendInvite) {
      showToast('Only super_admin / general_manager can resend invites', 'error');
      return;
    }
    if (!user.email) {
      showToast('User has no email on file', 'error');
      return;
    }
    try {
      setResendingId(user.id);
      await onResendInvite(user.email, user.role);
      showToast(`Invite / confirmation resent to ${user.email}`, 'success');
      fetchUsers();
    } catch (err) {
      showToast(err.message || 'Resend failed', 'error');
    } finally {
      setResendingId(null);
    }
  };

  // ── Update handlers ──
  const handleUpdateRole = async (userId) => {
    if (!isAdmin) { showToast('Access denied', 'error'); return; }
    if (!editingRole) { showToast('Select a role', 'error'); return; }
    try {
      setLoading(true);
      const { error } = await supabase.from('profiles').update({ role: editingRole }).eq('id', userId);
      if (error) throw error;
      showToast(`Role updated to ${editingRole}`, 'success');
      setSelectedUser(null);
      setEditingRole(null);
      fetchUsers();
    } catch (err) {
      showToast('Error updating role', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTeam = async (userId) => {
    if (!isAdmin) { showToast('Access denied', 'error'); return; }
    try {
      setLoading(true);
      const selectedClient = teams.find(c => c.id === editingTeam);
      const clientCode = selectedClient ? selectedClient.code : 'DEFAULT_CLIENT';
      const { error } = await supabase.from('profiles').update({
        team_id: null,
        client_ref: editingTeam || null,
        client_id: clientCode,
        sub_division: editingSubDivision || null,
      }).eq('id', userId);
      if (error) throw error;
      showToast('Client and Sub-division updated', 'success');
      setSelectedUser(null);
      setEditingTeam(null);
      setEditingSubDivision(null);
      fetchUsers();
    } catch (err) {
      showToast('Error updating client assignment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (userId) => {
    if (!isAdmin) { showToast('Access denied', 'error'); return; }
    if (!editingStatus) { showToast('Select a status', 'error'); return; }
    try {
      setLoading(true);
      const { error } = await supabase.from('profiles').update({ status: editingStatus }).eq('id', userId);
      if (error) throw error;
      showToast(`Status updated to ${editingStatus}`, 'success');
      setSelectedUser(null);
      setEditingStatus(null);
      fetchUsers();
    } catch (err) {
      showToast('Error updating status', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!isAdmin) { showToast('Access denied', 'error'); return; }
    if (!window.confirm(`⚠️ Permanently delete "${userName}"? This will remove their profile record. This action cannot be undone.`)) return;
    try {
      setLoading(true);
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;
      showToast('User permanently deleted', 'success');
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      showToast('Error deleting user: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role) => {
    const colors = {
      'super_admin':     'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200',
      'general_manager': 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200',
      'manager':         'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
      'group_lead':      'bg-pink-100 dark:bg-pink-900/50 text-pink-800 dark:text-pink-200',
      'team_lead':       'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
      'performer':       'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    };
    return colors[role] || colors['performer'];
  };

  const getStatusBadge = (status) => {
    const s = STATUS_OPTIONS.find(o => o.value === (status || 'active'));
    return s ? s.colorClass : STATUS_OPTIONS[0].colorClass;
  };

  const roleOptions = [
    { value: 'super_admin',     label: '👑 Super Admin',     description: 'Full system control' },
    { value: 'general_manager', label: '📊 General Manager', description: 'Organization overview' },
    { value: 'manager',         label: '📈 Manager',         description: 'Multi-team oversight' },
    { value: 'group_lead',      label: '👥 Group Lead',      description: 'Oversight of performers in group' },
    { value: 'team_lead',       label: '👥 Team Lead',       description: 'Team management' },
    { value: 'performer',       label: '👤 Performer',       description: 'Individual contributor' },
  ];

  // Counts per status for the filter tab badges
  const countByStatus = {
    all:     users.length,
    active:  users.filter(u => (u.status || 'active') === 'active').length,
    idle:    users.filter(u => u.status === 'idle').length,
    archive: users.filter(u => u.status === 'archive').length,
  };

  const countByVerify = {
    all: users.length,
    verified: users.filter(u => Boolean(u.email_confirmed_at)).length,
    pending: users.filter(u => !u.email_confirmed_at).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-500" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Manage roles, status, email verification, and permissions</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{users.length}</p>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 flex-wrap border-b border-gray-200 dark:border-gray-700 pb-0">
        {STATUS_FILTER_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all ${
              statusFilter === tab.value
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-[10px] font-black">
              {countByStatus[tab.value]}
            </span>
          </button>
        ))}
      </div>

      {/* Email verification filter */}
      <div className="flex gap-2 flex-wrap">
        {VERIFY_FILTER_TABS.map(tab => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setVerifyFilter(tab.value)}
            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
              verifyFilter === tab.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
            }`}
          >
            {tab.label}
            <span className="ml-1 opacity-80">({countByVerify[tab.value]})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading && filteredUsers.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Client (Team)</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Sub-division</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <React.Fragment key={user.id}>
                    <tr className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {user.performer_name}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[11px] text-gray-500 font-mono">{user.email || '—'}</p>
                        {user.email_confirmed_at ? (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            <CheckCircle size={10} /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                            <Clock size={10} /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(user.status)}`}>
                          {user.status || 'active'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                          {(user.role || '').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-semibold uppercase">
                        {teams.find(t => t.id === user.team_id || t.id === user.client_ref)?.code || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {user.sub_division ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                            {user.sub_division}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              setSelectedUser(user.id === selectedUser ? null : user.id);
                              setEditingRole(user.role);
                              setEditingTeam(user.client_ref);
                              setEditingSubDivision(user.sub_division);
                              setEditingStatus(user.status || 'active');
                            }}
                            className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-900 transition"
                          >
                            {selectedUser === user.id ? 'Collapse' : 'Edit'}
                          </button>
                          {canInvite && !user.email_confirmed_at && user.email && (
                            <button
                              type="button"
                              disabled={resendingId === user.id}
                              onClick={() => handleResendInvite(user)}
                              className="px-3 py-1 text-sm bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 rounded hover:bg-indigo-200 dark:hover:bg-indigo-900 transition flex items-center gap-1 disabled:opacity-50"
                              title="Resend invite / confirmation email"
                            >
                              <Mail size={12} />
                              {resendingId === user.id ? '…' : 'Resend'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* ── Expanded edit panel ── */}
                    {selectedUser === user.id && (
                      <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-700/30">
                        <td colSpan="7" className="px-4 py-5">
                          <div className="space-y-5">

                            {/* Status Selection */}
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                User Status
                              </label>
                              <div className="flex gap-3 flex-wrap">
                                {STATUS_OPTIONS.map(opt => (
                                  <button
                                    key={opt.value}
                                    onClick={() => setEditingStatus(opt.value)}
                                    className={`px-4 py-2 rounded-lg border-2 text-left transition flex-1 min-w-[120px] ${
                                      editingStatus === opt.value
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-300'
                                    }`}
                                  >
                                    <p className="font-semibold text-sm text-gray-900 dark:text-white">{opt.label}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{opt.description}</p>
                                  </button>
                                ))}
                              </div>
                              <button
                                onClick={() => handleUpdateStatus(user.id)}
                                disabled={loading || editingStatus === (user.status || 'active')}
                                className="mt-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition disabled:opacity-50 text-sm font-semibold"
                              >
                                {loading ? 'Saving…' : 'Save Status'}
                              </button>
                            </div>

                            {/* Role Selection */}
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                Select Role
                              </label>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                {roleOptions.map(role => (
                                  <button
                                    key={role.value}
                                    onClick={() => setEditingRole(role.value)}
                                    className={`p-3 rounded-lg border-2 text-left transition ${
                                      editingRole === role.value
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-300'
                                    }`}
                                  >
                                    <p className="font-medium text-gray-900 dark:text-white">{role.label}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">{role.description}</p>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Client & Sub-division Selection */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                  Assign to Client (Team)
                                </label>
                                <select
                                  value={editingTeam || ''}
                                  onChange={(e) => setEditingTeam(e.target.value || null)}
                                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                >
                                  <option value="">No Client (Unassigned)</option>
                                  {teams.map(client => (
                                    <option key={client.id} value={client.id}>{client.name} ({client.code})</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                  Assign Sub-division
                                </label>
                                <select
                                  value={editingSubDivision || ''}
                                  onChange={(e) => setEditingSubDivision(e.target.value || null)}
                                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                >
                                  <option value="">No Sub-division (None)</option>
                                  <option value="PreEdit">PreEdit</option>
                                  <option value="Validation">Validation</option>
                                </select>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 flex-wrap">
                              <button
                                onClick={() => handleUpdateRole(user.id)}
                                disabled={loading || editingRole === user.role}
                                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50 font-semibold"
                              >
                                {loading ? 'Updating…' : 'Update Role'}
                              </button>
                              <button
                                onClick={() => handleUpdateTeam(user.id)}
                                disabled={loading || (editingTeam === user.client_ref && editingSubDivision === user.sub_division)}
                                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 font-semibold"
                              >
                                {loading ? 'Updating…' : 'Update Client/Sub-div'}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id, user.performer_name)}
                                disabled={loading}
                                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center gap-2 font-semibold"
                              >
                                <Trash2 className="w-4 h-4" /> Delete User
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role Reference */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex gap-3">
          <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Role & Status Reference</h3>
            <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
              <li><strong>Super Admin:</strong> Full system control, manage all users and workflows</li>
              <li><strong>General Manager:</strong> View all employees, access organization analytics</li>
              <li><strong>Manager:</strong> Manage multiple teams within their scope</li>
              <li><strong>Group Lead:</strong> Manage assigned performers across client sub-divisions</li>
              <li><strong>Team Lead:</strong> Manage own team members, view team performance</li>
              <li><strong>Performer:</strong> Individual contributor, submit own entries</li>
            </ul>
            <div className="mt-3 flex gap-4 text-xs text-blue-700 dark:text-blue-300 font-semibold">
              <span>✅ Active — working normally</span>
              <span>⏸ Idle — on leave / medical</span>
              <span>🗄 Archived — no longer active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
