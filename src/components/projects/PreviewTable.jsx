import React from 'react';
import { Check } from 'lucide-react';

export default function PreviewTable({ rows, onToggle }) {
    if (!rows.length) return null;
    const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row.values || {}))));
    return (
        <div className="overflow-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Save</th>
                        <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                        {keys.map((key) => (
                            <th key={key} className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">{key}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {rows.map((row) => (
                        <tr key={row.id}>
                            <td className="p-3">
                                <input type="checkbox" checked={row.selected} onChange={() => onToggle(row.id)} />
                            </td>
                            <td className="p-3">
                                {row.errors.length ? (
                                    <span className="text-xs font-bold text-red-600">{row.errors.join('; ')}</span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600"><Check size={13} /> Valid</span>
                                )}
                            </td>
                            {keys.map((key) => (
                                <td key={key} className="p-3 font-semibold text-gray-700 dark:text-gray-200">{row.values[key] || '-'}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
