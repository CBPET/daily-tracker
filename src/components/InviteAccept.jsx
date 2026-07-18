import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { sanitizeAuthUrl } from '../lib/authRedirect';
import { deriveDisplayNameFromEmail } from '../lib/displayName';
import { User, Lock, Loader2, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';

/**
 * First-open screen after admin invite (or recovery when invite metadata present).
 * Display Name + set password popup-style card.
 */
const InviteAccept = ({ setView, authCallbackError }) => {
    const [displayName, setDisplayName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [sessionReady, setSessionReady] = useState(false);
    const [email, setEmail] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function checkSession() {
            const { data: { session } } = await supabase.auth.getSession();
            if (cancelled) return;

            if (session?.user) {
                const user = session.user;
                const meta = user.user_metadata || {};
                const name =
                    meta.performer_name ||
                    meta.full_name ||
                    deriveDisplayNameFromEmail(user.email) ||
                    '';
                setDisplayName(name);
                setEmail(user.email || '');
                setSessionReady(true);
            } else if (authCallbackError) {
                setError(authCallbackError);
            } else {
                setError('Could not verify invite link. Ask your admin to resend the invite.');
            }
            setInitializing(false);
        }

        checkSession();
        return () => { cancelled = true; };
    }, [authCallbackError]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const name = displayName.trim();
        if (!name) {
            setError('Display name is required');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords don't match");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                throw new Error('Session expired. Ask your admin to resend the invite.');
            }

            const { error: updateError } = await supabase.auth.updateUser({
                password,
                data: {
                    full_name: name,
                    performer_name: name,
                },
            });
            if (updateError) throw updateError;

            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    performer_name: name,
                    email: session.user.email,
                })
                .eq('id', session.user.id);

            if (profileError) {
                console.warn('Profile name update warning:', profileError.message);
            }

            sanitizeAuthUrl('form');
            setSuccess(true);
            setTimeout(() => setView('app'), 2000);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (initializing) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
            <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-10 border-2 border-blue-200 dark:border-blue-900/50">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/20">
                        <KeyRound className="text-white w-10 h-10" />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                        Complete Your Invite
                    </h1>
                    <p className="text-blue-700 dark:text-blue-400 mt-3 font-semibold text-sm uppercase tracking-widest">
                        Confirm display name &amp; set password
                    </p>
                    {email && (
                        <p className="mt-2 text-xs font-mono text-gray-400">{email}</p>
                    )}
                </div>

                {success ? (
                    <div className="text-center">
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-3xl flex items-center justify-center mx-auto mb-8">
                            <CheckCircle2 className="text-green-600 w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3">You&apos;re in</h3>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Opening the app…</p>
                    </div>
                ) : !sessionReady ? (
                    <div className="text-center space-y-6">
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-sm font-bold flex items-start gap-2 text-left">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <span>{error || 'Invalid invite link.'}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setView('login')}
                            className="w-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xs font-bold uppercase tracking-widest"
                        >
                            Back to Login
                        </button>
                    </div>
                ) : (
                    <>
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-sm font-bold flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 shrink-0" /> {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">
                                    Display Name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 w-5 h-5" />
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all dark:text-white font-medium"
                                        placeholder="Your display name"
                                        required
                                        autoComplete="name"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">
                                    New Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 w-5 h-5" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all dark:text-white font-medium"
                                        placeholder="Minimum 6 characters"
                                        required
                                        minLength={6}
                                        autoComplete="new-password"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">
                                    Confirm Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 w-5 h-5" />
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all dark:text-white font-medium"
                                        placeholder="Re-enter password"
                                        required
                                        minLength={6}
                                        autoComplete="new-password"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm disabled:opacity-70"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save & Continue'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};

export default InviteAccept;
