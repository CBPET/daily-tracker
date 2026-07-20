import { useState } from 'react';
import WorkflowManager from '../WorkflowManager';
import UserManagement from '../UserManagement';
import AdminUserRow from '../AdminUserRow';
import ClientManagement from '../ClientManagement';
import ProjectDatabaseManager from '../projects';
import { supabase } from '../../lib/supabase';
import { deriveDisplayNameFromEmail } from '../../lib/displayName';
import { canAccessAdminTab, canManageUsers } from '../../lib/permissions';
import {
    RefreshCw,
    Users,
    Search,
    UserPlus,
    Mail,
    Copy,
    Loader2,
} from 'lucide-react';

/**
 * Administration tab: users, clients, workflows, projects + invite/add modals.
 */
const AdminUsersPanel = ({
    profile,
    session,
    allProfiles = [],
    clients = [],
    isAdminSyncing = false,
    onRefreshProfiles,
    onUpdateUserRole,
    onDeleteUser,
    onAddUser,
    onAdminEmailInvite,
    onManagePassword,
    onToast,
}) => {
    const [adminSubTab, setAdminSubTab] = useState('users');
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [showAdminEmailInviteModal, setShowAdminEmailInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('performer');
    const [inviteSending, setInviteSending] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserRole, setNewUserRole] = useState('performer');

    const handleAdminEmailInviteSubmit = async (e) => {
        e.preventDefault();
        setInviteSending(true);
        try {
            const ok = await onAdminEmailInvite({ email: inviteEmail, role: inviteRole });
            if (ok !== false) {
                setShowAdminEmailInviteModal(false);
                setInviteEmail('');
                setInviteRole('performer');
            }
        } finally {
            setInviteSending(false);
        }
    };

    const handleAddNewUserSubmit = async (e) => {
        e.preventDefault();
        const ok = await onAddUser({
            email: newUserEmail,
            name: newUserName,
            role: newUserRole,
        });
        if (ok !== false) {
            setShowAddUserModal(false);
            setNewUserEmail('');
            setNewUserName('');
            setNewUserRole('performer');
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black flex items-center gap-3">
                    <Users className="text-purple-600" />
                    System Administration
                </h2>
                <div className="flex gap-2">
                    {adminSubTab === 'users' && (
                        <>
                            {canManageUsers(profile?.role) && (
                                <button
                                    onClick={() => setShowAdminEmailInviteModal(true)}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all text-xs uppercase tracking-widest active:scale-95"
                                    title="Email invite with role — user sets name & password"
                                >
                                    <Mail size={16} /> Admin Invite
                                </button>
                            )}
                            <button
                                onClick={() => setShowAddUserModal(true)}
                                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white font-black rounded-xl shadow-lg shadow-green-500/20 transition-all text-xs uppercase tracking-widest active:scale-95"
                                title="Create account immediately with temp password"
                            >
                                <UserPlus size={16} /> Add New User
                            </button>
                            <button
                                onClick={() => setShowInviteModal(true)}
                                className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white font-black rounded-xl shadow-lg shadow-purple-500/20 transition-all text-xs uppercase tracking-widest active:scale-95"
                                title="Copy public #signup link"
                            >
                                <UserPlus size={16} /> Provision User
                            </button>
                        </>
                    )}
                    <button
                        onClick={adminSubTab === 'users' ? onRefreshProfiles : null}
                        disabled={adminSubTab === 'users' ? isAdminSyncing : false}
                        className={`p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 rounded-lg ${adminSubTab === 'users' && isAdminSyncing ? 'animate-spin' : ''}`}
                        aria-label="Refresh user list"
                    >
                        <RefreshCw size={20} />
                    </button>
                </div>
            </div>

            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setAdminSubTab('users')}
                    className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${adminSubTab === 'users'
                        ? 'border-purple-600 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                >
                    👥 User Management
                </button>
                <button
                    onClick={() => setAdminSubTab('clients')}
                    className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${adminSubTab === 'clients'
                        ? 'border-purple-600 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                >
                    🏢 Client Management
                </button>
                <button
                    onClick={() => setAdminSubTab('workflows')}
                    className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${adminSubTab === 'workflows'
                        ? 'border-purple-600 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                >
                    📋 Workflow Management
                </button>
                <button
                    onClick={() => setAdminSubTab('projects')}
                    className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${adminSubTab === 'projects'
                        ? 'border-purple-600 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                >
                    iTitle Database
                </button>
            </div>

            {adminSubTab === 'users' && canAccessAdminTab(profile?.role) ? (
                <UserManagement currentUserRole={profile?.role} onResendInvite={async (email, role, onboarding) => {
                    const { data: { session: adminSession } } = await supabase.auth.getSession();
                    if (!adminSession?.access_token) throw new Error('Not signed in');
                    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`;
                    const res = await fetch(fnUrl, {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${adminSession.access_token}`,
                            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            action: 'resend',
                            email,
                            role: role || 'performer',
                            displayName: deriveDisplayNameFromEmail(email),
                            onboarding: onboarding || undefined,
                        }),
                    });
                    const payload = await res.json().catch(() => ({}));
                    if (!res.ok || !payload.ok) throw new Error(payload.error || 'Resend failed');
                    return payload;
                }} />
            ) : adminSubTab === 'users' ? (
                <>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search users by name, role or ID..."
                            value={userSearchTerm}
                            onChange={(e) => setUserSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all text-sm font-bold"
                        />
                    </div>

                    <div className="overflow-x-auto rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 dark:bg-gray-800/50">
                                <tr>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">User Name</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Assignment</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Role</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-gray-800">
                                {allProfiles.filter(p =>
                                    p.performer_name?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                    p.role?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                    p.id?.toLowerCase().includes(userSearchTerm.toLowerCase())
                                ).map(p => (
                                    <AdminUserRow
                                        key={p.id}
                                        user={p}
                                        onUpdate={onUpdateUserRole}
                                        onDelete={onDeleteUser}
                                        isSelf={p.id === session?.user?.id}
                                        currentUserRole={profile?.role}
                                        onManagePassword={onManagePassword}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : adminSubTab === 'workflows' ? (
                <WorkflowManager
                    supabase={supabase}
                    session={session}
                    allProfiles={allProfiles}
                    onRefresh={onRefreshProfiles}
                />
            ) : adminSubTab === 'clients' ? (
                <ClientManagement
                    supabase={supabase}
                    session={session}
                    profile={profile}
                    allProfiles={allProfiles}
                    onRefresh={onRefreshProfiles}
                />
            ) : adminSubTab === 'projects' ? (
                <ProjectDatabaseManager
                    supabase={supabase}
                    session={session}
                    profile={profile}
                    allProfiles={allProfiles}
                    clients={clients}
                />
            ) : null}

            {showAdminEmailInviteModal && adminSubTab === 'users' && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-[40px] p-10 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-gray-800 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-3xl" />

                        <h3 className="text-2xl font-black mb-2 tracking-tight">Admin Invite</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 font-medium">
                            Send an invite email. The user opens the link, confirms display name, and sets a password.
                        </p>

                        <form onSubmit={handleAdminEmailInviteSubmit} className="space-y-6">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Email Address</label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="user@company.com"
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none focus:border-blue-500 font-bold text-sm"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Display Name Preview</label>
                                <input
                                    type="text"
                                    value={deriveDisplayNameFromEmail(inviteEmail) || '—'}
                                    readOnly
                                    className="w-full p-3 bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-2xl font-bold text-sm text-gray-600 dark:text-gray-300 cursor-not-allowed"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">Derived from email; user can edit when they accept.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Assign Role</label>
                                <select
                                    value={inviteRole}
                                    onChange={(e) => setInviteRole(e.target.value)}
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none focus:border-blue-500 font-bold text-sm"
                                >
                                    <option value="performer">Performer</option>
                                    <option value="team_lead">Team Lead</option>
                                    <option value="group_lead">Group Lead</option>
                                    <option value="manager">Manager</option>
                                    <option value="general_manager">General Manager</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={inviteSending}
                                    className="flex-1 py-3 bg-blue-600 text-white font-black rounded-xl uppercase tracking-widest text-xs shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {inviteSending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                                    Send Invite
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAdminEmailInviteModal(false)}
                                    className="flex-1 py-3 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-black rounded-xl uppercase tracking-widest text-xs"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showAddUserModal && adminSubTab === 'users' && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-[40px] p-10 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-gray-800 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full -mr-16 -mt-16 blur-3xl" />

                        <h3 className="text-2xl font-black mb-2 tracking-tight">Add New User</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 font-medium">Create a new team member with assigned role and permissions.</p>

                        <form onSubmit={handleAddNewUserSubmit} className="space-y-6">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Email Address</label>
                                <input
                                    type="email"
                                    value={newUserEmail}
                                    onChange={(e) => setNewUserEmail(e.target.value)}
                                    placeholder="user@example.com"
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none focus:border-green-500 font-bold text-sm"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Full Name</label>
                                <input
                                    type="text"
                                    value={newUserName}
                                    onChange={(e) => setNewUserName(e.target.value)}
                                    placeholder="John Doe"
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none focus:border-green-500 font-bold text-sm"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Assign Role</label>
                                <select
                                    value={newUserRole}
                                    onChange={(e) => setNewUserRole(e.target.value)}
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none focus:border-green-500 font-bold text-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:20px_20px] bg-[right_1rem_center] bg-no-repeat pr-10"
                                >
                                    <option value="performer">👤 Performer</option>
                                    <option value="team_lead">👨‍💼 Team Lead</option>
                                    <option value="group_lead">👥 Group Lead</option>
                                    <option value="manager">📊 Manager</option>
                                    <option value="general_manager">🏢 General Manager</option>
                                    <option value="super_admin">🔐 Super Admin</option>
                                </select>
                            </div>

                            <div className="p-4 rounded-2xl bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900">
                                <p className="text-xs font-semibold text-green-800 dark:text-green-300">✅ User will be created with the selected role and full access permissions.</p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-green-600 text-white font-black rounded-xl uppercase tracking-widest text-xs shadow-lg shadow-green-500/30 hover:bg-green-700 transition-all active:scale-95"
                                >
                                    Create User
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddUserModal(false)}
                                    className="flex-1 py-3 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-black rounded-xl uppercase tracking-widest text-xs hover:bg-gray-300 dark:hover:bg-gray-700 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showInviteModal && adminSubTab === 'users' && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-[40px] p-10 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-gray-800 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full -mr-16 -mt-16 blur-3xl" />

                        <h3 className="text-2xl font-black mb-2 tracking-tight">Provision New User</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 font-medium">Generate a registration link for new team members. They will join as 'Performer' by default.</p>

                        <div className="space-y-6">
                            <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Professional Invite Link</p>
                                <div className="flex items-center gap-2 bg-white dark:bg-gray-950 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                                    <code className="flex-1 text-[10px] font-bold text-gray-500 truncate">{window.location.href.split('#')[0]}#signup</code>
                                    <button
                                        onClick={() => {
                                            const url = `${window.location.href.split('#')[0]}#signup`;
                                            navigator.clipboard.writeText(url);
                                            onToast?.('📋 Signup link copied!');
                                        }}
                                        className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                                        aria-label="Copy signup link"
                                    >
                                        <Copy size={16} />
                                    </button>
                                </div>
                                <button
                                    onClick={() => {
                                        const msg = `Hi! You've been invited to join the CBPET Daily Tracker. Please register here: ${window.location.href.split('#')[0]}#signup`;
                                        navigator.clipboard.writeText(msg);
                                        onToast?.('📩 Invite message copied!');
                                    }}
                                    className="w-full mt-4 py-2 border-2 border-dashed border-purple-200 dark:border-purple-900/50 text-[10px] font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                                >
                                    Copy Invite Message
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-start gap-4 p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900">
                                    <div className="p-2 bg-blue-600 rounded-lg text-white font-black text-xs">1</div>
                                    <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">New user signs up via this link.</p>
                                </div>
                                <div className="flex items-start gap-4 p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30">
                                    <div className="p-2 bg-purple-600 rounded-lg text-white font-black text-xs">2</div>
                                    <p className="text-xs font-semibold text-purple-800 dark:text-purple-300">You refresh this tab and assign their Role/Client ID.</p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowInviteModal(false)}
                            className="w-full mt-10 py-4 bg-gray-900 dark:bg-gray-800 text-white font-black rounded-2xl uppercase tracking-widest text-xs transition-all hover:bg-black"
                        >
                            Close Management
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminUsersPanel;
