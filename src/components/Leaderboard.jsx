import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Toast from './Toast';
import { ChevronDown, TrendingUp, Award, Users } from 'lucide-react';

export default function Leaderboard() {
  const [userRole, setUserRole] = useState('performer');
  const [teamId, setTeamId] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState('monthly'); // monthly, quarterly, yearly
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teams, setTeams] = useState([]);
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [stats, setStats] = useState(null);

  // Toast notification
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch user role and team on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, team_id')
            .eq('id', user.id)
            .single();
          
          if (profile) {
            setUserRole(profile.role);
            setTeamId(profile.team_id);
          }
        }
      } catch (err) {
        console.error('Error fetching user:', err);
      }
    };
    getCurrentUser();
  }, []);

  // Fetch teams based on role
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        if (userRole === 'super_admin' || userRole === 'general_manager') {
          const { data } = await supabase.from('teams').select('*').eq('is_active', true);
          setTeams(data || []);
        } else if (userRole === 'manager') {
          const { data: { user } } = await supabase.auth.getUser();
          const { data } = await supabase.from('teams').select('*').eq('manager_id', user.id);
          setTeams(data || []);
        } else if (userRole === 'team_lead' || userRole === 'performer') {
          if (teamId) {
            const { data } = await supabase.from('teams').select('*').eq('id', teamId);
            setTeams(data || []);
          }
        }
      } catch (err) {
        console.error('Error fetching teams:', err);
      }
    };

    if (userRole) {
      fetchTeams();
    }
  }, [userRole, teamId]);

  // Fetch leaderboard data based on role and timeframe
  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        let query;

        // Select the appropriate view based on timeframe
        const viewName = timeframe === 'monthly' 
          ? 'monthly_leaderboard'
          : timeframe === 'quarterly'
          ? 'quarterly_leaderboard'
          : 'yearly_leaderboard';

        query = supabase.from(viewName).select('*');

        // Apply role-based filtering
        if (userRole === 'performer' || userRole === 'team_lead') {
          // Only show team members
          query = query.eq('team_id', teamId);
        } else if (userRole === 'manager') {
          // Show only managed teams
          const { data: managedTeams } = await supabase
            .from('teams')
            .select('id')
            .eq('manager_id', user.id);
          
          if (managedTeams && managedTeams.length > 0) {
            const teamIds = managedTeams.map(t => t.id);
            query = query.in('team_id', teamIds);
          }
        }
        // super_admin and general_manager see all

        // Order by rank
        const orderColumn = timeframe === 'monthly' 
          ? 'calculated_rank'
          : 'calculated_rank';
        
        query = query.order(orderColumn, { ascending: true });

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        setLeaderboardData(data || []);

        // Calculate aggregate stats
        if (data && data.length > 0) {
          const totalPages = data.reduce((sum, entry) => {
            const pages = timeframe === 'monthly' 
              ? entry.total_pages 
              : entry.total_pages_quarter || entry.total_pages_year;
            return sum + (pages || 0);
          }, 0);

          setStats({
            totalEntries: data.length,
            totalPages,
            avgPages: (totalPages / data.length).toFixed(2),
            topPerformer: data[0]?.performer_name || 'N/A'
          });
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setError(err.message);
        showToast('Error loading leaderboard', 'error');
      } finally {
        setLoading(false);
      }
    };

    if (userRole) {
      fetchLeaderboard();
    }
  }, [userRole, timeframe, teamId, selectedTeam]);

  // Filter data by team if selected (for managers)
  const filteredData = selectedTeam
    ? leaderboardData.filter(entry => entry.team_id === selectedTeam)
    : leaderboardData;

  // Get ranking column name based on timeframe
  const getRankColumn = () => {
    return 'calculated_rank';
  };

  const renderLeaderboardTable = () => {
    if (filteredData.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No leaderboard data available</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Rank</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">role</th>
              {(userRole === 'super_admin' || userRole === 'general_manager' || userRole === 'manager') && (
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Team</th>
              )}
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                {timeframe === 'monthly' ? 'Pages' : 'Total Pages'}
              </th>
              {timeframe !== 'monthly' && (
                <>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Tasks</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Avg Target</th>
                </>
              )}
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Efficiency</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((entry, index) => {
              const isCurrentUser = entry.user_id === supabase.auth.getUser().then(u => u.data.user?.id);
              return (
                <tr 
                  key={entry.user_id}
                  className={`border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition ${
                    entry.calculated_rank === 1 ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {entry.calculated_rank === 1 && <Award className="w-5 h-5 text-yellow-500" />}
                      <span className="font-bold text-gray-900 dark:text-white">#{entry.calculated_rank}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                    {entry.performer_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded">
                      {entry.role.replace('_', ' ')}
                    </span>
                  </td>
                  {(userRole === 'super_admin' || userRole === 'general_manager' || userRole === 'manager') && (
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {entry.team_name || 'N/A'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                    {timeframe === 'monthly' ? entry.total_pages : entry.total_pages_quarter || entry.total_pages_year}
                  </td>
                  {timeframe !== 'monthly' && (
                    <>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                        {timeframe === 'quarterly' ? entry.tasks_completed_quarter : entry.tasks_completed_year}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                        {(timeframe === 'quarterly' ? entry.avg_target_achieved : entry.avg_target_achieved)?.toFixed(2) || '0'}%
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full" 
                          style={{ width: `${Math.min((entry.time_efficiency || 0), 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {(entry.time_efficiency || 0).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Award className="w-8 h-8 text-yellow-500" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Performance Leaderboard</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Competitive rankings and team performance metrics</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Participants</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalEntries}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total {timeframe === 'monthly' ? 'Pages' : 'Pages'}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalPages}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Average Performance</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.avgPages}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Top Performer</p>
            <p className="text-xl font-bold text-yellow-500">{stats.topPerformer}</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-4">
        {/* Timeframe Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Timeframe</label>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        {/* Team Filter (for managers) */}
        {(userRole === 'super_admin' || userRole === 'general_manager' || userRole === 'manager') && teams.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Filter by Team</label>
            <select
              value={selectedTeam || ''}
              onChange={(e) => setSelectedTeam(e.target.value || null)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">All Teams</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">Error: {error}</div>
        ) : (
          renderLeaderboardTable()
        )}
      </div>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
