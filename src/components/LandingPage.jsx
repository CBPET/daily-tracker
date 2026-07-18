import React from 'react';
import {
    ShieldCheck,
    Zap,
    BarChart3,
    Users,
    Clock,
    ArrowRight,
    Target,
    LayoutDashboard
} from 'lucide-react';

const LandingPage = ({ onGetStarted }) => {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-500 overflow-x-hidden font-sans">
            {/* ── Background Decoration ── */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-50 dark:opacity-20 z-0">
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-400/20 rounded-full blur-[120px]" />
            </div>

            {/* ── Header ── */}
            <nav className="relative z-10 container mx-auto px-6 py-8 flex justify-between items-center bg-white/50 dark:bg-gray-900/50 backdrop-blur-md rounded-b-3xl border-x border-b border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">CBPET Tracker</h1>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Enterprise Edition</span>
                    </div>
                </div>
                <button
                    onClick={onGetStarted}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all text-xs uppercase tracking-widest active:scale-95"
                >
                    Portal Login <ArrowRight size={16} />
                </button>
            </nav>

            {/* ── Hero Section ── */}
            <main className="relative z-10 container mx-auto px-6 pt-20 pb-32 text-center">
                <div className="max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/40 rounded-full border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest mb-10 animate-bounce">
                        🚀 Performance Monitoring Reimagined
                    </div>
                    <h2 className="text-5xl md:text-7xl font-black text-gray-900 dark:text-white mb-8 tracking-tight leading-tight">
                        Maximize <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Productivity</span> <br />
                        with Real-time Analytics
                    </h2>
                    <p className="text-lg md:text-xl text-gray-500 dark:text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
                        Secure, role-based status tracking with precision metrics. Designed for CBPET performers, leads, and managers.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={onGetStarted}
                            className="px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-2xl shadow-blue-500/40 transition-all uppercase tracking-[0.2em] text-sm group"
                        >
                            Get Started Now <ArrowRight className="inline-block ml-2 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button className="px-10 py-5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-800 font-bold rounded-2xl shadow-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                            View Documentation
                        </button>
                    </div>
                </div>

                {/* ── Feature Cards ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-32 max-w-6xl mx-auto">
                    <div className="p-10 bg-white dark:bg-gray-900 rounded-[40px] border border-gray-100 dark:border-gray-800 shadow-xl hover:scale-105 transition-transform group">
                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-3xl flex items-center justify-center text-blue-600 mb-8 mx-auto group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-lg shadow-blue-500/10">
                            <Zap size={32} />
                        </div>
                        <h3 className="text-xl font-black mb-4 uppercase tracking-tight">Rapid Logging</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed font-medium">
                            Log daily activity in seconds with our optimized entry system and target-based estimation.
                        </p>
                    </div>

                    <div className="p-10 bg-white dark:bg-gray-900 rounded-[40px] border border-gray-100 dark:border-gray-800 shadow-xl hover:scale-105 transition-transform group">
                        <div className="w-16 h-16 bg-purple-50 dark:bg-purple-900/30 rounded-3xl flex items-center justify-center text-purple-600 mb-8 mx-auto group-hover:bg-purple-600 group-hover:text-white transition-colors shadow-lg shadow-purple-500/10">
                            <LayoutDashboard size={32} />
                        </div>
                        <h3 className="text-xl font-black mb-4 uppercase tracking-tight">Neural Analytics</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed font-medium">
                            Visualize trends, client-wise distribution, and performance scores through interactive charts.
                        </p>
                    </div>

                    <div className="p-10 bg-white dark:bg-gray-900 rounded-[40px] border border-gray-100 dark:border-gray-800 shadow-xl hover:scale-105 transition-transform group">
                        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center text-indigo-600 mb-8 mx-auto group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-lg shadow-indigo-500/10">
                            <Clock size={32} />
                        </div>
                        <h3 className="text-xl font-black mb-4 uppercase tracking-tight">Precise Security</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed font-medium">
                            Supabase powered Row Level Security ensuring only authorized leads and managers access project data.
                        </p>
                    </div>
                </div>

                {/* ── Role Highlights ── */}
                <div className="mt-40 bg-gray-900 dark:bg-gray-900 rounded-[60px] p-12 md:p-20 text-left overflow-hidden relative shadow-inner">
                    <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px]" />
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                        <div>
                            <h3 className="text-4xl font-black text-white mb-8 leading-tight tracking-tight">Structured Hierarchy for <br />Unified Teams</h3>
                            <div className="space-y-6">
                                <div className="flex gap-5">
                                    <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 h-fit"><Users size={20} /></div>
                                    <div>
                                        <h4 className="text-white font-bold mb-1">Managers</h4>
                                        <p className="text-gray-400 text-sm">Oversee global operations and allocate specialized team leads.</p>
                                    </div>
                                </div>
                                <div className="flex gap-5">
                                    <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400 h-fit"><Target size={20} /></div>
                                    <div>
                                        <h4 className="text-white font-bold mb-1">Leads</h4>
                                        <p className="text-gray-400 text-sm">Control client-specific analytic buckets and performance reviews.</p>
                                    </div>
                                </div>
                                <div className="flex gap-5">
                                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400 h-fit"><BarChart3 size={20} /></div>
                                    <div>
                                        <h4 className="text-white font-bold mb-1">Performers</h4>
                                        <p className="text-gray-400 text-sm">Transparent scoreboards and rapid daily status synchronization.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white/5 backdrop-blur-3xl rounded-3xl p-8 border border-white/10 shadow-2xl">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-3 h-3 rounded-full bg-red-400" />
                                <div className="w-3 h-3 rounded-full bg-amber-400" />
                                <div className="w-3 h-3 rounded-full bg-green-400" />
                            </div>
                            <div className="space-y-4">
                                <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse" />
                                <div className="h-4 w-1/2 bg-white/10 rounded animate-pulse" />
                                <div className="grid grid-cols-2 gap-4 mt-8">
                                    <div className="h-24 bg-blue-500/20 rounded-2xl border border-blue-500/30" />
                                    <div className="h-24 bg-purple-500/20 rounded-2xl border border-purple-500/30" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* ── Footer ── */}
            <footer className="container mx-auto px-6 py-12 text-center border-t border-gray-100 dark:border-gray-800">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">
                    &copy; {new Date().getFullYear()} CBPET Analytics Engine • Engineered for Precision
                </p>
            </footer>
        </div>
    );
};

export default LandingPage;
