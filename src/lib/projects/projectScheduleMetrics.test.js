import assert from 'node:assert/strict';
import test from 'node:test';
import {
    classifyTaskTiming,
    computeScheduleKpis,
    effectiveDueDate,
    filterTasksByKpi,
    isLongDelay,
    isTodayDue,
    periodWindow,
    reasonBreakdown,
} from './projectScheduleMetrics.js';
import {
    canEditProjectScheduleDates,
    canManageProjectDatabase,
    dashboardRoleTier,
    filterTasksForRole,
} from './projectScheduleScope.js';
import { isDateFieldPatch, reasonLabel } from './projectScheduleEvents.js';

test('effectiveDueDate prefers revised_due_date', () => {
    assert.equal(effectiveDueDate({ due_date: '2026-07-01', revised_due_date: '2026-07-10' }), '2026-07-10');
    assert.equal(effectiveDueDate({ due_date: '2026-07-01' }), '2026-07-01');
});

test('classifyTaskTiming ahead/ontime/delay', () => {
    const today = '2026-07-19';
    assert.equal(classifyTaskTiming({ due_date: '2026-07-20', allocation_status: 'assigned' }, today), 'ahead');
    assert.equal(classifyTaskTiming({ due_date: '2026-07-19', allocation_status: 'assigned' }, today), 'ontime');
    assert.equal(classifyTaskTiming({ due_date: '2026-07-10', allocation_status: 'assigned' }, today), 'delay');
    assert.equal(classifyTaskTiming({ due_date: '2026-07-10', allocation_status: 'completed' }, today), null);
});

test('today due and long delay helpers', () => {
    const today = '2026-07-19';
    assert.equal(isTodayDue({ due_date: '2026-07-19', allocation_status: 'assigned' }, today), true);
    assert.equal(isLongDelay({ due_date: '2026-07-01', allocation_status: 'assigned' }, today, 7), true);
    assert.equal(isLongDelay({ due_date: '2026-07-15', allocation_status: 'assigned' }, today, 7), false);
});

test('computeScheduleKpis counts delivery in period', () => {
    const now = new Date('2026-07-19T12:00:00Z');
    const tasks = [
        { id: '1', due_date: '2026-07-19', allocation_status: 'assigned' },
        { id: '2', due_date: '2026-07-01', allocation_status: 'assigned' },
        { id: '3', due_date: '2026-07-10', completed_date: '2026-07-12', allocation_status: 'completed' },
        { id: '4', due_date: '2026-08-01', allocation_status: 'assigned' },
    ];
    const kpis = computeScheduleKpis(tasks, { periodKey: 'month', now });
    assert.equal(kpis.counts.todayDue, 1);
    assert.equal(kpis.counts.longDelay, 1);
    assert.equal(kpis.counts.delivery, 1);
    assert.ok(kpis.window.start <= '2026-07-19');
});

test('filterTasksByKpi todayDue', () => {
    const now = new Date('2026-07-19T12:00:00Z');
    const tasks = [
        { id: '1', due_date: '2026-07-19', allocation_status: 'assigned' },
        { id: '2', due_date: '2026-07-18', allocation_status: 'assigned' },
    ];
    assert.deepEqual(filterTasksByKpi(tasks, 'todayDue', { now }).map((t) => t.id), ['1']);
});

test('periodWindow month spans ~30 days', () => {
    const window = periodWindow('month', new Date('2026-07-19T12:00:00Z'));
    assert.equal(window.end, '2026-07-19');
    assert.equal(window.days, 30);
});

test('reasonBreakdown aggregates reason_code', () => {
    const counts = reasonBreakdown([
        { event_type: 'schedule_date_change', new_values: { reason_code: 'leave' } },
        { event_type: 'schedule_date_change', new_values: { reason_code: 'leave' } },
        { event_type: 'other', new_values: { reason_code: 'priority' } },
    ]);
    assert.equal(counts.leave, 2);
    assert.equal(counts.priority, undefined);
});

test('scope helpers by role', () => {
    assert.equal(canManageProjectDatabase({ role: 'team_lead' }), true);
    assert.equal(canEditProjectScheduleDates({ role: 'performer' }), false);
    assert.equal(dashboardRoleTier({ role: 'manager' }), 'manager');
    assert.equal(dashboardRoleTier({ role: 'team_lead' }), 'lead');
    assert.equal(dashboardRoleTier({ role: 'performer' }), 'performer');

    const session = { user: { id: 'u1' } };
    const tasks = [
        { id: 'a', assigned_to: 'u1' },
        { id: 'b', assigned_to: 'u2' },
    ];
    assert.equal(filterTasksForRole(tasks, { role: 'performer' }, session).length, 1);
    assert.equal(filterTasksForRole(tasks, { role: 'manager' }, session).length, 2);
});

test('isDateFieldPatch detects schedule date keys', () => {
    assert.equal(isDateFieldPatch({ assigned_to: 'x' }), false);
    assert.equal(isDateFieldPatch({ due_date: '2026-07-01' }), true);
    assert.equal(reasonLabel('leave'), 'Leave');
});
