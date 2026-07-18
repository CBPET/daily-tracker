import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { exportToCSV, exportToExcel } from '../lib/exportUtils';

const DataExport = ({ entries, filteredEntries, label = 'Export Data' }) => {
    const [exportFormat, setExportFormat] = useState('csv');
    const [dataScope, setDataScope] = useState('filtered');

    const handleExport = () => {
        const dataToExport = dataScope === 'filtered' ? filteredEntries : entries;
        const baseFilename = 'cbpet_export';

        if (!dataToExport || dataToExport.length === 0) {
            alert('No data available to export');
            return;
        }

        if (exportFormat === 'csv') {
            exportToCSV(dataToExport, baseFilename);
        } else {
            exportToExcel(dataToExport, baseFilename);
        }
    };

    const hasData = entries && entries.length > 0;
    const hasFilteredData = filteredEntries && filteredEntries.length > 0;

    return (
        <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">{label}</span>
            
            {/* Data Scope Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button
                    onClick={() => setDataScope('filtered')}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${
                        dataScope === 'filtered'
                            ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    Filtered
                </button>
                <button
                    onClick={() => setDataScope('all')}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${
                        dataScope === 'all'
                            ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    All
                </button>
            </div>

            {/* Format Selection */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button
                    onClick={() => setExportFormat('csv')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${
                        exportFormat === 'csv'
                            ? 'bg-white dark:bg-gray-700 text-green-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                    title="Export as CSV"
                >
                    <FileText size={12} />
                    CSV
                </button>
                <button
                    onClick={() => setExportFormat('xlsx')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${
                        exportFormat === 'xlsx'
                            ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                    title="Export as Excel"
                >
                    <FileSpreadsheet size={12} />
                    Excel
                </button>
            </div>

            {/* Export Button */}
            <button
                onClick={handleExport}
                disabled={!hasData || (dataScope === 'filtered' && !hasFilteredData)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 ${
                    hasData && (dataScope === 'all' || hasFilteredData)
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
            >
                <Download size={14} />
                Export
            </button>
        </div>
    );
};

export default DataExport;
