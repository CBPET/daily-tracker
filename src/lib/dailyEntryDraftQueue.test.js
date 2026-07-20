import assert from 'node:assert/strict';
import test from 'node:test';
import {
    clearDailyEntryDrafts,
    draftStorageKey,
    loadDailyEntryDrafts,
    saveDailyEntryDrafts,
} from './dailyEntryDraftQueue.js';

test('draftStorageKey is namespaced per user', () => {
    assert.equal(draftStorageKey('abc'), 'cbpet.daily_entry_drafts.abc');
});

test('save and load drafts round-trip in localStorage', () => {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => { store.set(key, String(value)); },
        removeItem: (key) => { store.delete(key); },
    };

    const userId = 'user-1';
    const rows = [
        { id: 1, titleName: 'Book A', selected: true },
        { id: 2, titleName: 'Book B', selected: false },
    ];
    saveDailyEntryDrafts(userId, rows);
    assert.deepEqual(loadDailyEntryDrafts(userId), rows);

    clearDailyEntryDrafts(userId);
    assert.deepEqual(loadDailyEntryDrafts(userId), []);
});
