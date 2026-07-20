import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import DailySummary from './components/DailySummary';
import DailyTaskForm from './components/daily/DailyTaskForm';
import AppShell from './components/AppShell';
import AdminUsersPanel from './components/admin/AdminUsersPanel';
import Login from './components/Login';
import Signup from './components/Signup';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import InviteAccept from './components/InviteAccept';
import LandingPage from './components/LandingPage';
import ChangePassword from './components/ChangePassword';
import AdminResetUserPassword from './components/AdminResetUserPassword';
import ProjectDatabaseManager from './components/projects';
import SmartRequestHub from './components/requestHub/SmartRequestHub';
import { supabase, formatAuthClientError } from './lib/supabase';
import {
    completeAuthCallback,
    isRecoveryCallback,
    isInviteCallback,
    isAuthCallbackUrl,
    isSignupConfirmFromUrl,
    getAuthRedirectUrl,
} from './lib/authRedirect';
import { parseAnalyticsHash } from './lib/performanceRating';
import { deriveDisplayNameFromEmail, isValidEmail } from './lib/displayName';
import { isSmartRequestHubEnabled, isNotificationsEnabled } from './lib/featureFlags';
import { notifyDailyTrackerEvent } from './lib/notifications/notificationRules';
import {
    STANDARD_TARGETS,
    normalizeTaskType,
} from './lib/targetUtils';
import { Loader2 } from 'lucide-react';

const App = () => {
    // ── Hash Routing Constants ──
    const HASH_TO_TAB = { form: 'form', analytics: 'dashboard', projects: 'projects', 'request-hub': 'request_hub', admin: 'super_admin' };
    const TAB_TO_HASH = { form: 'form', dashboard: 'analytics', projects: 'projects', request_hub: 'request-hub', super_admin: 'admin' };
    // App-tab hashes that should resolve to the app view when authenticated
    const APP_HASHES = new Set(['form', 'analytics', 'projects', 'request-hub', 'admin']);
    const requestHubEnabled = isSmartRequestHubEnabled();
    const notificationsEnabled = isNotificationsEnabled();
    const [requestHubTicketId, setRequestHubTicketId] = useState(null);

    const getHashPath = () => {
        const raw = window.location.hash.slice(1);
        return raw.split('?')[0].split('#')[0];
    };

    // ── Auth & Session State ──
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [authCallbackError, setAuthCallbackError] = useState(null);
    const getInitialView = () => {
        if (isInviteCallback()) return 'invite-accept';
        if (isRecoveryCallback()) return 'reset-password';
        if (isAuthCallbackUrl()) return 'login';
        const hash = getHashPath();
        if (hash === 'invite-accept') return 'invite-accept';
        if (hash === 'signup' || hash.startsWith('signup')) return 'signup';
        if (hash === 'landing') return 'landing';
        if (hash === 'login') return 'login';
        if (hash === 'forgot-password') return 'forgot-password';
        // If the hash is an app-tab hash, treat it as 'login' initially (session check will upgrade to 'app')
        if (APP_HASHES.has(hash)) return 'login';
        return 'landing';
    };
    const getInitialTab = () => {
        const hash = getHashPath();
        return HASH_TO_TAB[hash] || 'form';
    };
    const [view, setView] = useState(getInitialView); // 'landing', 'login', 'signup', 'forgot-password', 'reset-password', 'app'
    const [analyticsDeepLink, setAnalyticsDeepLink] = useState(() => {
        const parsed = parseAnalyticsHash(window.location.hash);
        return parsed.path === 'analytics' && (parsed.tab || parsed.client || parsed.start)
            ? parsed
            : null;
    });

    // ── App State ──
    const [statusEntries, setStatusEntries] = useState([]);
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('cbpet_darkMode') === 'true');
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [accessibleProfiles, setAccessibleProfiles] = useState([]);
    const [activeTab, setActiveTab] = useState(getInitialTab);
    const [isSyncing, setIsSyncing] = useState(false);
    const [clients, setClients] = useState([]);
    const [divisionTargets, setDivisionTargets] = useState([]);

    // ── Admin State ──
    const [allProfiles, setAllProfiles] = useState([]);
    const [isAdminSyncing, setIsAdminSyncing] = useState(false);

    // ── Password Management State ──
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
    const [adminPasswordModal, setAdminPasswordModal] = useState(null); // { userId?, mode? } | null

    const openAdminPasswordModal = (opts = {}) => {
        setAdminPasswordModal({
            userId: opts.userId || '',
            mode: opts.mode === 'set_password' ? 'set_password' : 'reset_link',
        });
    };

    const showAppToast = (message) => {
        setToastMessage(message);
        setShowToast(true);
    };

    // ── Auth Effects ──
    useEffect(() => {
        let mounted = true;

        async function bootstrapAuth() {
            const callbackResult = await completeAuthCallback(supabase);
            const { data: { session } } = await supabase.auth.getSession();
            if (!mounted) return;

            setSession(session);
            setAuthCallbackError(
                callbackResult.error ? formatAuthClientError(callbackResult.error) : null
            );

            if (session) {
                if (callbackResult.kind === 'invite') {
                    setView('invite-accept');
                } else if (callbackResult.kind === 'recovery' || isRecoveryCallback()) {
                    setView('reset-password');
                } else {
                    // signup confirm, magic link, or normal session → app
                    setView('app');
                }
                fetchProfile(session.user.id);
            } else if (callbackResult.kind === 'invite' || isInviteCallback()) {
                setView('invite-accept');
            } else if (callbackResult.kind === 'recovery' || isRecoveryCallback()) {
                setView('reset-password');
            } else if (callbackResult.error) {
                // e.g. Invalid API key on signup confirm — stay on login, not InviteAccept
                setView('login');
            }

            setAuthLoading(false);
        }

        bootstrapAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!mounted) return;

            setSession(session);

            if (session) {
                fetchProfile(session.user.id);
                if (isSignupConfirmFromUrl()) {
                    setView('app');
                } else if (isInviteCallback()) {
                    setView('invite-accept');
                } else if (event === 'PASSWORD_RECOVERY' || isRecoveryCallback()) {
                    setView('reset-password');
                } else {
                    setView((current) =>
                        current === 'invite-accept' || current === 'reset-password' ? current : 'app'
                    );
                }
            } else {
                setProfile(null);
                if (isInviteCallback()) {
                    setView('invite-accept');
                } else if (isRecoveryCallback()) {
                    setView('reset-password');
                } else if (isAuthCallbackUrl()) {
                    return;
                } else {
                    setView((current) => {
                        if (current === 'reset-password' || current === 'invite-accept') return current;
                        const hash = window.location.hash;
                        if (hash === '#signup') return 'signup';
                        if (hash === '#landing') return 'landing';
                        if (hash === '#forgot-password') return 'forgot-password';
                        return 'login';
                    });
                }
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const fetchProfile = async (uid) => {
        try {
            const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
            if (error) throw error;
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (currentSession?.user?.id !== uid) return;
            setProfile(data);
        } catch (error) {
            console.error('Error fetching profile:', error.message);
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (currentSession?.user?.id === uid) setProfile(null);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.hash = '#login';
    };

    // ── Hash Routing Effects ──
    // Sync activeTab → URL hash when tab changes (only in app view)
    // Preserve analytics query params when staying on analytics
    useEffect(() => {
        if (view === 'app') {
            const desiredPath = TAB_TO_HASH[activeTab] || 'form';
            const current = parseAnalyticsHash(window.location.hash);
            if (activeTab === 'dashboard' && current.path === 'analytics' && window.location.hash.includes('?')) {
                return; // keep deep-link query until consumed/navigated
            }
            const desiredHash = '#' + desiredPath;
            if (window.location.hash.split('?')[0] !== desiredHash) {
                window.location.hash = desiredHash;
            }
        }
    }, [activeTab, view]);

    // Listen for browser back/forward → update activeTab from hash
    useEffect(() => {
        const onHashChange = () => {
            if (view !== 'app') return;
            const parsed = parseAnalyticsHash(window.location.hash);
            if (parsed.path === 'request-hub' && !requestHubEnabled) {
                setActiveTab('form');
                window.location.hash = '#form';
                return;
            }
            const mapped = HASH_TO_TAB[parsed.path];
            if (mapped && mapped !== activeTab) {
                setActiveTab(mapped);
            }
            if (parsed.path === 'analytics' && (parsed.tab || parsed.client || parsed.start)) {
                setAnalyticsDeepLink(parsed);
            }
        };
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, [view, activeTab, requestHubEnabled]);

    // Redirect disabled Smart Request Hub tab
    useEffect(() => {
        if (view === 'app' && activeTab === 'request_hub' && !requestHubEnabled) {
            setActiveTab('form');
            window.location.hash = '#form';
        }
    }, [view, activeTab, requestHubEnabled]);

    // Open Request Hub ticket from notification deep-link
    useEffect(() => {
        const openFromStorage = () => {
            const id = sessionStorage.getItem('srh_open_ticket');
            if (id && requestHubEnabled) {
                setRequestHubTicketId(id);
                setActiveTab('request_hub');
                sessionStorage.removeItem('srh_open_ticket');
            }
        };
        const onOpen = (e) => {
            if (e?.detail?.id && requestHubEnabled) {
                setRequestHubTicketId(e.detail.id);
                setActiveTab('request_hub');
            }
        };
        openFromStorage();
        window.addEventListener('srh-open-ticket', onOpen);
        return () => window.removeEventListener('srh-open-ticket', onOpen);
    }, [requestHubEnabled]);

    // ── App Data Effects ──
    useEffect(() => {
        if (darkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        localStorage.setItem('cbpet_darkMode', darkMode);
    }, [darkMode]);

    const fetchDivisionTargets = async () => {
        if (!supabase || !session) return;
        try {
            const { data, error } = await supabase.from('division_targets').select('*');
            if (error) throw error;
            setDivisionTargets(data || []);
            localStorage.setItem('cbpet_division_targets', JSON.stringify(data || []));
        } catch (error) {
            console.warn('Failed to fetch division targets from Supabase, using localStorage:', error.message);
            const local = localStorage.getItem('cbpet_division_targets');
            if (local) {
                try {
                    setDivisionTargets(JSON.parse(local));
                } catch (err) {
                    console.error('Failed to parse cached division targets:', err);
                }
            }
        }
    };

    useEffect(() => {
        if (session && profile) {
            fetchFromSupabase();
            fetchAccessibleProfiles();
            fetchClients();
            fetchDivisionTargets();
            if (['super_admin', 'general_manager', 'manager', 'group_lead', 'team_lead', 'performer'].includes(profile.role)) fetchAllProfiles();
        }
    }, [session, profile]);

    // ── Data Logic ──
    const fetchFromSupabase = async () => {
        if (!supabase || !session) return;
        setIsSyncing(true);
        try {
            let query = supabase.from('status_entries').select('*').order('date', { ascending: false });
            if (profile?.role === 'performer') {
                query = query.eq('user_id', session.user.id);
            } else if (profile?.role === 'team_lead' && profile.team_id) {
                const { data: teamMembers } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('team_id', profile.team_id);
                const memberIds = (teamMembers || []).map((m) => m.id);
                if (memberIds.length > 0) query = query.in('user_id', memberIds);
            } else if (profile?.role === 'group_lead' && profile.client_ref) {
                let q = supabase
                    .from('profiles')
                    .select('id')
                    .eq('client_ref', profile.client_ref);
                if (profile.sub_division) {
                    q = q.eq('sub_division', profile.sub_division);
                }
                const { data: groupMembers } = await q;
                const memberIds = (groupMembers || []).map((m) => m.id);
                memberIds.push(session.user.id); // Also show the lead's own entries
                if (memberIds.length > 0) query = query.in('user_id', memberIds);
            }
            const { data, error } = await query;
            if (error) throw error;
            setStatusEntries(data || []);
        } catch (error) {
            console.error('Error fetching entries:', error.message);
        } finally {
            setIsSyncing(false);
        }
    };

    const fetchAllProfiles = async () => {
        if (!['super_admin', 'general_manager', 'manager', 'group_lead', 'team_lead', 'performer'].includes(profile?.role)) return;
        setIsAdminSyncing(true);
        try {
            const { data, error } = await supabase.from('profiles').select('*').order('performer_name', { ascending: true });
            if (error) throw error;
            setAllProfiles(data || []);
        } catch (error) {
            console.error('Error fetching profiles:', error.message);
        } finally {
            setIsAdminSyncing(false);
        }
    };

    const fetchAccessibleProfiles = async () => {
        if (!profile) return;
        try {
            if (['super_admin', 'general_manager', 'manager'].includes(profile.role)) {
                const { data, error } = await supabase.from('profiles').select('*').order('performer_name', { ascending: true });
                if (error) throw error;
                setAccessibleProfiles(data || []);
            } else if (profile.role === 'team_lead' && profile.team_id) {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('team_id', profile.team_id)
                    .order('performer_name', { ascending: true });
                if (error) throw error;
                setAccessibleProfiles(data || []);
            } else if (profile.role === 'group_lead' && profile.client_ref) {
                let q = supabase
                    .from('profiles')
                    .select('*')
                    .eq('client_ref', profile.client_ref);
                if (profile.sub_division) {
                    q = q.eq('sub_division', profile.sub_division);
                }
                const { data, error } = await q.order('performer_name', { ascending: true });
                if (error) throw error;
                setAccessibleProfiles(data || []);
            } else {
                setAccessibleProfiles([]);
            }
        } catch (error) {
            console.error('Error fetching accessible profiles:', error.message);
        }
    };

    const fetchClients = async () => {
        if (!supabase || !session) return;
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .eq('is_active', true)
                .order('code', { ascending: true });
            if (error) throw error;
            setClients(data || []);
        } catch (error) {
            console.error('Error fetching active clients:', error.message);
        }
    };

    const canDeleteEntry = (entry) => {
        if (!session || !profile) return false;
        return ['super_admin', 'general_manager', 'manager'].includes(profile.role);
    };

    const handleUpdateUserRole = async (userId, newRole, clientId) => {
        // RBAC: Only super_admin and general_manager can update users
        if (profile?.role !== 'super_admin' && profile?.role !== 'general_manager') {
            showAppToast('❌ Access Denied: Only super_admin and general_manager can update users');
            return;
        }

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole, client_id: clientId })
                .eq('id', userId);

            if (error) throw error;
            showAppToast('✅ User updated successfully');
            fetchAllProfiles();
        } catch (error) {
            showAppToast('❌ Error updating user: ' + error.message);
        }
    };

    const handleDeleteUser = async (userId) => {
        // RBAC: Only super_admin and general_manager can delete users
        if (profile?.role !== 'super_admin' && profile?.role !== 'general_manager') {
            showAppToast('❌ Access Denied: Only super_admin and general_manager can delete users');
            return;
        }

        if (!window.confirm('Are you sure you want to delete this user profile? This removes their access metadata.')) return;
        try {
            const { error } = await supabase.from('profiles').delete().eq('id', userId);
            if (error) throw error;
            showAppToast('🗑️ User profile removed');
            fetchAllProfiles();
        } catch (error) {
            showAppToast('❌ Error deleting user: ' + error.message);
        }
    };

    const handleAddNewUser = async ({ email, name, role }) => {
        // RBAC: Only super_admin and general_manager can add users
        if (profile?.role !== 'super_admin' && profile?.role !== 'general_manager') {
            showAppToast('❌ Access Denied: Only super_admin and general_manager can add users');
            return false;
        }

        if (!email || !name) {
            showAppToast('❌ Email and Name are required');
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showAppToast('❌ Invalid email format. Please use a valid email address (e.g., user@gmail.com, user@company.com)');
            return false;
        }

        try {
            const { data: { session: adminSession } } = await supabase.auth.getSession();
            const tempPassword = `${Math.random().toString(36).slice(-10)}A1!`;

            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password: tempPassword,
                options: {
                    data: {
                        full_name: name,
                        performer_name: name,
                        onboarding: 'signup',
                    },
                    emailRedirectTo: getAuthRedirectUrl(),
                },
            });

            if (authError) throw authError;
            if (!authData?.user?.id) throw new Error('User creation failed — no user id returned');

            // signUp can replace the admin session; restore it before profile updates
            const { data: { session: postSignUpSession } } = await supabase.auth.getSession();
            if (adminSession && postSignUpSession?.user?.id !== adminSession.user.id) {
                await supabase.auth.setSession({
                    access_token: adminSession.access_token,
                    refresh_token: adminSession.refresh_token,
                });
            }

            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    performer_name: name,
                    role,
                    client_id: 'DEFAULT_CLIENT',
                    email,
                    onboarding: 'signup',
                })
                .eq('id', authData.user.id);

            if (profileError && /onboarding/i.test(profileError.message || '')) {
                const { error: retryError } = await supabase
                    .from('profiles')
                    .update({
                        performer_name: name,
                        role,
                        client_id: 'DEFAULT_CLIENT',
                        email,
                    })
                    .eq('id', authData.user.id);
                if (retryError) throw retryError;
            } else if (profileError) {
                throw profileError;
            }

            showAppToast(`✅ User "${name}" created with ${role} role. Confirmation email sent to ${email}.`);
            fetchAllProfiles();
            return true;
        } catch (error) {
            showAppToast('❌ Error adding user: ' + error.message);
            return false;
        }
    };

    const getDivisionTargetOverride = (task, client, subDiv) => {
        const canonicalTask = normalizeTaskType(task);
        return divisionTargets.find((t) =>
            t.client_id === client &&
            t.sub_division === subDiv &&
            normalizeTaskType(t.task_type) === canonicalTask
        );
    };

    const getTargetForEntry = (task, client, subDiv) => {
        if (task === 'Miscellaneous') return 0;
        const custom = getDivisionTargetOverride(task, client, subDiv);
        if (custom) return Number(custom.target_value);
        const canonicalTask = normalizeTaskType(task);
        return STANDARD_TARGETS[canonicalTask] || STANDARD_TARGETS[task] || 0;
    };

    const handleDeleteEntry = async (id) => {
        if (!['super_admin', 'general_manager', 'manager'].includes(profile?.role)) {
            showAppToast('❌ Access Denied: Only managers can delete entries');
            return;
        }
        if (!window.confirm('Delete this entry?')) return;
        try {
            const existing = statusEntries.find((e) => e.id === id);
            const { error } = await supabase.from('status_entries').delete().eq('id', id);
            if (error) throw error;
            setStatusEntries(prev => prev.filter(e => e.id !== id));
            showAppToast('🗑️ Entry deleted');
            if (notificationsEnabled && existing?.user_id && existing.user_id !== session?.user?.id) {
                notifyDailyTrackerEvent({
                    type: 'entry_deleted',
                    receiverIds: [existing.user_id],
                    title: 'Daily entry deleted',
                    message: `${profile?.performer_name || 'A manager'} deleted your entry for ${existing.date || 'a date'}`,
                    senderId: session?.user?.id,
                    entryId: null,
                }).catch(() => {});
            }
        } catch (err) {
            showAppToast('❌ Error: ' + err.message);
        }
    };

    const handleAdminEmailInvite = async ({ email, role }) => {
        if (profile?.role !== 'super_admin' && profile?.role !== 'general_manager') {
            showAppToast('❌ Access Denied: Only super_admin and general_manager can send invites');
            return false;
        }
        if (!isValidEmail(email)) {
            showAppToast('❌ Enter a valid email address');
            return false;
        }

        try {
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
                    action: 'invite',
                    email: email.trim().toLowerCase(),
                    role,
                    displayName: deriveDisplayNameFromEmail(email),
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok || !payload.ok) {
                throw new Error(payload.error || `Invite failed (${res.status})`);
            }

            showAppToast(`✅ Invite sent to ${email}`);
            fetchAllProfiles();
            return true;
        } catch (err) {
            showAppToast('❌ ' + (err.message || 'Invite failed'));
            return false;
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
        );
    }

    if (view === 'invite-accept') {
        return <InviteAccept setView={setView} authCallbackError={authCallbackError} />;
    }

    if (view === 'reset-password') {
        return <ResetPassword setView={setView} authCallbackError={authCallbackError} />;
    }

    if (!session) {
        if (view === 'landing') return <LandingPage onGetStarted={() => setView('login')} />;
        if (view === 'signup') return <Signup setView={setView} />;
        if (view === 'forgot-password') return <ForgotPassword setView={setView} />;
        return <Login setView={setView} authCallbackError={authCallbackError} />;
    }

    if (view === 'signup') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
                <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-10 border border-gray-100 dark:border-gray-800 text-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Already signed in</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                        Log out first to register a new account, or continue to the app.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setView('app')}
                            className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl text-sm"
                        >
                            Go to App
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex-1 py-3 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold rounded-xl text-sm"
                        >
                            Log out
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    let tabContent = (
        <DailyTaskForm
            session={session}
            profile={profile}
            statusEntries={statusEntries}
            accessibleProfiles={accessibleProfiles}
            divisionTargets={divisionTargets}
            clients={clients}
            isSyncing={isSyncing}
            setIsSyncing={setIsSyncing}
            onRefresh={fetchFromSupabase}
            onToast={showAppToast}
            summarySlot={
                <DailySummary
                    entries={statusEntries}
                    profile={profile}
                    accessibleProfiles={accessibleProfiles}
                    onDeleteEntry={handleDeleteEntry}
                    onRefresh={fetchFromSupabase}
                    isSyncing={isSyncing}
                    canDeleteEntry={canDeleteEntry}
                    divisionTargets={divisionTargets}
                    getTargetForEntry={getTargetForEntry}
                />
            }
        />
    );

    if (activeTab === 'dashboard') {
        tabContent = (
            <Dashboard
                entries={statusEntries}
                userProfile={profile}
                clients={clients}
                divisionTargets={divisionTargets}
                onRefreshTargets={fetchDivisionTargets}
                supabase={supabase}
                accessibleProfiles={accessibleProfiles}
                analyticsDeepLink={analyticsDeepLink}
                onDeepLinkConsumed={() => setAnalyticsDeepLink(null)}
            />
        );
    } else if (activeTab === 'projects') {
        tabContent = (
            <ProjectDatabaseManager
                supabase={supabase}
                session={session}
                profile={profile}
                allProfiles={allProfiles}
                clients={clients}
            />
        );
    } else if (activeTab === 'request_hub' && requestHubEnabled) {
        tabContent = (
            <SmartRequestHub
                profile={profile}
                initialTicketId={requestHubTicketId}
                onToast={showAppToast}
            />
        );
    } else if (activeTab === 'super_admin') {
        tabContent = (
            <AdminUsersPanel
                profile={profile}
                session={session}
                allProfiles={allProfiles}
                clients={clients}
                isAdminSyncing={isAdminSyncing}
                onRefreshProfiles={fetchAllProfiles}
                onUpdateUserRole={handleUpdateUserRole}
                onDeleteUser={handleDeleteUser}
                onAddUser={handleAddNewUser}
                onAdminEmailInvite={handleAdminEmailInvite}
                onManagePassword={openAdminPasswordModal}
                onToast={showAppToast}
            />
        );
    }

    return (
        <>
            <AppShell
                profile={profile}
                session={session}
                darkMode={darkMode}
                setDarkMode={setDarkMode}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onLogout={handleLogout}
                onChangePassword={() => setShowChangePasswordModal(true)}
                onAdminResetPassword={() => openAdminPasswordModal()}
                requestHubEnabled={requestHubEnabled}
                notificationsEnabled={notificationsEnabled}
                showToast={showToast}
                toastMessage={toastMessage}
                onToastDone={() => setShowToast(false)}
            >
                {tabContent}
            </AppShell>

            {showChangePasswordModal && (
                <ChangePassword
                    profile={profile}
                    onClose={() => setShowChangePasswordModal(false)}
                />
            )}

            {adminPasswordModal && (
                <AdminResetUserPassword
                    key={`${adminPasswordModal.userId || 'any'}-${adminPasswordModal.mode}`}
                    profile={profile}
                    session={session}
                    allProfiles={allProfiles}
                    initialUserId={adminPasswordModal.userId}
                    initialMode={adminPasswordModal.mode}
                    onClose={() => setAdminPasswordModal(null)}
                    onPasswordReset={() => fetchAllProfiles()}
                />
            )}
        </>
    );
};

export default App;
