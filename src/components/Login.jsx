import { useState, useEffect } from 'react';
import { supabase, formatAuthClientError } from '../lib/supabase';
import { Mail, Lock, LogIn, Loader2 } from 'lucide-react';

const Login = ({ setView, authCallbackError }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(authCallbackError || null);

    useEffect(() => {
        if (authCallbackError) setError(authCallbackError);
    }, [authCallbackError]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;
            // setView('app'); // Auth listener in App.jsx will handle this
        } catch (err) {
            setError(formatAuthClientError(err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
            <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-10 border border-gray-100 dark:border-gray-800">
                <div className="text-center mb-10">
                    <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/20">
                        <LogIn className="text-white w-10 h-10" />
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">Welcome Back</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-3 font-medium">Daily Status Tracker • Secure Portal</p>
                </div>

                {error && (
                    <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-sm font-bold flex items-center gap-2">
                        <span>⚠️</span> {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2 ml-1">
                            Email Identifier
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 rounded-2xl outline-none transition-all dark:text-white font-medium"
                                placeholder="name@cbpet.com"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2 ml-1">
                            <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                                Access Password
                            </label>
                            <button
                                type="button"
                                onClick={() => setView('forgot-password')}
                                className="text-[11px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            >
                                Recover?
                            </button>
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 rounded-2xl outline-none transition-all dark:text-white font-medium"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-500/30 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Authorize Access'}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-gray-400 dark:text-gray-500 text-[11px] font-black uppercase tracking-widest">
                        New performer?{' '}
                        <button
                            onClick={() => setView('signup')}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                            Create Account
                        </button>
                    </p>
                </div>

                <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-800 text-center">
                    <p className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-wider leading-relaxed">
                        After login, click 🔒 in the header to change your password anytime.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
