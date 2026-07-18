import * as XLSX from 'xlsx';

/**
 * Export entries to CSV format
 * @param {Array} entries - Array of entry objects
 * @param {string} filename - Base filename without extension
 */
export const exportToCSV = (entries, filename) => {
    if (!entries || entries.length === 0) {
        alert('No data to export');
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(formatEntriesForExport(entries));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Entries');

    const fullFilename = `${filename}_${getTimestamp()}.csv`;
    XLSX.writeFile(workbook, fullFilename, { bookType: 'csv' });
};

/**
 * Export entries to Excel (.xlsx) format
 * @param {Array} entries - Array of entry objects
 * @param {string} filename - Base filename without extension
 */
export const exportToExcel = (entries, filename) => {
    if (!entries || entries.length === 0) {
        alert('No data to export');
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(formatEntriesForExport(entries));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Entries');

    const colWidths = [
        { wch: 12 },
        { wch: 20 },
        { wch: 30 },
        { wch: 25 },
        { wch: 14 },
        { wch: 14 },
        { wch: 12 },
        { wch: 15 },
        { wch: 12 },
        { wch: 18 },
        { wch: 15 },
        { wch: 15 },
    ];
    worksheet['!cols'] = colWidths;

    const fullFilename = `${filename}_${getTimestamp()}.xlsx`;
    XLSX.writeFile(workbook, fullFilename);
};

/**
 * Format entries for export with consistent column headers
 */
const formatEntriesForExport = (entries) => {
    return entries.map((entry) => ({
        Date: entry.date,
        Performer: entry.performerName,
        'Project/Title': entry.titleName,
        'Task Type': entry.taskType,
        Client: entry.client_id || '',
        'Sub-division': entry.sub_division || '',
        'Work Done (Pages)': entry.completedPages,
        'Estimated Hours': entry.estimatedTime,
        'Taken Hours': entry.takenTime,
        'Target Achievement %': entry.targetAchieved,
        'Time Efficiency %': entry.timeAchieved,
        Status: entry.status,
    }));
};

const formatRatingsForExport = (rows, periodLabel, groupBy) =>
    (rows || []).map((row) => ({
        Period: periodLabel,
        'Group By': groupBy,
        Rank: row.rank,
        Name: row.label,
        'Performance Score %': row.score,
        Band: row.bandLabel,
        'Avg Target %': row.avgTarget ?? '',
        'Avg Time %': row.avgTime ?? '',
        'Total Hours': row.totalHours,
        Logs: row.count,
        'Misc Logs': row.miscCount,
        Client: row.client_id || '',
        'Sub-division': row.sub_division || '',
    }));

/**
 * Export ranked performance ratings to CSV
 */
export const exportRatingsToCSV = (
    rows,
    _entries,
    { filename = 'cbpet_performance_ratings', periodLabel = '', groupBy = 'individual' } = {}
) => {
    if (!rows || rows.length === 0) {
        alert('No rating data to export');
        return;
    }
    const worksheet = XLSX.utils.json_to_sheet(formatRatingsForExport(rows, periodLabel, groupBy));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ratings');
    XLSX.writeFile(workbook, `${filename}_${getTimestamp()}.csv`, { bookType: 'csv' });
};

/**
 * Export ratings summary + scoped raw entries to XLSX
 */
export const exportRatingsToExcel = (
    rows,
    entries,
    { filename = 'cbpet_performance_ratings', periodLabel = '', groupBy = 'individual' } = {}
) => {
    if (!rows || rows.length === 0) {
        alert('No rating data to export');
        return;
    }
    const workbook = XLSX.utils.book_new();
    const ratingsSheet = XLSX.utils.json_to_sheet(formatRatingsForExport(rows, periodLabel, groupBy));
    ratingsSheet['!cols'] = [
        { wch: 22 },
        { wch: 12 },
        { wch: 8 },
        { wch: 22 },
        { wch: 16 },
        { wch: 16 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 8 },
        { wch: 10 },
        { wch: 14 },
        { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(workbook, ratingsSheet, 'Ratings');

    if (entries?.length) {
        const detailSheet = XLSX.utils.json_to_sheet(formatEntriesForExport(entries));
        XLSX.utils.book_append_sheet(workbook, detailSheet, 'Entries');
    }

    XLSX.writeFile(workbook, `${filename}_${getTimestamp()}.xlsx`);
};

const getTimestamp = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}_${hours}-${minutes}`;
};
