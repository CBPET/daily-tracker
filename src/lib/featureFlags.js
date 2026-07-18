/**
 * Vite build-time feature flags.
 * Default-on: unset or any value except the string "false".
 * Default-off: must be explicitly "true".
 */

function envFlag(name) {
  return import.meta.env[name];
}

function isDefaultOn(name) {
  return envFlag(name) !== 'false';
}

function isDefaultOff(name) {
  return envFlag(name) === 'true';
}

export function isSmartRequestHubEnabled() {
  return isDefaultOn('VITE_ENABLE_SMART_REQUEST_HUB');
}

export function isNotificationsEnabled() {
  return isDefaultOn('VITE_ENABLE_NOTIFICATIONS');
}

export function isNotificationEmailEnabled() {
  return isDefaultOff('VITE_ENABLE_NOTIFICATION_EMAIL');
}

export function isRequestHubRemindersEnabled() {
  return isDefaultOn('VITE_ENABLE_REQUEST_HUB_REMINDERS');
}

/** Level 3 flags — default off until SQL is applied and explicitly enabled. */
export function isBehaviourAnalyticsEnabled() {
  return isDefaultOff('VITE_ENABLE_BEHAVIOUR_ANALYTICS');
}

export function isFeedbackModuleEnabled() {
  return isDefaultOff('VITE_ENABLE_FEEDBACK_MODULE');
}

export function isSuperAdminGovernanceEnabled() {
  return isDefaultOff('VITE_ENABLE_SUPER_ADMIN_GOVERNANCE');
}

export function isEntryDuplicateGuardEnabled() {
  return isDefaultOff('VITE_ENABLE_ENTRY_DUPLICATE_GUARD');
}
