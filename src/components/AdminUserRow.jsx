import { useState } from 'react';
import { Trash2 } from 'lucide-react';

const AdminUserRow = ({ user, onUpdate, onDelete, isSelf, currentUserRole }) => {
    const [role, setRole] = useState(user.role);
    const [clientId, setClientId] = useState(user.client_id || '');
    const [changed, setChanged] = useState(false);

    // Debug: Log access levels
    const canEdit = currentUserRole === 'super_admin' || currentUserRole === 'general_manager';
    const canDelete = currentUserRole === 'super_admin' || currentUserRole === 'general_manager';

    if (currentUserRole === 'super_admin' || currentUserRole === 'general_manager') {
        console.log(`✅ ${currentUserRole.toUpperCase()}: Full CRUD access`, { userId: user.id, userName: user.performer_name });
    } else {
        console.log(`⛔ ${currentUserRole}: Read-only access`, { userId: user.id, userName: user.performer_name });
    }

    const handleSave = () => {
        if (!canEdit) {
            console.error('⛔ Unauthorized: Cannot edit user');
            return;
        }
        onUpdate(user.id, role, clientId);
        setChanged(false);
    };

    // Define which roles the current user can assign
    const getAvailableRoles = () => {
        if (currentUserRole === 'super_admin') {
            if (isSelf) {
                console.warn('⚠️ SUPER_ADMIN: Cannot modify own role');
                return [{ value: user.role, label: user.role.charAt(0).toUpperCase() + user.role.slice(1) }];
            }
            return [
                { value: 'super_admin', label: 'Super Admin' },
                { value: 'general_manager', label: 'General Manager' },
                { value: 'manager', label: 'Manager' },
                { value: 'group_lead', label: 'Group Lead' },
                { value: 'team_lead', label: 'Team Lead' },
                { value: 'performer', label: 'Performer' }
            ];
        }
        return [];
    };

    const availableRoles = getAvailableRoles();

    return (
        <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group">
            <td className="p-4">
                <p className="font-bold text-sm tracking-tight">{user.performer_name}</p>
                <p className="text-[10px] text-gray-400 font-medium font-mono">{user.id.slice(0, 8)}...</p>
            </td>
            <td className="p-4">
                <input
                    type="text"
                    value={role === 'lead' ? clientId : 'ALL ACCESS'}
                    disabled={role !== 'lead' || !canEdit}
                    onChange={(e) => { setClientId(e.target.value); setChanged(true); }}
                    placeholder="Enter Client ID"
                    className="w-full bg-gray-50 dark:bg-gray-800 text-xs font-bold p-2.5 rounded-lg border border-transparent focus:border-purple-500 outline-none transition-all disabled:opacity-50"
                />
            </td>
            <td className="p-4">
                <select
                    value={role}
                    onChange={(e) => { setRole(e.target.value); setChanged(true); }}
                    className="bg-gray-50 dark:bg-gray-800 text-xs font-bold p-2.5 rounded-lg border border-transparent focus:border-purple-500 outline-none transition-all"
                    disabled={isSelf || !canEdit}
                >
                    {availableRoles.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </td>
            <td className="p-4 flex items-center gap-3">
                {changed ? (
                    <button
                        onClick={handleSave}
                        disabled={!canEdit}
                        className={`px-4 py-2 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg ${canEdit ? 'bg-purple-600 shadow-purple-500/30' : 'bg-gray-400 cursor-not-allowed opacity-50'}`}
                    >
                        Save
                    </button>
                ) : (
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 opacity-40">Sync</span>
                )}
                {!isSelf && (currentUserRole === 'super_admin' || currentUserRole === 'general_manager') && (
                    <button
                        onClick={() => onDelete(user.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all"
                        title="Delete User Profile"
                        aria-label="Delete user profile"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </td>
        </tr>
    );
};

export default AdminUserRow;
