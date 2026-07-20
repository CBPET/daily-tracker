const STORAGE_PREFIX = 'cbpet.daily_entry_drafts.';

export function draftStorageKey(userId) {
    return `${STORAGE_PREFIX}${userId || 'anon'}`;
}

export function loadDailyEntryDrafts(userId) {
    if (!userId || typeof localStorage === 'undefined') return [];
    try {
        const raw = localStorage.getItem(draftStorageKey(userId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((row) => ({
            ...row,
            selected: row.selected !== false,
        }));
    } catch {
        return [];
    }
}

export function saveDailyEntryDrafts(userId, rows = []) {
    if (!userId || typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(draftStorageKey(userId), JSON.stringify(rows));
    } catch (error) {
        console.warn('Failed to save daily entry drafts:', error.message);
    }
}

export function clearDailyEntryDrafts(userId) {
    if (!userId || typeof localStorage === 'undefined') return;
    try {
        localStorage.removeItem(draftStorageKey(userId));
    } catch {
        /* ignore */
    }
}
