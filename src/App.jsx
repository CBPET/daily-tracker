import { useState, useEffect, useRef } from 'react';
import Modal from './components/Modal';
import Toast from './components/Toast';
import Dashboard from './components/Dashboard';
import DailySummary from './components/DailySummary';
import Login from './components/Login';
import Signup from './components/Signup';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import InviteAccept from './components/InviteAccept';
import LandingPage from './components/LandingPage';
import WorkflowManager from './components/WorkflowManager';
import UserManagement from './components/UserManagement';
import ChangePassword from './components/ChangePassword';
import AdminResetUserPassword from './components/AdminResetUserPassword';
import AdminUserRow from './components/AdminUserRow';
import ClientManagement from './components/ClientManagement';
import SmartRequestHub from './components/requestHub/SmartRequestHub';
import { NotificationProvider } from './components/notifications/NotificationProvider';
import NotificationBell from './components/notifications/NotificationBell';
import NotificationDrawer from './components/notifications/NotificationDrawer';
import NotificationCenter from './components/notifications/NotificationCenter';
import { supabase, formatAuthClientError } from './lib/supabase';
import {
    completeAuthCallback,
    isRecoveryCallback,
    isInviteCallback,
    isAuthCallbackUrl,
    isSignupConfirmFromUrl,
    sanitizeAuthUrl,
    getAuthRedirectUrl,
} from './lib/authRedirect';
import { parseAnalyticsHash } from './lib/performanceRating';
import { deriveDisplayNameFromEmail, isValidEmail } from './lib/displayName';
import { isSmartRequestHubEnabled, isNotificationsEnabled, isEntryDuplicateGuardEnabled } from './lib/featureFlags';
import { notifyDailyTrackerEvent } from './lib/notifications/notificationRules';
import {
    STANDARD_TARGETS,
    STANDARD_WORK_HOURS_PER_DAY,
    TARGET_INFO_ROWS,
    TARGET_UNITS,
    calcEstimatedHours,
    normalizeTaskType,
} from './lib/targetUtils';
import {
    LayoutDashboard,
    ClipboardList,
    RefreshCw,
    LogOut,
    User,
    ShieldCheck,
    Briefcase,
    Loader2,
    Users,
    Settings,
    Search,
    UserPlus,
    Mail,
    Copy,
    Check,
    Trash2,
    Lock,
    KeyRound,
    Inbox,
    Info,
} from 'lucide-react';

const App = () => {
    // ── Hash Routing Constants ──
    const HASH_TO_TAB = { form: 'form', analytics: 'dashboard', 'request-hub': 'request_hub', admin: 'super_admin' };
    const TAB_TO_HASH = { form: 'form', dashboard: 'analytics', request_hub: 'request-hub', super_admin: 'admin' };
    // App-tab hashes that should resolve to the app view when authenticated
    const APP_HASHES = new Set(['form', 'analytics', 'request-hub', 'admin']);
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
    const getTodayISO = () => new Date().toISOString().slice(0, 10);
    const [performerName, setPerformerName] = useState('');
    const [titleName, setTitleName] = useState('');
    const [batchFlow, setBatchFlow] = useState(false);
    const [batchNumber, setBatchNumber] = useState('');
    const [completedPages, setCompletedPages] = useState('');
    const [castOffPages, setCastOffPages] = useState('');
    const [taskType, setTaskType] = useState('');
    const [estimatedTime, setEstimatedTime] = useState('');
    const [takenTime, setTakenTime] = useState('');
    const [entryDate, setEntryDate] = useState(getTodayISO);
    const [statusEntries, setStatusEntries] = useState([]);
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('cbpet_darkMode') === 'true');
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [accessibleProfiles, setAccessibleProfiles] = useState([]);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [showTargetInfoModal, setShowTargetInfoModal] = useState(false);
    const [activeTab, setActiveTab] = useState(getInitialTab);
    const [isSyncing, setIsSyncing] = useState(false);
    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState('');
    const [selectedSubDivision, setSelectedSubDivision] = useState('');
    const [divisionTargets, setDivisionTargets] = useState([]);

    // ── Admin State ──
    const [allProfiles, setAllProfiles] = useState([]);
    const [isAdminSyncing, setIsAdminSyncing] = useState(false);
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
    const [adminSubTab, setAdminSubTab] = useState('users'); // 'users' or 'workflows'
    
    // ── Password Management State ──
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
    const [showAdminResetPasswordModal, setShowAdminResetPasswordModal] = useState(false);

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
            if (data.performer_name) setPerformerName(data.performer_name);
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
            if (['super_admin', 'general_manager', 'manager'].includes(profile.role)) fetchAllProfiles();
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
        if (!['super_admin', 'general_manager', 'manager'].includes(profile?.role)) return;
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

    const canSelectPerformerOnForm = ['super_admin', 'general_manager', 'manager'].includes(profile?.role);

    useEffect(() => {
        if (!profile) return;
        
        if (!canSelectPerformerOnForm || performerName === profile.performer_name) {
            setSelectedClient(profile.client_id || 'DEFAULT_CLIENT');
            setSelectedSubDivision(profile.sub_division || '');
        } else {
            const selectedProf = accessibleProfiles.find(p => p.performer_name === performerName);
            if (selectedProf) {
                setSelectedClient(selectedProf.client_id || 'DEFAULT_CLIENT');
                setSelectedSubDivision(selectedProf.sub_division || '');
            }
        }
    }, [performerName, profile, accessibleProfiles, canSelectPerformerOnForm]);

    const handleUpdateUserRole = async (userId, newRole, clientId) => {
        // RBAC: Only super_admin and general_manager can update users
        if (profile?.role !== 'super_admin' && profile?.role !== 'general_manager') {
            setToastMessage('❌ Access Denied: Only super_admin and general_manager can update users');
            setShowToast(true);
            return;
        }

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole, client_id: clientId })
                .eq('id', userId);

            if (error) throw error;
            setToastMessage('✅ User updated successfully');
            setShowToast(true);
            fetchAllProfiles();
        } catch (error) {
            setToastMessage('❌ Error updating user: ' + error.message);
            setShowToast(true);
        }
    };

    const handleDeleteUser = async (userId) => {
        // RBAC: Only super_admin and general_manager can delete users
        if (profile?.role !== 'super_admin' && profile?.role !== 'general_manager') {
            setToastMessage('❌ Access Denied: Only super_admin and general_manager can delete users');
            setShowToast(true);
            return;
        }

        if (!window.confirm('Are you sure you want to delete this user profile? This removes their access metadata.')) return;
        try {
            const { error } = await supabase.from('profiles').delete().eq('id', userId);
            if (error) throw error;
            setToastMessage('🗑️ User profile removed');
            setShowToast(true);
            fetchAllProfiles();
        } catch (error) {
            setToastMessage('❌ Error deleting user: ' + error.message);
            setShowToast(true);
        }
    };

    const handleAddNewUser = async (e) => {
        e.preventDefault();

        // RBAC: Only super_admin and general_manager can add users
        if (profile?.role !== 'super_admin' && profile?.role !== 'general_manager') {
            setToastMessage('❌ Access Denied: Only super_admin and general_manager can add users');
            setShowToast(true);
            return;
        }

        // Validate inputs
        if (!newUserEmail || !newUserName) {
            setToastMessage('❌ Email and Name are required');
            setShowToast(true);
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newUserEmail)) {
            setToastMessage('❌ Invalid email format. Please use a valid email address (e.g., user@gmail.com, user@company.com)');
            setShowToast(true);
            return;
        }

        try {
            const { data: { session: adminSession } } = await supabase.auth.getSession();
            const tempPassword = `${Math.random().toString(36).slice(-10)}A1!`;

            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: newUserEmail,
                password: tempPassword,
                options: {
                    data: {
                        full_name: newUserName,
                        performer_name: newUserName,
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
                    performer_name: newUserName,
                    role: newUserRole,
                    client_id: 'DEFAULT_CLIENT',
                    email: newUserEmail,
                    onboarding: 'signup',
                })
                .eq('id', authData.user.id);

            if (profileError && /onboarding/i.test(profileError.message || '')) {
                const { error: retryError } = await supabase
                    .from('profiles')
                    .update({
                        performer_name: newUserName,
                        role: newUserRole,
                        client_id: 'DEFAULT_CLIENT',
                        email: newUserEmail,
                    })
                    .eq('id', authData.user.id);
                if (retryError) throw retryError;
            } else if (profileError) {
                throw profileError;
            }

            setToastMessage(`✅ User "${newUserName}" created with ${newUserRole} role. Confirmation email sent to ${newUserEmail}.`);
            setShowToast(true);
            setShowAddUserModal(false);
            setNewUserEmail('');
            setNewUserName('');
            setNewUserRole('performer');
            fetchAllProfiles();
        } catch (error) {
            setToastMessage('❌ Error adding user: ' + error.message);
            setShowToast(true);
        }
    };

    const syncToSupabase = async (newEntry) => {
        if (!supabase || !session) return;
        try {
            const entryWithAuth = {
                id: newEntry.id,
                date: newEntry.date,
                performerName: newEntry.performerName,
                titleName: newEntry.titleName,
                completedPages: newEntry.completedPages,
                taskType: newEntry.taskType,
                estimatedTime: newEntry.estimatedTime,
                takenTime: newEntry.takenTime,
                timeAchieved: newEntry.timeAchieved,
                targetAchieved: newEntry.targetAchieved,
                status: newEntry.status,
                user_id: session.user.id,
                client_id: newEntry.client_id || 'DEFAULT_CLIENT',
                sub_division: newEntry.sub_division || null,
                batch_number: newEntry.batch_number ?? null,
            };
            const { error } = await supabase.from('status_entries').insert([entryWithAuth]);
            if (error) throw error;
        } catch (error) {
            console.error('Error syncing:', error.message);
            setToastMessage('❌ Sync failed: ' + error.message);
            setShowToast(true);
        }
    };

    // ── Config ──
    const MIN_HOURS = 1;
    const MAX_HOURS = 4;
    const standardTargets = STANDARD_TARGETS;
    // Selectable task types; Miscellaneous has no productivity target
    const taskTypeOptions = [...Object.keys(standardTargets).filter((task) => task !== 'FL Validation'), 'Miscellaneous'];
    const MOTIVATIONAL_MESSAGE = 'Keep Trying!';

    const getDivisionTargetOverride = (task, client, subDiv) => {
        const canonicalTask = normalizeTaskType(task);
        return divisionTargets.find(t =>
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
        return standardTargets[canonicalTask] || standardTargets[task] || 0;
    };

    const isPositiveHours = (value) => {
        const n = Number(value);
        return Number.isFinite(n) && n > 0;
    };

    const isMiscHoursInRange = (value) => {
        const n = Number(value);
        return Number.isFinite(n) && n >= MIN_HOURS && n <= MAX_HOURS;
    };

    const timeAchievedPercentage = estimatedTime > 0 && takenTime > 0 ? ((estimatedTime / takenTime) * 100).toFixed(2) : 0;

    const activeTargetVal = taskType ? getTargetForEntry(taskType, selectedClient, selectedSubDivision) : 0;
    const isMiscellaneous = taskType === 'Miscellaneous';
    const activeTargetOverride = taskType ? getDivisionTargetOverride(taskType, selectedClient, selectedSubDivision) : null;
    const activeTargetSource = activeTargetOverride ? 'Division Override' : 'Standard Target';
    const activeTargetUnit = TARGET_UNITS[normalizeTaskType(taskType)] || TARGET_UNITS[taskType] || 'items/day';
    const isTitlesTask = activeTargetUnit.startsWith('titles');
    const titlesMax = isTitlesTask ? Math.max(Number(activeTargetVal) || 4, 8) : 0;
    const completedWorkMeta = (() => {
        if (!taskType) {
            return { label: 'Completed Work', placeholder: '150', unitWord: 'item' };
        }
        if (activeTargetUnit.startsWith('titles')) {
            return { label: 'Completed Titles', placeholder: '1', unitWord: 'title' };
        }
        if (activeTargetUnit.startsWith('refs')) {
            return { label: 'Completed References', placeholder: '50', unitWord: 'ref' };
        }
        if (activeTargetUnit.startsWith('pages')) {
            return { label: 'Completed Pages', placeholder: '150', unitWord: 'page' };
        }
        return { label: 'Completed Work', placeholder: '150', unitWord: 'item' };
    })();
    const hoursPerUnit =
        !isMiscellaneous && activeTargetVal > 0
            ? Number((STANDARD_WORK_HOURS_PER_DAY / activeTargetVal).toFixed(2))
            : 0;
    const targetAchievedPercentage = !isMiscellaneous && taskType && activeTargetVal > 0 && takenTime > 0
        ? ((completedPages / ((activeTargetVal / STANDARD_WORK_HOURS_PER_DAY) * takenTime)) * 100).toFixed(2) : 0;

    const prevTaskUnitRef = useRef('');
    useEffect(() => {
        const prevUnit = prevTaskUnitRef.current;
        if (isTitlesTask && !String(prevUnit).startsWith('titles')) {
            setCompletedPages('1');
            setCastOffPages('');
        }
        if (!isTitlesTask && String(prevUnit).startsWith('titles')) {
            setCastOffPages('');
        }
        prevTaskUnitRef.current = taskType ? activeTargetUnit : '';
    }, [taskType, activeTargetUnit, isTitlesTask]);

    useEffect(() => {
        if (!taskType) {
            setEstimatedTime('');
            return;
        }
        if (isMiscellaneous) {
            setEstimatedTime('');
            return;
        }
        // Titles tasks (Cast-off): never estimate from page-sized counts
        if (isTitlesTask) {
            const titles = Number(completedPages);
            if (!Number.isFinite(titles) || titles <= 0 || titles > titlesMax) {
                setEstimatedTime('');
                return;
            }
        }
        const autoEstimatedHours = calcEstimatedHours(taskType, completedPages, activeTargetVal);
        setEstimatedTime(autoEstimatedHours > 0 ? autoEstimatedHours.toFixed(2) : '');
    }, [taskType, completedPages, activeTargetVal, isMiscellaneous, isTitlesTask, titlesMax]);

    // ── Handlers ──
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!performerName || !titleName || !completedPages || !taskType || !estimatedTime || !takenTime || !entryDate) {
            setShowErrorModal(true);
            return;
        }
        if (batchFlow && !batchNumber) {
            setToastMessage('❌ Batch Number is required when Batch flow is enabled');
            setShowToast(true);
            return;
        }
        if (isTitlesTask) {
            const titles = Number(completedPages);
            if (!Number.isFinite(titles) || titles <= 0 || titles > titlesMax) {
                setToastMessage(`❌ Cast-off uses titles only (1–${titlesMax}). Enter title count, not pages.`);
                setShowToast(true);
                return;
            }
        }
        if (isEntryDuplicateGuardEnabled()) {
            const dup = statusEntries.find(
                (e) =>
                    String(e.date).slice(0, 10) === entryDate &&
                    e.titleName === titleName.trim() &&
                    e.taskType === taskType &&
                    (e.performerName === performerName.trim() || e.user_id === session?.user?.id)
            );
            if (dup) {
                const edit = window.confirm('Already Submitted. Edit Existing?');
                if (!edit) return;
            }
        }
        if (isMiscellaneous) {
            if (!isMiscHoursInRange(estimatedTime) || !isMiscHoursInRange(takenTime)) {
                setToastMessage(`❌ Miscellaneous Estimated and Taken Hours must be between ${MIN_HOURS} and ${MAX_HOURS}`);
                setShowToast(true);
                return;
            }
        } else if (!isPositiveHours(estimatedTime) || !isPositiveHours(takenTime)) {
            setToastMessage('❌ Estimated and Taken Hours must be greater than 0');
            setShowToast(true);
            return;
        }
        const achievementStatus = isMiscellaneous
            ? 'N/A'
            : (Number(targetAchievedPercentage) >= 100 ? 'Achieved' : MOTIVATIONAL_MESSAGE);
        const newEntry = {
            id: Date.now(), date: entryDate, performerName: performerName.trim(),
            titleName: titleName.trim(), completedPages: Number(completedPages), taskType,
            estimatedTime: Number(estimatedTime), takenTime: Number(takenTime),
            timeAchieved: timeAchievedPercentage,
            targetAchieved: isMiscellaneous ? 0 : targetAchievedPercentage,
            status: achievementStatus,
            client_id: selectedClient || 'DEFAULT_CLIENT',
            sub_division: selectedSubDivision || null,
            batch_number: batchFlow && batchNumber ? Number(batchNumber) : null,
        };
        setStatusEntries(prev => [newEntry, ...prev]);
        await syncToSupabase(newEntry);
        setTitleName(''); setBatchFlow(false); setBatchNumber(''); setCompletedPages(''); setCastOffPages(''); setTaskType(''); setEstimatedTime(''); setTakenTime('');
        setToastMessage('✅ Status saved and synced!'); setShowToast(true);
        if (notificationsEnabled && canSelectPerformerOnForm && performerName !== profile?.performer_name) {
            const selectedProf = accessibleProfiles.find((p) => p.performer_name === performerName);
            if (selectedProf?.id && selectedProf.id !== session?.user?.id) {
                notifyDailyTrackerEvent({
                    type: 'entry_on_behalf',
                    receiverIds: [selectedProf.id],
                    title: 'Entry logged on your behalf',
                    message: `${profile?.performer_name || 'A manager'} logged an entry for ${entryDate}`,
                    senderId: session?.user?.id,
                    entryId: null,
                }).catch(() => {});
            }
        }
    };

    const handleDeleteEntry = async (id) => {
        if (!['super_admin', 'general_manager', 'manager'].includes(profile?.role)) {
            setToastMessage('❌ Access Denied: Only managers can delete entries');
            setShowToast(true);
            return;
        }
        if (!window.confirm('Delete this entry?')) return;
        try {
            const existing = statusEntries.find((e) => e.id === id);
            const { error } = await supabase.from('status_entries').delete().eq('id', id);
            if (error) throw error;
            setStatusEntries(prev => prev.filter(e => e.id !== id));
            setToastMessage('🗑️ Entry deleted');
            setShowToast(true);
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
            setToastMessage('❌ Error: ' + err.message);
            setShowToast(true);
        }
    };

    const handleAdminEmailInvite = async (e) => {
        e.preventDefault();
        if (profile?.role !== 'super_admin' && profile?.role !== 'general_manager') {
            setToastMessage('❌ Access Denied: Only super_admin and general_manager can send invites');
            setShowToast(true);
            return;
        }
        if (!isValidEmail(inviteEmail)) {
            setToastMessage('❌ Enter a valid email address');
            setShowToast(true);
            return;
        }

        setInviteSending(true);
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
                    email: inviteEmail.trim().toLowerCase(),
                    role: inviteRole,
                    displayName: deriveDisplayNameFromEmail(inviteEmail),
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok || !payload.ok) {
                throw new Error(payload.error || `Invite failed (${res.status})`);
            }

            setToastMessage(`✅ Invite sent to ${inviteEmail}`);
            setShowToast(true);
            setShowAdminEmailInviteModal(false);
            setInviteEmail('');
            setInviteRole('performer');
            fetchAllProfiles();
        } catch (err) {
            setToastMessage('❌ ' + (err.message || 'Invite failed'));
            setShowToast(true);
        } finally {
            setInviteSending(false);
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

    return (
        <NotificationProvider enabled={notificationsEnabled}>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-100 p-4 transition-colors duration-300 font-sans">
                <Toast show={showToast} message={toastMessage} onDone={() => setShowToast(false)} />
                <NotificationDrawer />
                <NotificationCenter />

                <nav className="container mx-auto max-w-7xl mb-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">CBPET Tracker</h1>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700">{profile?.role || 'Performer'}</span>
                                {profile?.client_id && <span>• {profile.client_id}</span>}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs font-bold font-mono">
                            <User size={14} className="text-gray-400" />
                            <span>{session.user.email}</span>
                        </div>
                        <NotificationBell />
                        <button 
                            onClick={() => setShowChangePasswordModal(true)} 
                            className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition-colors"
                            title="Change Your Password"
                            aria-label="Change your password"
                        >
                            <Lock size={18} />
                        </button>
                        {(profile?.role === 'super_admin' || profile?.role === 'general_manager') && (
                            <button 
                                onClick={() => setShowAdminResetPasswordModal(true)} 
                                className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors"
                                title="Reset User Password"
                                aria-label="Reset user password"
                            >
                                <KeyRound size={18} />
                            </button>
                        )}
                        <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
                            {darkMode ? '☀️' : '🌙'}
                        </button>
                        <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl font-bold transition-all text-sm uppercase tracking-widest">
                            <LogOut size={18} />
                            Logout
                        </button>
                    </div>
                </nav>

                <div className="container mx-auto max-w-7xl mb-8 flex justify-center">
                    <div className="bg-white dark:bg-gray-900 p-1.5 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 flex gap-2 overflow-x-auto">
                        <button onClick={() => setActiveTab('form')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${activeTab === 'form' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                            <ClipboardList size={18} />Entry Form
                        </button>
                        <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                            <LayoutDashboard size={18} />Analytics
                        </button>
                        {requestHubEnabled && (
                            <button onClick={() => setActiveTab('request_hub')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${activeTab === 'request_hub' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                <Inbox size={18} />Smart Request Hub
                            </button>
                        )}
                        {['super_admin', 'general_manager', 'manager'].includes(profile?.role) && (
                            <button onClick={() => { setActiveTab('super_admin'); setAdminSubTab('users'); }} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${activeTab === 'super_admin' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                <Users size={18} />Administration
                            </button>
                        )}
                    </div>
                </div>

                <div className="container mx-auto max-w-7xl bg-white dark:bg-gray-900 rounded-3xl p-6 md:p-10 shadow-xl border border-gray-100 dark:border-gray-800 min-h-[600px]">
                    {activeTab === 'dashboard' ? (
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
                    ) : activeTab === 'request_hub' && requestHubEnabled ? (
                        <SmartRequestHub
                            profile={profile}
                            initialTicketId={requestHubTicketId}
                            onToast={(msg) => { setToastMessage(msg); setShowToast(true); }}
                        />
                    ) : activeTab === 'super_admin' ? (
                        <div className="space-y-8">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-black flex items-center gap-3">
                                    <Users className="text-purple-600" />
                                    System Administration
                                </h2>
                                <div className="flex gap-2">
                                    {adminSubTab === 'users' && (
                                        <>
                                            {(profile?.role === 'super_admin' || profile?.role === 'general_manager') && (
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
                                        onClick={adminSubTab === 'users' ? fetchAllProfiles : null}
                                        disabled={adminSubTab === 'users' ? isAdminSyncing : false}
                                        className={`p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 rounded-lg ${adminSubTab === 'users' && isAdminSyncing ? 'animate-spin' : ''}`}
                                        aria-label="Refresh user list"
                                    >
                                        <RefreshCw size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Admin SubTabs */}
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
                            </div>

                            {/* USER MANAGEMENT SECTION */}
                            {adminSubTab === 'users' && ['super_admin', 'general_manager', 'manager'].includes(profile?.role) ? (
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
                                    {/* Search Bar */}
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
                                                        onUpdate={handleUpdateUserRole}
                                                        onDelete={handleDeleteUser}
                                                        isSelf={p.id === session.user.id}
                                                        currentUserRole={profile?.role}
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
                                    onRefresh={fetchAllProfiles}
                                />
                            ) : adminSubTab === 'clients' ? (
                                <ClientManagement
                                    supabase={supabase}
                                    session={session}
                                    profile={profile}
                                    allProfiles={allProfiles}
                                    onRefresh={fetchAllProfiles}
                                />
                            ) : null}

                            {/* MODALS - Outside main conditional so always available */}
                            {/* Admin Invite Modal */}
                            {showAdminEmailInviteModal && adminSubTab === 'users' && (
                                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                                    <div className="bg-white dark:bg-gray-900 rounded-[40px] p-10 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-gray-800 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-3xl" />

                                        <h3 className="text-2xl font-black mb-2 tracking-tight">Admin Invite</h3>
                                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 font-medium">
                                            Send an invite email. The user opens the link, confirms display name, and sets a password.
                                        </p>

                                        <form onSubmit={handleAdminEmailInvite} className="space-y-6">
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

                            {/* Add New User Modal */}
                            {showAddUserModal && adminSubTab === 'users' && (
                                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                                    <div className="bg-white dark:bg-gray-900 rounded-[40px] p-10 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-gray-800 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full -mr-16 -mt-16 blur-3xl" />

                                        <h3 className="text-2xl font-black mb-2 tracking-tight">Add New User</h3>
                                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 font-medium">Create a new team member with assigned role and permissions.</p>

                                        <form onSubmit={handleAddNewUser} className="space-y-6">
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
                                                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none focus:border-green-500 font-bold text-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:20px_20px] bg-[right_1rem_center] bg-no-repeat pr-10"
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

                            {/* Provision User Modal */}
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
                                                            setToastMessage('📋 Signup link copied!');
                                                            setShowToast(true);
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
                                                        setToastMessage('📩 Invite message copied!');
                                                        setShowToast(true);
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

                    ) : (
                        <div className="flex flex-col lg:flex-row gap-12">
                            <div className="flex-1 max-w-xl">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600"><Briefcase size={24} /></div>
                                    <h2 className="text-2xl font-bold">Add Task</h2>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Performer</label>
                                            {canSelectPerformerOnForm ? (
                                                <select
                                                    value={performerName}
                                                    onChange={e => setPerformerName(e.target.value)}
                                                    className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:20px_20px] bg-[right_1rem_center] bg-no-repeat"
                                                >
                                                    <option value={profile.performer_name}>{profile.performer_name} (You)</option>
                                                    {accessibleProfiles.filter(p => p.id !== session.user.id).map(p => (
                                                        <option key={p.id} value={p.performer_name}>{p.performer_name}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input type="text" value={performerName} readOnly className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 cursor-not-allowed font-medium" />
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Date</label>
                                            <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium" required />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Client</label>
                                            {canSelectPerformerOnForm ? (
                                                <select
                                                    value={selectedClient}
                                                    onChange={e => setSelectedClient(e.target.value)}
                                                    className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:20px_20px] bg-[right_1rem_center] bg-no-repeat"
                                                >
                                                    <option value="DEFAULT_CLIENT">DEFAULT_CLIENT</option>
                                                    {clients.map(c => (
                                                        <option key={c.id} value={c.code}>{c.code}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input type="text" value={selectedClient || 'DEFAULT_CLIENT'} readOnly className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 cursor-not-allowed font-medium uppercase" />
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Sub-division</label>
                                            {canSelectPerformerOnForm ? (
                                                <select
                                                    value={selectedSubDivision}
                                                    onChange={e => setSelectedSubDivision(e.target.value)}
                                                    className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:20px_20px] bg-[right_1rem_center] bg-no-repeat pr-10"
                                                >
                                                    <option value="">None</option>
                                                    <option value="PreEdit">PreEdit</option>
                                                    <option value="Validation">Validation</option>
                                                </select>
                                            ) : (
                                                <input type="text" value={selectedSubDivision || 'None'} readOnly className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 cursor-not-allowed font-medium" />
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Project/Title Name</label>
                                        <input type="text" value={titleName} onChange={e => setTitleName(e.target.value)} className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium" placeholder="e.g., Springer Nature Vol 42" required />
                                    </div>

                                    <div>
                                        <label className="inline-flex items-center gap-2 cursor-pointer select-none mb-2 ml-1">
                                            <input
                                                type="checkbox"
                                                checked={batchFlow}
                                                onChange={(e) => {
                                                    const on = e.target.checked;
                                                    setBatchFlow(on);
                                                    if (!on) setBatchNumber('');
                                                }}
                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Batch flow</span>
                                        </label>
                                        {batchFlow && (
                                            <>
                                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">
                                                    Batch Number <span className="text-red-500 normal-case tracking-normal">(required)</span>
                                                </label>
                                                <select
                                                    value={batchNumber}
                                                    onChange={(e) => setBatchNumber(e.target.value)}
                                                    required
                                                    className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none font-medium"
                                                >
                                                    <option value="">Select batch</option>
                                                    {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => (
                                                        <option key={n} value={n}>Batch {n}</option>
                                                    ))}
                                                </select>
                                            </>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <div className="flex items-center justify-between gap-3 mb-2 ml-1">
                                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400">Task Type</label>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowTargetInfoModal(true)}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                                >
                                                    <Info size={13} /> Target Info
                                                </button>
                                            </div>
                                            <select value={taskType} onChange={e => setTaskType(e.target.value)} className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:20px_20px] bg-[right_1rem_center] bg-no-repeat font-medium" required>
                                                <option value="">Select Task</option>
                                                {taskTypeOptions.map(k => <option key={k} value={k}>{k}</option>)}
                                            </select>
                                            {taskType && !isMiscellaneous ? (
                                                <p className="text-[10px] text-gray-400 mt-1 ml-1">
                                                    Target: {activeTargetVal} {activeTargetUnit} · Source: {activeTargetSource}
                                                </p>
                                            ) : null}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">{completedWorkMeta.label}</label>
                                            <input
                                                type="number"
                                                value={completedPages}
                                                onChange={e => setCompletedPages(e.target.value)}
                                                className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                                                placeholder={completedWorkMeta.placeholder}
                                                min={isTitlesTask ? 1 : undefined}
                                                max={isTitlesTask ? titlesMax : undefined}
                                                step={isTitlesTask ? 1 : undefined}
                                                required
                                            />
                                            {isTitlesTask ? (
                                                <p className="text-[10px] text-gray-400 mt-1 ml-1">
                                                    Used for estimate · Max {titlesMax}
                                                    {hoursPerUnit > 0 ? ` · 1 title ≈ ${hoursPerUnit.toFixed(2)}h` : ''}
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>

                                    {isTitlesTask ? (
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Pages</label>
                                            <input
                                                type="number"
                                                value={castOffPages}
                                                onChange={(e) => setCastOffPages(e.target.value)}
                                                className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                                                placeholder="Optional — not used in estimate"
                                                min={0}
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1 ml-1">
                                                Reference only — does not affect Estimated Hours or scores
                                            </p>
                                        </div>
                                    ) : null}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Estimated Hours</label>
                                            <input
                                                type="number"
                                                value={estimatedTime}
                                                onChange={e => setEstimatedTime(e.target.value)}
                                                className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                                                step="0.1"
                                                min={isMiscellaneous ? MIN_HOURS : 0.1}
                                                max={isMiscellaneous ? MAX_HOURS : undefined}
                                                placeholder={isMiscellaneous ? '1.0 – 4.0' : 'Auto'}
                                                readOnly={!isMiscellaneous}
                                                required
                                            />
                                            {isMiscellaneous ? (
                                                <p className="text-[10px] text-gray-400 mt-1 ml-1">Miscellaneous only: {MIN_HOURS}–{MAX_HOURS} hours</p>
                                            ) : hoursPerUnit > 0 ? (
                                                <p className="text-[10px] text-gray-400 mt-1 ml-1">
                                                    1 {completedWorkMeta.unitWord} ≈ {hoursPerUnit.toFixed(2)}h
                                                    {completedPages
                                                        ? ` · Est = ${completedPages} × ${hoursPerUnit.toFixed(2)}h`
                                                        : ''}
                                                </p>
                                            ) : (
                                                <p className="text-[10px] text-gray-400 mt-1 ml-1">Auto: Completed Work × 8 ÷ Daily Target</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Taken Hours</label>
                                            <input
                                                type="number"
                                                value={takenTime}
                                                onChange={e => setTakenTime(e.target.value)}
                                                className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                                                step="0.1"
                                                min={isMiscellaneous ? MIN_HOURS : 0.1}
                                                max={isMiscellaneous ? MAX_HOURS : undefined}
                                                placeholder={isMiscellaneous ? '1.0 – 4.0' : '7.5'}
                                                required
                                            />
                                            {isMiscellaneous ? (
                                                <p className="text-[10px] text-gray-400 mt-1 ml-1">Miscellaneous only: {MIN_HOURS}–{MAX_HOURS} hours</p>
                                            ) : null}
                                        </div>
                                    </div>

                                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm">
                                        <ShieldCheck size={20} />Authorize and Log
                                    </button>
                                </form>
                            </div>

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
                        </div>
                    )}
                </div>

                <footer className="container mx-auto max-w-7xl mt-8 text-center text-xs font-bold text-gray-400 dark:text-gray-600 uppercase tracking-[0.3em]">
                    &copy; {new Date().getFullYear()} CBPET Engine Alpha • Real-time Monitoring Active
                </footer>
            </div>

            <Modal
                show={showTargetInfoModal}
                onClose={() => setShowTargetInfoModal(false)}
                maxWidth="max-w-5xl"
            >
                <div className="text-left flex flex-col min-h-0 flex-1 overflow-hidden">
                    <div className="flex items-start justify-between gap-4 mb-4 shrink-0">
                        <div className="min-w-0 pr-2">
                            <h2 className="text-xl font-black text-gray-900 dark:text-white">Daily Targets & Score Formula</h2>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1">
                                Estimated Hours are calculated from completed work against the active daily target.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowTargetInfoModal(false)}
                            className="shrink-0 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs font-black uppercase tracking-wider text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            Close
                        </button>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
                        <div className="mb-4 rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/30 px-4 py-3">
                            {taskType ? (
                                <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
                                    {isMiscellaneous
                                        ? 'Current task is Miscellaneous: estimated and taken hours are manual, allowed range 1-4 hours.'
                                        : `Current task uses ${activeTargetSource.toLowerCase()}: ${activeTargetVal} ${activeTargetUnit}.`}
                                </p>
                            ) : (
                                <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
                                    Select a task to highlight its target and active source.
                                </p>
                            )}
                        </div>

                        <div className="max-h-[40vh] overflow-auto rounded-xl border border-gray-200 dark:border-gray-700">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-500">Task Type</th>
                                        <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-gray-500">Daily Target</th>
                                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-500">Unit</th>
                                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-500">Estimated Hours Formula</th>
                                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-500">Example</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                                    {TARGET_INFO_ROWS.map((row) => {
                                        const isActiveRow = normalizeTaskType(taskType) === row.taskType || taskType === row.taskType;
                                        return (
                                            <tr
                                                key={row.taskType}
                                                className={isActiveRow ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'}
                                            >
                                                <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{row.taskType}</td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">{row.target ?? 'none'}</td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.unit}</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{row.formula}</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{row.example}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
                                <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Productive Task Formula</h3>
                                <div className="space-y-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    <p><span className="font-mono">Estimated Hours = Completed Work × 8 ÷ Daily Target</span></p>
                                    <p><span className="font-mono">Time Achieved % = Estimated Hours ÷ Taken Hours × 100</span></p>
                                    <p><span className="font-mono">Target Achieved % = Completed Work ÷ ((Daily Target ÷ 8) × Taken Hours) × 100</span></p>
                                    <p><span className="font-mono">Performance Score = 60% Target Achieved + 40% Time Achieved</span></p>
                                </div>
                            </div>
                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
                                <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Miscellaneous Rule</h3>
                                <div className="space-y-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    <p>Miscellaneous has no productivity target.</p>
                                    <p>Estimated Hours and Taken Hours are entered manually.</p>
                                    <p>Allowed range: 1-4 hours.</p>
                                    <p><span className="font-mono">Misc Score = min((Taken Hours ÷ 8) × 100, 100)</span></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Password Management Modals */}
            {showChangePasswordModal && (
                <ChangePassword 
                    profile={profile}
                    onClose={() => setShowChangePasswordModal(false)}
                />
            )}

            {showAdminResetPasswordModal && (
                <AdminResetUserPassword
                    profile={profile}
                    allProfiles={allProfiles}
                    onClose={() => setShowAdminResetPasswordModal(false)}
                    onPasswordReset={() => fetchAllProfiles()}
                />
            )}
        </NotificationProvider>
    );
};

export default App;
