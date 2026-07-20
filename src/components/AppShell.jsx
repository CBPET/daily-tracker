import Toast from './Toast';
import { NotificationProvider } from './notifications/NotificationProvider';
import NotificationBell from './notifications/NotificationBell';
import NotificationDrawer from './notifications/NotificationDrawer';
import NotificationCenter from './notifications/NotificationCenter';
import { canAdminResetPassword } from '../lib/adminAccess';
import { canAccessAdminTab } from '../lib/permissions';
import {
    LayoutDashboard,
    ClipboardList,
    LogOut,
    User,
    ShieldCheck,
    Users,
    Lock,
    KeyRound,
    Inbox,
    Database,
} from 'lucide-react';

/**
 * Logged-in app chrome: top nav, tab bar, toast/notifications, and main content.
 */
const AppShell = ({
    profile,
    session,
    darkMode,
    setDarkMode,
    activeTab,
    setActiveTab,
    onLogout,
    onChangePassword,
    onAdminResetPassword,
    requestHubEnabled = false,
    notificationsEnabled = false,
    showToast = false,
    toastMessage = '',
    onToastDone,
    children,
}) => {
    return (
        <NotificationProvider enabled={notificationsEnabled}>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-100 p-4 transition-colors duration-300 font-sans">
                <Toast show={showToast} message={toastMessage} onDone={onToastDone} />
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
                            <span>{session?.user?.email}</span>
                        </div>
                        <NotificationBell />
                        <button
                            onClick={onChangePassword}
                            className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition-colors"
                            title="Change Your Password"
                            aria-label="Change your password"
                        >
                            <Lock size={18} />
                        </button>
                        {canAdminResetPassword(profile?.role) && (
                            <button
                                onClick={onAdminResetPassword}
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
                        <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl font-bold transition-all text-sm uppercase tracking-widest">
                            <LogOut size={18} />
                            Logout
                        </button>
                    </div>
                </nav>

                <div className="container mx-auto max-w-7xl mb-8 flex justify-center">
                    <div className="bg-white dark:bg-gray-900 p-1.5 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 flex gap-2 overflow-x-auto">
                        <button onClick={() => setActiveTab('form')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${activeTab === 'form' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                            <ClipboardList size={18} />Daily Task Form
                        </button>
                        <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                            <LayoutDashboard size={18} />Analytics
                        </button>
                        <button onClick={() => setActiveTab('projects')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${activeTab === 'projects' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                            <Database size={18} />iTitle
                        </button>
                        {requestHubEnabled && (
                            <button onClick={() => setActiveTab('request_hub')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${activeTab === 'request_hub' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                <Inbox size={18} />Smart Request Hub
                            </button>
                        )}
                        {canAccessAdminTab(profile?.role) && (
                            <button onClick={() => setActiveTab('super_admin')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${activeTab === 'super_admin' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                <Users size={18} />Administration
                            </button>
                        )}
                    </div>
                </div>

                <div className="container mx-auto max-w-7xl bg-white dark:bg-gray-900 rounded-3xl p-6 md:p-10 shadow-xl border border-gray-100 dark:border-gray-800 min-h-[600px]">
                    {children}
                </div>

                <footer className="container mx-auto max-w-7xl mt-8 text-center text-xs font-bold text-gray-400 dark:text-gray-600 uppercase tracking-[0.3em]">
                    &copy; {new Date().getFullYear()} CBPET Engine Alpha • Real-time Monitoring Active
                </footer>
            </div>
        </NotificationProvider>
    );
};

export default AppShell;
