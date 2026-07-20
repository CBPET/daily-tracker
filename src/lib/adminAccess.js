/** Role checks for admin chrome and password-reset affordances. */

const ADMIN_RESET_PASSWORD_ROLES = ['super_admin', 'general_manager', 'manager'];

/**
 * Who can open the admin "reset user password" control in the app chrome.
 * @param {string | null | undefined} role
 * @returns {boolean}
 */
export function canAdminResetPassword(role) {
    return ADMIN_RESET_PASSWORD_ROLES.includes(role);
}
