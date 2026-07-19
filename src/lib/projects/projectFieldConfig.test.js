import assert from 'node:assert/strict';
import test from 'node:test';
import {
    PROJECT_COMPLEXITY_OPTIONS,
    PROJECT_DEFAULT_STATUS,
    PROJECT_STATUS_OPTIONS,
    buildProjectRecordPayload,
    buildScheduleTemplateRows,
    fallbackConfigRows,
    fetchPubKitProjects,
    getVisibleProjectFields,
    mapRawProjectRow,
    normalizeFieldDef,
    normalizeProjectDate,
    parsePastedProjectRows,
    splitFormEntryFields,
    validateProjectValues,
} from './projectFieldConfig.js';

test('visible fields come from JSON config and OOH has no TAT field', () => {
    const fields = getVisibleProjectFields(fallbackConfigRows(), 'OOH');

    assert.ok(fields.some((field) => field.key === 'title'));
    assert.ok(fields.some((field) => field.key === 'subDivision'));
    assert.equal(fields.some((field) => field.key === 'tatDays'), false);
});

test('status and complexity options match Form Entry', () => {
    const statusField = getVisibleProjectFields(fallbackConfigRows(), 'DEFAULT')
        .find((field) => field.key === 'status');
    const complexityField = getVisibleProjectFields(fallbackConfigRows(), 'DEFAULT')
        .find((field) => field.key === 'complexityLevel');

    assert.equal(statusField.defaultValue, PROJECT_DEFAULT_STATUS);
    assert.equal(statusField.required, true);
    assert.deepEqual(statusField.options, PROJECT_STATUS_OPTIONS);
    assert.equal(complexityField.type, 'select');
    assert.equal(complexityField.required, true);
    assert.deepEqual(complexityField.options, PROJECT_COMPLEXITY_OPTIONS);
});

test('normalizeFieldDef forces complexity select even when DB config says text', () => {
    const forced = normalizeFieldDef({
        key: 'complexityLevel',
        label: 'Complexity Level',
        type: 'text',
        aliases: ['complexity'],
    });
    assert.equal(forced.type, 'select');
    assert.deepEqual(forced.options, PROJECT_COMPLEXITY_OPTIONS);
    assert.equal(forced.required, true);
});

test('splitFormEntryFields puts counts under optional and hides remarks', () => {
    const { mainFields, optionalFields } = splitFormEntryFields(
        getVisibleProjectFields(fallbackConfigRows(), 'OUP')
    );

    assert.ok(mainFields.some((field) => field.key === 'loginDate' && field.required));
    assert.ok(mainFields.some((field) => field.key === 'dueDate' && !field.required));
    assert.ok(optionalFields.some((field) => field.key === 'textWordCount'));
    assert.equal(mainFields.some((field) => field.key === 'remarks'), false);
    assert.equal(optionalFields.some((field) => field.key === 'remarks'), false);
});

test('normalizeProjectDate parses Google Sheet style dates', () => {
    assert.equal(normalizeProjectDate('14 Jul 26'), '2026-07-14');
    assert.equal(normalizeProjectDate('16 Jul 2026'), '2026-07-16');
    assert.equal(normalizeProjectDate('2026-07-01'), '2026-07-01');
});

test('mapRawProjectRow normalizes common Google Sheet headers from configured aliases', () => {
    const mapped = mapRawProjectRow({
        Title: 'Sample Book',
        Client: 'OUP',
        SUB_DIV: 'Acad UK',
        Pages: '320',
        Remark: 'Check author query',
    }, fallbackConfigRows(), 'OUP');

    assert.equal(mapped.title, 'Sample Book');
    assert.equal(mapped.client, 'OUP');
    assert.equal(mapped.subDivision, 'Acad UK');
    assert.equal(mapped.pageCount, '320');
    assert.equal(mapped.remarks, 'Check author query');
    assert.equal(mapped.status, PROJECT_DEFAULT_STATUS);
});

test('OUP paste maps iTitle / MSS Count / Job Level / Client/Div', () => {
    const [row] = parsePastedProjectRows(
        [
            'iTitle\tMSS Count\tLogin\tJob Level\tClient/Div\tJob Required\tXML Product (Product/Nonproduct)',
            'Delston140726_BITS_ATUS\t322\t14 Jul 26\tSimple\tAcad US\tMUFO\tProduct',
        ].join('\n'),
        fallbackConfigRows(),
        'OUP'
    );

    assert.equal(row.values.client, 'OUP');
    assert.equal(row.values.title, 'Delston140726_BITS_ATUS');
    assert.equal(row.values.pageCount, '322');
    assert.equal(row.values.loginDate, '2026-07-14');
    assert.equal(row.values.complexityLevel, 'Simple');
    assert.equal(row.values.subDivision, 'Acad US');
    assert.equal(row.values.jobRequired, 'MUFO');
    assert.equal(row.values.xmlProduct, 'Product');
    assert.equal(row.errors.length, 0);
});

test('TNF paste maps Onshore/Offshore and Client as SUB_DIV', () => {
    const [row] = parsePastedProjectRows(
        [
            'Title\tOnshore/Offshore\tClient\tLogin Date\tRevised Login Date\tPage Count\tComplexity Level',
            'D2V242_Gouveia130726TNF_FSM\tOffshore\tTNF_FSM\t17 Jul 26\t\t644\tSimple',
        ].join('\n'),
        fallbackConfigRows(),
        'TNF'
    );

    assert.equal(row.values.client, 'TNF');
    assert.equal(row.values.subDivision, 'TNF_FSM');
    assert.equal(row.values.model, 'Offshore');
    assert.equal(row.values.loginDate, '2026-07-17');
    assert.equal(row.values.pageCount, '644');
    assert.equal(row.errors.length, 0);
});

test('OOH paste maps Client column to SUB_DIV and WIP status', () => {
    const [row] = parsePastedProjectRows(
        [
            'Title\tClient\tLogin Date\tRevised Login Date\tPage Count\tComplexity Level\tStatus',
            'Aagaard080726_BUP-RSP\tOOH_BUP\t15 Jul 26\t\t275\tSimple\tWIP',
        ].join('\n'),
        fallbackConfigRows(),
        'OOH'
    );

    assert.equal(row.values.client, 'OOH');
    assert.equal(row.values.subDivision, 'OOH_BUP');
    assert.equal(row.values.status, 'wip');
    assert.equal(row.values.loginDate, '2026-07-15');
    assert.equal(row.errors.length, 0);
});

test('parsePastedProjectRows returns selected preview rows with validation status', () => {
    const [row] = parsePastedProjectRows(
        [
            'Title\tClient\tPage Count\tComplexity Level\tStatus\tLogin Date',
            'Book A\tJHUP\t100\tSimple\tyet_to_plan\t2026-07-01',
        ].join('\n'),
        fallbackConfigRows(),
        'OOH'
    );

    assert.equal(row.selected, true);
    assert.equal(row.errors.length, 0);
    assert.equal(row.values.title, 'Book A');
    assert.equal(row.values.client, 'OOH');
    assert.equal(row.values.subDivision, 'JHUP');
    assert.equal(row.values.complexityLevel, 'Simple');
});

test('validateProjectValues reports required and numeric issues', () => {
    const errors = validateProjectValues(
        { title: '', client: 'OUP', pageCount: 'abc' },
        getVisibleProjectFields(fallbackConfigRows(), 'OUP')
    );

    assert.ok(errors.includes('Title is required'));
    assert.ok(errors.includes('Page Count must be a number'));
    assert.ok(errors.includes('SUB_DIV is required'));
    assert.ok(errors.includes('Complexity Level is required'));
    assert.ok(errors.includes('Login Date is required'));
});

test('buildProjectRecordPayload separates db columns and client fields', () => {
    const fields = getVisibleProjectFields(fallbackConfigRows(), 'OUP');
    const payload = buildProjectRecordPayload({
        title: 'Book A',
        client: 'OUP',
        pageCount: '150',
        jobRequired: 'Preedit',
        status: PROJECT_DEFAULT_STATUS,
    }, fields, [{ id: 'client-id', code: 'OUP' }], 'user-id', { source: 'test' });

    assert.equal(payload.title, 'Book A');
    assert.equal(payload.client_id, 'OUP');
    assert.equal(payload.page_count, 150);
    assert.equal(payload.status, PROJECT_DEFAULT_STATUS);
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
