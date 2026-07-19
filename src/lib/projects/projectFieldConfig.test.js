import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildProjectRecordPayload,
    buildScheduleTemplateRows,
    fallbackConfigRows,
    fetchPubKitProjects,
    getVisibleProjectFields,
    mapRawProjectRow,
    parsePastedProjectRows,
    validateProjectValues,
} from './projectFieldConfig.js';

test('visible fields come from JSON config and OOH has no TAT field', () => {
    const fields = getVisibleProjectFields(fallbackConfigRows(), 'OOH');

    assert.ok(fields.some((field) => field.key === 'title'));
    assert.ok(fields.some((field) => field.key === 'subDivision'));
    assert.equal(fields.some((field) => field.key === 'tatDays'), false);
});

test('mapRawProjectRow normalizes common Google Sheet headers from configured aliases', () => {
    const mapped = mapRawProjectRow({
        Title: 'Sample Book',
        Client: 'OUP',
        SUB_DIV: 'Acad UK',
        Pages: '320',
        Remark: 'Check author query',
    }, fallbackConfigRows());

    assert.deepEqual(mapped, {
        title: 'Sample Book',
        client: 'OUP',
        subDivision: 'Acad UK',
        pageCount: '320',
        remarks: 'Check author query',
    });
});

test('parsePastedProjectRows returns selected preview rows with validation status', () => {
    const [row] = parsePastedProjectRows(
        'Title\tClient\tSUB_DIV\tPages\nBook A\tOOH\tJHUP\t100',
        fallbackConfigRows()
    );

    assert.equal(row.selected, true);
    assert.equal(row.errors.length, 0);
    assert.equal(row.values.title, 'Book A');
    assert.equal(row.values.subDivision, 'JHUP');
});

test('validateProjectValues reports required and numeric issues', () => {
    const errors = validateProjectValues(
        { title: '', client: 'OUP', pageCount: 'abc' },
        getVisibleProjectFields(fallbackConfigRows(), 'OUP')
    );

    assert.ok(errors.includes('Title is required'));
    assert.ok(errors.includes('Page Count must be a number'));
});

test('buildProjectRecordPayload separates db columns and client fields', () => {
    const fields = getVisibleProjectFields(fallbackConfigRows(), 'OUP');
    const payload = buildProjectRecordPayload({
        title: 'Book A',
        client: 'OUP',
        pageCount: '150',
        jobRequired: 'Preedit',
    }, fields, [{ id: 'client-id', code: 'OUP' }], 'user-id', { source: 'test' });

    assert.equal(payload.title, 'Book A');
    assert.equal(payload.client_id, 'OUP');
    assert.equal(payload.page_count, 150);
    assert.equal(payload.client_ref, 'client-id');
    assert.deepEqual(payload.client_fields, { jobRequired: 'Preedit' });
});

test('buildScheduleTemplateRows returns ordered preedit workflow stages', () => {
    const rows = buildScheduleTemplateRows('preedit');

    assert.deepEqual(rows.map((row) => row.workflowStage), [
        'Prestyle',
        'Cast-off',
        'Preedit',
        'FP Validation',
        'Revises Validation',
    ]);
    assert.equal(rows[0].stageOrder, 1);
    assert.equal(rows[3].division, 'Validation');
    assert.equal(rows[4].allocationStatus, 'unassigned');
});

test('mock PubKit adapter returns normalized preview-compatible rows', async () => {
    const rows = await fetchPubKitProjects();

    assert.deepEqual(rows, []);
});
