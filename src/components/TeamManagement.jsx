import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Toast from './Toast';
import { Users, Plus, Trash2, Edit2, ChevronDown } from 'lucide-react';

export default function TeamManagement() {
  const [teams, setTeams] = useState([]);
  const [teamFormOpen, setTeamFormOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', manager_id: '' });
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState({});
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch teams and users on mount
  useEffect(() => {
    fetchTeams();
    fetchUsers();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setTeams(data || []);
    } catch (err) {
      console.error('Error fetching teams:', err);
      showToast('Error loading teams', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, performer_name, role')
        .order('performer_name');
      
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchTeamMembers = async (teamId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, performer_name, role')
        .eq('team_id', teamId)
        .order('performer_name');
      
      if (error) throw error;
      setTeamMembers(prev => ({
        ...prev,
        [teamId]: data || []
      }));
    } catch (err) {
      console.error('Error fetching team members:', err);
      showToast('Error loading team members', 'error');
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      showToast('Team name is required', 'error');
      return;
    }

    try {
      setLoading(true);
      
      if (editingTeam) {
        // Update existing team
        const { error } = await supabase
          .from('teams')
          .update({
            name: formData.name,
            description: formData.description,
            manager_id: formData.manager_id || null
          })
          .eq('id', editingTeam.id);

        if (error) throw error;
        showToast('Team updated successfully', 'success');
        setEditingTeam(null);
      } else {
        // Create new team
        const { error } = await supabase
          .from('teams')
          .insert({
            name: formData.name,
            description: formData.description,
            manager_id: formData.manager_id || null,
            is_active: true
          });

        if (error) throw error;
        showToast('Team created successfully', 'success');
      }

      setFormData({ name: '', description: '', manager_id: '' });
      setTeamFormOpen(false);
      fetchTeams();
    } catch (err) {
      console.error('Error saving team:', err);
      showToast(err.message || 'Error saving team', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm('Are you sure you want to delete this team? Members will be unassigned.')) {
      return;
    }

    try {
      setLoading(true);
      
      // Soft delete by marking inactive
      const { error } = await supabase
        .from('teams')
        .update({ is_active: false })
        .eq('id', teamId);

      if (error) throw error;
      
      // Unassign members
      await supabase
        .from('profiles')
        .update({ team_id: null })
        .eq('team_id', teamId);

      showToast('Team deleted successfully', 'success');
      fetchTeams();
    } catch (err) {
      console.error('Error deleting team:', err);
      showToast('Error deleting team', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignUser = async (userId, teamId) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ team_id: teamId })
        .eq('id', userId);

      if (error) throw error;
      showToast('User assigned to team', 'success');
      fetchTeamMembers(teamId);
      fetchUsers();
    } catch (err) {
      console.error('Error assigning user:', err);
      showToast('Error assigning user', 'error');
    }
  };

  const handleRemoveUser = async (userId, teamId) => {
    if (!window.confirm('Remove this user from the team?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ team_id: null })
        .eq('id', userId);

      if (error) throw error;
      showToast('User removed from team', 'success');
      fetchTeamMembers(teamId);
      fetchUsers();
    } catch (err) {
      console.error('Error removing user:', err);
      showToast('Error removing user', 'error');
    }
  };

  const toggleTeamExpand = async (teamId) => {
    if (expandedTeam === teamId) {
      setExpandedTeam(null);
    } else {
      setExpandedTeam(teamId);
      if (!teamMembers[teamId]) {
        await fetchTeamMembers(teamId);
      }
    }
  };

  const unassignedUsers = users.filter(u => !u.team_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-500" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Team Management</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Create and manage team structures</p>
          </div>
        </div>
        <button
          onClick={() => {
            setFormData({ name: '', description: '', manager_id: '' });
            setEditingTeam(null);
            setTeamFormOpen(!teamFormOpen);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
        >
          <Plus className="w-5 h-5" />
          New Team
        </button>
      </div>

      {/* Create/Edit Team Form */}
      {teamFormOpen && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            {editingTeam ? 'Edit Team' : 'Create New Team'}
          </h3>
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Team Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Engineering, Sales, Support"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Team description (optional)"
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Team Manager
              </label>
              <select
                value={formData.manager_id}
                onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">No Manager (Unassigned)</option>
                {users
                  .filter(u => ['team_lead', 'manager'].includes(u.role))
                  .map(user => (
                    <option key={user.id} value={user.id}>
                      {user.performer_name} ({user.role})
                    </option>
                  ))
                }
              </select>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50"
              >
                {loading ? 'Saving...' : editingTeam ? 'Update Team' : 'Create Team'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTeamFormOpen(false);
                  setEditingTeam(null);
                }}
                className="px-6 py-2 bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Teams List */}
      <div className="space-y-3">
        {loading && teams.length === 0 ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No teams created yet. Click "New Team" to get started.</p>
          </div>
        ) : (
          teams.map(team => (
            <div key={team.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Team Header */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                onClick={() => toggleTeamExpand(team.id)}
              >
                <div className="flex items-center gap-4 flex-1">
                  <ChevronDown
                    className={`w-5 h-5 transition transform ${expandedTeam === team.id ? 'rotate-180' : ''}`}
                  />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{team.name}</h3>
                    {team.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">{team.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full">
                    {teamMembers[team.id]?.length || 0} members
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData({
                        name: team.name,
                        description: team.description || '',
                        manager_id: team.manager_id || ''
                      });
                      setEditingTeam(team);
                      setTeamFormOpen(true);
                    }}
                    className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    title="Edit team"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTeam(team.id);
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    title="Delete team"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Team Details (Expanded) */}
              {expandedTeam === team.id && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Manager</p>
                    <p className="text-gray-900 dark:text-white">
                      {users.find(u => u.id === team.manager_id)?.performer_name || 'Unassigned'}
                    </p>
                  </div>

                  {/* Team Members */}
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Team Members</p>
                    {teamMembers[team.id] && teamMembers[team.id].length > 0 ? (
                      <div className="space-y-2">
                        {teamMembers[team.id].map(member => (
                          <div key={member.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-3 rounded">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{member.performer_name}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">{member.role}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveUser(member.id, team.id)}
                              className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                              title="Remove from team"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-600 dark:text-gray-400">No members yet</p>
                    )}
                  </div>

                  {/* Assign Users */}
                  {unassignedUsers.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Add Members</p>
                      <div className="flex flex-wrap gap-2">
                        {unassignedUsers.map(user => (
                          <button
                            key={user.id}
                            onClick={() => handleAssignUser(user.id, team.id)}
                            className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-900 transition text-sm"
                          >
                            + {user.performer_name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
