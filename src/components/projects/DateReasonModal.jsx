import React, { useState } from 'react';
import Modal from '../Modal';
import { SCHEDULE_DATE_REASON_CODES } from '../../lib/projects/projectScheduleEvents';

/**
 * Required reason gate before lead date edits.
 * onConfirm({ reasonCode, note })
 */
export default function DateReasonModal({
    show,
    title = 'Confirm date change',
    summary = '',
    onClose,
    onConfirm,
    saving = false,
}) {
    const [reasonCode, setReasonCode] = useState('priority');
    const [note, setNote] = useState('');

    if (!show) return null;

    const handleConfirm = () => {
        if (!reasonCode) return;
        onConfirm({ reasonCode, note: note.trim() || null });
    };

    return (
        <Modal show={show} onClose={onClose} maxWidth="max-w-md">
            <div className="text-left space-y-4 overflow-y-auto">
                <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">{title}</h3>
                    {summary ? (
                        <p className="mt-1 text-sm font-semibold text-gray-500">{summary}</p>
                    ) : null}
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                        Reason *
                    </label>
                    <select
                        value={reasonCode}
                        onChange={(event) => setReasonCode(event.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold"
                    >
                        {SCHEDULE_DATE_REASON_CODES.map((item) => (
                            <option key={item.code} value={item.code}>{item.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                        Note
                    </label>
                    <textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        rows={3}
                        placeholder="Optional context for the audit trail"
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold"
                    />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-gray-600 dark:text-gray-300"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={saving || !reasonCode}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
                    >
                        {saving ? 'Saving…' : 'Save with reason'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
