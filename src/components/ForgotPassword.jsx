import { useState } from 'react';
import { getAuthRedirectUrl } from '../lib/authRedirect';
import { supabase } from '../lib/supabase';
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

const ForgotPassword = ({ setView }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: getAuthRedirectUrl(),
            });

            if (resetError) throw resetError;
            setSuccess(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
            <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-10 border border-gray-100 dark:border-gray-800">
                <button
                    onClick={() => setView('login')}
                    className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-10 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Login
                </button>

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Forgot Password</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-3 text-sm font-medium">
                        We&apos;ll email a reset link, or log in and use the 🔒 icon in the header to change your password.
                    </p>
                </div>

                {success ? (
                    <div className="text-center">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="text-green-600 w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white mb-3">Check Your Email</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">
                            Reset link sent to <strong>{email}</strong>. Open it in the same browser, then set a new password.
                        </p>
                        <button
                            onClick={() => setView('login')}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-sm"
                        >
                            Back to Login
                        </button>
                    </div>
                ) : (
                    <>
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-sm font-bold">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleReset} className="space-y-6">
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">
                                    Your Email
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none dark:text-white font-medium"
                                        placeholder="name@company.com"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-sm disabled:opacity-70 flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Link'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};

export default ForgotPassword;
