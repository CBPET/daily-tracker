import React from 'react';

const commonClass = 'w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500';

function optionValue(option) {
    return typeof option === 'object' && option != null ? option.value : option;
}

function optionLabel(option) {
    return typeof option === 'object' && option != null ? (option.label || option.value) : option;
}

export default function ProjectField({ field, value, clients, disabled, onChange }) {
    const label = (
        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
            {field.label || field.key}{field.required ? ' *' : ''}
        </label>
    );

    if (field.type === 'textarea') {
        return (
            <div>
                {label}
                <textarea
                    value={value || ''}
                    disabled={disabled}
                    onChange={(event) => onChange(field.key, event.target.value)}
                    rows={3}
                    className={commonClass}
                />
            </div>
        );
    }

    if (field.type === 'select') {
        return (
            <div>
                {label}
                <select
                    value={value || ''}
                    disabled={disabled}
                    onChange={(event) => onChange(field.key, event.target.value)}
                    className={commonClass}
                >
                    <option value="">Select</option>
                    {(field.options || []).map((option) => {
                        const valueKey = optionValue(option);
                        return (
                            <option key={valueKey} value={valueKey}>{optionLabel(option)}</option>
                        );
                    })}
                </select>
            </div>
        );
    }

    if (field.type === 'client') {
        return (
            <div>
                {label}
                <select
                    value={value || ''}
                    disabled={disabled}
                    onChange={(event) => onChange(field.key, event.target.value)}
                    className={commonClass}
                >
                    <option value="">Select client</option>
                    {clients.map((client) => (
                        <option key={client.id || client.code} value={client.code}>{client.code}</option>
                    ))}
                </select>
            </div>
        );
    }

    return (
        <div>
            {label}
            <input
                type={field.type === 'number' || field.type === 'date' ? field.type : 'text'}
                min={field.min}
                max={field.max}
                value={value || ''}
                disabled={disabled}
                onChange={(event) => onChange(field.key, event.target.value)}
                className={commonClass}
            />
        </div>
    );
}
