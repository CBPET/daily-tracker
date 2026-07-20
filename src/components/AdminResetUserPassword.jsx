import { useState } from 'react';
import { getAuthRedirectUrl } from '../lib/authRedirect';
import { supabase } from '../lib/supabase';
import { canAdminResetPassword } from '../lib/adminAccess';
import { Lock, Loader2, CheckCircle2, Search, KeyRound, Mail } from 'lucide-react';

/**
 * Admin modal: send password reset link and/or set a temporary password.
 * Roles: super_admin, general_manager, manager.
 */
const AdminResetUserPassword = ({
    profile,
    session,
    allProfiles,
    onClose,
    onPasswordReset,
    initialUserId = '',
    initialMode = 'reset_link',
}) => {
    const [mode, setMode] = useState(initialMode === 'set_password' ? 'set_password' : 'reset_link');
    const [selectedUserId, setSelectedUserId] = useState(initialUserId || '');
    const [searchQuery, setSearchQuery] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const filteredProfiles = allProfiles.filter((p) => {
        const matchesSearch =
            p.performer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.role?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch && p.id !== profile?.id;
    });

    const selectedUser = allProfiles.find((p) => p.id === selectedUserId);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!canAdminResetPassword(profile?.role)) {
            setError('Access Denied: Only super_admin, general_manager, or manager can manage user passwords');
            return;
        }

        if (!selectedUserId) {
            setError('Please select a user');
            return;
        }

        const targetEmail = selectedUser?.email || resetEmail;
        if (mode === 'reset_link') {
            if (!targetEmail) {
                setError('Email is required — enter the user\'s email address below');
                return;
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(targetEmail)) {
                setError('Invalid email address');
                return;
            }
        }

        if (mode === 'set_password') {
            if (password.length < 8) {
                setError('Password must be at least 8 characters');
                return;
            }
            if (password !== confirmPassword) {
                setError('Passwords do not match');
                return;
            }
        }

        setLoading(true);

        try {
            if (mode === 'reset_link') {
                const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
                    redirectTo: getAuthRedirectUrl(),
                });
                if (resetError) throw resetError;

                setSuccessMessage(
                    `Password reset link sent to ${targetEmail}. They must open the email to set a new password.`
                );
            } else {
                const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`;
                const { data: sessionData } = await supabase.auth.getSession();
                const token = sessionData?.session?.access_token || session?.access_token;
                if (!token) throw new Error('Not signed in');

                const res = await fetch(fnUrl, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'set_password',
                        userId: selectedUserId,
                        password,
                    }),
                });
                const payload = await res.json().catch(() => ({}));
                if (!res.ok || !payload.ok) {
                    throw new Error(payload.error || `Failed to set password (${res.status})`);
                }

                setSuccessMessage(
                    `Temporary password set for ${selectedUser?.performer_name || 'user'}. Share it securely out of band.`
                );
            }

            setSuccess(true);
            const resetUserId = selectedUserId;
            setSelectedUserId('');
            setResetEmail('');
            setSearchQuery('');
            setPassword('');
            setConfirmPassword('');

            if (onPasswordReset) onPasswordReset(resetUserId);

            setTimeout(() => onClose(), 3000);
        } catch (err) {
            setError(err.message || 'Failed to update password');
            console.error('Admin password action error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!canAdminResetPassword(profile?.role)) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-8 max-w-md w-full border border-gray-100 dark:border-gray-800">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                        Access Denied
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Only Super Admin, General Manager, or Manager can reset or set user passwords.
                    </p>
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-8 max-w-md w-full border border-gray-100 dark:border-gray-800">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="text-green-600 w-8 h-8" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                            {mode === 'set_password' ? 'Password Updated' : 'Reset Link Sent'}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                            {successMessage}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-8 max-w-md w-full border border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Lock className="w-6 h-6 text-red-600" />
                        Manage User Password
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
                    >
                        ×
                    </button>
                </div>

                <div className="flex gap-2 mb-6">
                    <button
                        type="button"
                        onClick={() => { setMode('reset_link'); setError(null); }}
                        className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${
                            mode === 'reset_link'
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                        }`}
                    >
                        <Mail size={14} /> Send Reset Link
                    </button>
                    <button
                        type="button"
                        onClick={() => { setMode('set_password'); setError(null); }}
                        className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${
                            mode === 'set_password'
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                        }`}
                    >
                        <KeyRound size={14} /> Set Password
                    </button>
                </div>

                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg mb-6 border border-amber-200 dark:border-amber-800">
                    {mode === 'reset_link'
                        ? 'Sends a password reset email. The user must open the link to choose a new password.'
                        : 'Sets a temporary password immediately. Share it securely; do not paste it into chat logs.'}
                </p>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-sm font-medium">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-2">
                            Select User
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                name="cbpet-admin-user-search"
                                autoComplete="off"
                                placeholder="Search by name, email, or role..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:text-white mb-2"
                            />
                        </div>

                        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                            <select
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            >
                                <option value="">-- Choose User --</option>
                                {filteredProfiles.length > 0 ? (
                                    filteredProfiles.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.performer_name} • {p.role}{p.email ? ` • ${p.email}` : ''}
                                        </option>
                                    ))
                                ) : (
                                    <option disabled>
                                        {searchQuery ? 'No matching users' : 'No other users available'}
                                    </option>
                                )}
                            </select>
                        </div>
                    </div>

                    {mode === 'reset_link' ? (
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-2">
                                User Email {selectedUser?.email ? '(from profile)' : '(required)'}
                            </label>
                            <input
                                type="email"
                                name="cbpet-admin-reset-email"
                                autoComplete="off"
                                value={
                                    selectedUserId
                                        ? (selectedUser?.email || resetEmail)
                                        : resetEmail
                                }
                                onChange={(e) => setResetEmail(e.target.value)}
                                readOnly={!!selectedUser?.email}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:text-white read-only:opacity-70"
                                placeholder="user@yourdomain.com"
                                required
                            />
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-2">
                                    Temporary Password
                                </label>
                                <input
                                    type="password"
                                    name="cbpet-admin-temp-password"
                                    autoComplete="new-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                                    placeholder="Min 8 characters"
                                    required
                                    minLength={8}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-2">
                                    Confirm Password
                                </label>
                                <input
                                    type="password"
                                    name="cbpet-admin-temp-password-confirm"
                                    autoComplete="new-password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                                    required
                                    minLength={8}
                                />
                            </div>
                        </>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !selectedUserId}
                            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {loading
                                ? 'Working...'
                                : mode === 'set_password'
                                    ? 'Set Password'
                                    : 'Send Reset Link'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminResetUserPassword;
