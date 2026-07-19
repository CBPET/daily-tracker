export const PROJECT_STATUS_OPTIONS = [
    'new',
    'scheduled',
    'in_progress',
    'on_hold',
    'completed',
    'delivered',
    'cancelled',
];

export const PROJECT_MANAGER_ROLES = ['super_admin', 'general_manager', 'manager', 'group_lead', 'team_lead'];

export const DEFAULT_PROJECT_CONFIG = {
    coreFields: [
        { key: 'title', label: 'Title', type: 'text', required: true, aliases: ['title', 'book title', 'job title'] },
        { key: 'client', label: 'Client', type: 'client', required: true, aliases: ['client', 'customer'] },
        { key: 'subDivision', label: 'Sub Division', type: 'text', aliases: ['sub division', 'sub_div', 'subdivision'] },
        { key: 'pageCount', label: 'Page Count', type: 'number', min: 0, aliases: ['page count', 'pages', 'extent'] },
        { key: 'complexityLevel', label: 'Complexity Level', type: 'text', aliases: ['complexity level', 'complexity'] },
        { key: 'status', label: 'Status', type: 'select', options: PROJECT_STATUS_OPTIONS, defaultValue: 'new', aliases: ['status'] },
        { key: 'textWordCount', label: 'Text Word Count', type: 'number', min: 0, aliases: ['text word count', 'text words'] },
        { key: 'referenceCount', label: 'Reference Count', type: 'number', min: 0, aliases: ['reference count', 'references'] },
        { key: 'referenceCountNotes', label: 'Reference count in notes', type: 'number', min: 0, aliases: ['reference count in notes', 'reference count notes', 'refs in notes'] },
        { key: 'refWordCount', label: 'Ref Word Count', type: 'number', min: 0, aliases: ['ref word count', 'reference word count'] },
        { key: 'referenceStyle', label: 'Reference style', type: 'text', aliases: ['reference style', 'ref style'] },
        { key: 'loginDate', label: 'Login Date', type: 'date', aliases: ['login date', 'received date'] },
        { key: 'revisedLoginDate', label: 'Revised Login Date', type: 'date', aliases: ['revised login date'] },
        { key: 'dueDate', label: 'Due Date', type: 'date', aliases: ['due date'] },
        { key: 'revisedDueDate', label: 'Revised Due Date', type: 'date', aliases: ['revised due date'] },
        { key: 'queries', label: 'Queries', type: 'textarea', aliases: ['queries', 'query'] },
        { key: 'remarks', label: 'Remark', type: 'textarea', aliases: ['remark', 'remarks', 'notes'] },
    ],
    workflowTemplates: {
        preedit: {
            label: 'Preedit workflow',
            stages: [
                { stage: 'Prestyle', taskType: 'Prestyle', division: 'PreEdit' },
                { stage: 'Cast-off', taskType: 'Cast-off XML Conversion', division: 'PreEdit' },
                { stage: 'Preedit', taskType: 'Preedit', division: 'PreEdit' },
                { stage: 'FP Validation', taskType: 'FP Validation', division: 'Validation' },
                { stage: 'Revises Validation', taskType: 'Revises Validation', division: 'Validation' },
            ],
        },
        normalisation: {
            label: 'Normalisation workflow',
            stages: [
                { stage: 'Normalisation', taskType: 'Normalisation', division: 'PreEdit' },
                { stage: 'Cast-off', taskType: 'Cast-off XML Conversion', division: 'PreEdit' },
                { stage: 'FP Validation', taskType: 'FP Validation', division: 'Validation' },
                { stage: 'Revises Validation', taskType: 'Revises Validation', division: 'Validation' },
            ],
        },
    },
    scheduleFields: [
        { key: 'assignedTo', label: 'Allocated to Performer', type: 'performer' },
        { key: 'dueFromPerformer', label: 'Due from Performer', type: 'date' },
        { key: 'completedFromPerformer', label: 'Completed from Performer', type: 'date' },
        { key: 'dueDate', label: 'Due Date', type: 'date' },
        { key: 'revisedDueDate', label: 'Revised Due Date', type: 'date' },
        { key: 'completedDate', label: 'Completed Date', type: 'date' },
    ],
};

export const CLIENT_PROJECT_FIELD_CONFIG = {
    DEFAULT: {
        displayName: 'Default Project Intake',
        config: DEFAULT_PROJECT_CONFIG,
    },
    OUP: {
        displayName: 'OUP',
        config: {
            fields: [
                { key: 'jobRequired', label: 'Job Required', type: 'select', aliases: ['job required', 'job type'], options: ['MUFO', 'Typecode-Only', 'TS', 'Reconvert', 'Prestyle', 'Preedit', 'MS Prep'] },
                { key: 'xmlProduct', label: 'XML Product', type: 'select', aliases: ['xml product'], options: ['Product', 'Nonproduct'] },
                { key: 'subDivision', label: 'SUB_DIV', type: 'select', aliases: ['sub_div', 'sub division'], options: ['Acad Oss', 'Acad US', 'Acad Ind', 'Acad UK'] },
            ],
        },
    },
    OOH: {
        displayName: 'OOH',
        config: {
            fields: [
                {
                    key: 'subDivision',
                    label: 'SUB_DIV',
                    type: 'select',
                    aliases: ['sub_div', 'sub division'],
                    options: [
                        'Bloomsbury UK', 'Bloomsbury US', 'JHUP', 'NNA', 'LLP', 'OOH', 'OOH_AGE_PUB', 'OOH_ARC',
                        'OOH_ARM', 'OOH_BritAcad', 'OOH_BUP', 'OOH_CP', 'OOH_GS', 'OOH_IBT', 'OOH_IBT-Flexi',
                        'OOH_MIP', 'OOH_MUP', 'OOH_RA Press', 'OOH_RSC', 'OOH_SUP', 'OOH_UCL', 'OOH_UL',
                        'OOH_UMP', 'OOH_BB', 'OOH-GLB', 'OOH-ICE', 'OOH-JKP', 'SUP', 'TNF_SPIB', 'Intellect',
                        'OOH_PI', 'OOH_Scribe', 'OOH_WITS', 'OOH_MC', 'BUP-RSP', 'OOH_BA', 'OOH_YUP', 'BAR',
                    ],
                },
            ],
        },
    },
    TNF: {
        displayName: 'TNF',
        config: {
            fields: [
                { key: 'model', label: 'Model', type: 'select', aliases: ['model'], options: ['Onshore', 'Offshore', 'Hybrid'] },
                { key: 'subDivision', label: 'SUB_DIV', type: 'select', aliases: ['sub_div', 'sub division'], options: ['TNF_FSM', 'OOH_TNF'] },
            ],
        },
    },
    OHO_OHB: {
        displayName: 'OHO/OHB',
        config: {
            fields: [
                { key: 'subDivision', label: 'SUB_DIV', type: 'select', aliases: ['sub_div', 'sub division'], options: ['US', 'UK'] },
            ],
        },
    },
};

export const PROJECT_DB_COLUMNS = {
    title: 'title',
    client: 'client_id',
    subDivision: 'sub_division',
    pageCount: 'page_count',
    complexityLevel: 'complexity_level',
    status: 'status',
    textWordCount: 'text_word_count',
    referenceCount: 'reference_count',
    referenceCountNotes: 'reference_count_notes',
    refWordCount: 'ref_word_count',
    referenceStyle: 'reference_style',
    loginDate: 'login_date',
    revisedLoginDate: 'revised_login_date',
    dueDate: 'due_date',
    revisedDueDate: 'revised_due_date',
    queries: 'queries',
    remarks: 'remarks',
};

export function normalizeHeader(header) {
    return String(header || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

export function normalizeClientCode(clientCode) {
    return String(clientCode || 'DEFAULT').trim().toUpperCase().replace(/[&/ ]+/g, '_');
}

function asArrayFields(fields) {
    if (Array.isArray(fields)) return fields;
    if (!fields || typeof fields !== 'object') return [];
    return Object.entries(fields).map(([key, field]) => ({ key, label: field.label || key, ...field }));
}

export function normalizeProjectConfig(config = {}) {
    return {
        ...DEFAULT_PROJECT_CONFIG,
        ...config,
        coreFields: asArrayFields(config.coreFields || DEFAULT_PROJECT_CONFIG.coreFields),
        fields: asArrayFields(config.fields || []),
        scheduleFields: asArrayFields(config.scheduleFields || DEFAULT_PROJECT_CONFIG.scheduleFields),
        workflowTemplates: config.workflowTemplates || DEFAULT_PROJECT_CONFIG.workflowTemplates,
    };
}

export function fallbackConfigRows() {
    return Object.entries(CLIENT_PROJECT_FIELD_CONFIG).map(([client_code, item]) => ({
        client_code,
        display_name: item.displayName,
        config: item.config,
        isFallback: true,
    }));
}

export function getConfigForClient(configRows = [], clientCode = 'DEFAULT') {
    const normalizedCode = normalizeClientCode(clientCode);
    const defaultRow = configRows.find((row) => normalizeClientCode(row.client_code) === 'DEFAULT')
        || fallbackConfigRows().find((row) => row.client_code === 'DEFAULT');
    const clientRow = configRows.find((row) => normalizeClientCode(row.client_code) === normalizedCode)
        || fallbackConfigRows().find((row) => normalizeClientCode(row.client_code) === normalizedCode);

    const defaultConfig = normalizeProjectConfig(defaultRow?.config);
    const clientConfig = normalizeProjectConfig(clientRow?.config || {});
    return normalizeProjectConfig({
        ...defaultConfig,
        ...clientConfig,
        coreFields: defaultConfig.coreFields,
        fields: clientConfig.fields || [],
        workflowTemplates: clientConfig.workflowTemplates || defaultConfig.workflowTemplates,
        scheduleFields: clientConfig.scheduleFields || defaultConfig.scheduleFields,
    });
}

export function getVisibleProjectFields(configRows = [], clientCode = 'DEFAULT') {
    const config = getConfigForClient(configRows, clientCode);
    const byKey = new Map();
    [...config.coreFields, ...config.fields].forEach((field) => {
        if (!field?.key) return;
        byKey.set(field.key, field);
    });
    return Array.from(byKey.values());
}

export function getAliasMap(fields = []) {
    return fields.reduce((acc, field) => {
        const aliases = [field.key, field.label, ...(field.aliases || [])].filter(Boolean);
        aliases.forEach((alias) => {
            acc[normalizeHeader(alias)] = field.key;
        });
        return acc;
    }, {});
}

export function mapRawProjectRow(row, configRows = [], initialClient = 'DEFAULT') {
    const baseFields = getVisibleProjectFields(configRows, initialClient);
    const baseAliasMap = getAliasMap(baseFields);
    const normalizedInput = Object.entries(row || {}).reduce((acc, [key, value]) => {
        acc[normalizeHeader(key)] = value;
        return acc;
    }, {});

    const firstPass = Object.entries(normalizedInput).reduce((acc, [header, value]) => {
        const fieldKey = baseAliasMap[header];
        if (fieldKey) acc[fieldKey] = value;
        return acc;
    }, {});

    const clientCode = firstPass.client || initialClient;
    const clientAliasMap = getAliasMap(getVisibleProjectFields(configRows, clientCode));
    return Object.entries(normalizedInput).reduce((acc, [header, value]) => {
        const fieldKey = clientAliasMap[header];
        if (fieldKey) acc[fieldKey] = value;
        return acc;
    }, firstPass);
}

export function parsePastedProjectRows(rawText, configRows = []) {
    const rows = String(rawText || '')
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter((line) => line.trim().length > 0);
    if (rows.length < 2) return [];

    const delimiter = rows[0].includes('\t') ? '\t' : ',';
    const headers = rows[0].split(delimiter).map((header) => header.trim());
    return rows.slice(1).map((line, index) => {
        const cells = line.split(delimiter).map((cell) => cell.trim());
        const rawRow = headers.reduce((acc, header, cellIndex) => {
            acc[header] = cells[cellIndex] || '';
            return acc;
        }, {});
        const values = mapRawProjectRow(rawRow, configRows);
        return {
            id: `paste-${index + 1}`,
            source: 'paste',
            rawRow,
            values,
            selected: true,
            errors: validateProjectValues(values, getVisibleProjectFields(configRows, values.client)),
        };
    });
}

export function validateProjectValues(values = {}, fields = []) {
    return fields.reduce((errors, field) => {
        const value = values[field.key];
        if (field.required && (value == null || String(value).trim() === '')) {
            errors.push(`${field.label || field.key} is required`);
        }
        if (field.type === 'number' && value !== '' && value != null) {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) errors.push(`${field.label || field.key} must be a number`);
            if (field.min != null && numeric < Number(field.min)) errors.push(`${field.label || field.key} must be at least ${field.min}`);
            if (field.max != null && numeric > Number(field.max)) errors.push(`${field.label || field.key} must be at most ${field.max}`);
        }
        if (field.type === 'select' && field.options?.length && value && !field.options.includes(value)) {
            errors.push(`${field.label || field.key} must match a configured option`);
        }
        return errors;
    }, []);
}

export function buildProjectRecordPayload(values = {}, fields = [], clients = [], userId = null, source = {}) {
    const payload = {
        status: values.status || 'new',
        client_fields: {},
        raw_source: source,
        created_by: userId,
        updated_by: userId,
    };

    fields.forEach((field) => {
        const value = values[field.key];
        if (PROJECT_DB_COLUMNS[field.key]) {
            const column = PROJECT_DB_COLUMNS[field.key];
            if (field.type === 'number') {
                payload[column] = value === '' || value == null ? null : Number(value);
            } else {
                payload[column] = value || null;
            }
        } else if (value !== undefined && value !== '') {
            payload.client_fields[field.key] = value;
        }
    });

    const client = clients.find((item) => item.code === payload.client_id || item.code === values.client);
    if (client) payload.client_ref = client.id;
    if (!payload.client_id && values.client) payload.client_id = values.client;
    return payload;
}

export function buildScheduleTemplateRows(templateKey, config = DEFAULT_PROJECT_CONFIG) {
    const normalizedConfig = normalizeProjectConfig(config);
    const template = normalizedConfig.workflowTemplates?.[templateKey];
    const stages = Array.isArray(template) ? template : template?.stages || [];
    return stages.map((stage, index) => ({
        stageOrder: index + 1,
        workflowStage: stage.stage || stage.workflowStage || String(stage),
        taskType: stage.taskType || stage.task_type || stage.stage || String(stage),
        division: stage.division || '',
        allocationStatus: 'unassigned',
    }));
}

export async function fetchPubKitProjects() {
    return [];
}
