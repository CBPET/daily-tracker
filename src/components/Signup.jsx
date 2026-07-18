import { useState } from 'react';
import { getAuthRedirectUrl } from '../lib/authRedirect';
import { supabase } from '../lib/supabase';
import { Mail, Lock, User, UserPlus, Loader2, ArrowLeft } from 'lucide-react';

const Signup = ({ setView }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data: signupData, error: signupError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        performer_name: fullName,
                        onboarding: 'signup',
                    },
                    emailRedirectTo: getAuthRedirectUrl(),
                },
            });

            if (signupError) throw signupError;

            if (signupData?.user?.id) {
                const { error: profilePatchError } = await supabase
                    .from('profiles')
                    .update({ onboarding: 'signup', performer_name: fullName, email })
                    .eq('id', signupData.user.id);
                if (profilePatchError && !/onboarding/i.test(profilePatchError.message || '')) {
                    console.warn('Profile onboarding update:', profilePatchError.message);
                }
            }

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
                    Back to login
                </button>

                <div className="text-center mb-10">
                    <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/20">
                        <UserPlus className="text-white w-10 h-10" />
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">Register</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-3 font-medium">Join the CBPET Tracker Network</p>
                </div>

                {success ? (
                    <div className="text-center">
                        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-2xl text-green-600 dark:text-green-400 text-sm font-bold">
                            ✅ Account created! Check your email for a confirmation link (if required), then log in with your email and password. Use the 🔒 icon after login to change your password anytime.
                        </div>
                        <button
                            onClick={() => setView('login')}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase tracking-widest text-sm"
                        >
                            Return to Login
                        </button>
                    </div>
                ) : (
                    <>
                        {error && (
                            <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-sm font-bold flex items-center gap-2">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        <form onSubmit={handleSignup} className="space-y-6">
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2 ml-1">
                                    Full Name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 rounded-2xl outline-none transition-all dark:text-white font-medium"
                                        placeholder="John Doe"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2 ml-1">
                                    Email Address
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
                                <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2 ml-1">
                                    Create Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 rounded-2xl outline-none transition-all dark:text-white font-medium"
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-500/30 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Register for Access'}
                            </button>
                        </form>

                        <div className="mt-8 text-center">
                            <p className="text-gray-400 dark:text-gray-500 text-[11px] font-black uppercase tracking-widest">
                                Already have an account?{' '}
                                <button
                                    onClick={() => setView('login')}
                                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                >
                                    Login
                                </button>
                            </p>
                        </div>
                    </>
                )}

                <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-800 text-center">
                    <p className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-wider leading-relaxed">
                        Default role: Performer. <br />Admin/Manager approval required for higher access.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Signup;
