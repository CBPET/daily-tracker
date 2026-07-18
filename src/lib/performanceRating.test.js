import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    scoreMiscellaneous,
    scoreComposite,
    scoreEntry,
    getRatingBand,
    filterEntriesByPeriod,
    listAvailablePeriods,
    aggregatePerformanceRatings,
    partitionByDivision,
    parseAnalyticsHash,
    buildAnalyticsDeepLink,
    getPreviousWeekRange,
    capScore,
} from './performanceRating.js';
import {
    STANDARD_TARGETS,
    calcEstimatedHours,
    normalizeTaskType,
} from './targetUtils.js';

describe('performanceRating scoring', () => {
    it('caps scores at 100', () => {
        assert.equal(capScore(150), 100);
        assert.equal(capScore(-5), 0);
    });

    it('scores Miscellaneous as hours/8 * 100', () => {
        assert.equal(scoreMiscellaneous(2), 25);
        assert.equal(scoreMiscellaneous(4), 50);
        assert.equal(scoreMiscellaneous(8), 100);
        assert.equal(scoreMiscellaneous(10), 100); // capped
    });

    it('scores composite as 60/40 capped', () => {
        // 60*100 + 40*50 = 80
        assert.equal(scoreComposite(100, 50), 80);
        // over 100 inputs capped
        assert.equal(scoreComposite(200, 200), 100);
    });

    it('routes entry scoring by task type', () => {
        assert.equal(scoreEntry({ taskType: 'Miscellaneous', takenTime: 2 }), 25);
        assert.equal(
            scoreEntry({ taskType: 'Preedit', targetAchieved: 100, timeAchieved: 50 }),
            80
        );
    });

    it('assigns rating bands', () => {
        assert.equal(getRatingBand(90).id, 'excellent');
        assert.equal(getRatingBand(75).id, 'good');
        assert.equal(getRatingBand(74.9).id, 'needs_improvement');
    });
});

describe('targetUtils estimated hours', () => {
    it('estimates hours from completed work and daily target', () => {
        assert.equal(calcEstimatedHours('Preedit', 150, STANDARD_TARGETS.Preedit), 4);
        assert.equal(calcEstimatedHours('Prestyle', 900, STANDARD_TARGETS.Prestyle), 8);
        assert.equal(calcEstimatedHours('Cast-off XML Conversion', 2, STANDARD_TARGETS['Cast-off XML Conversion']), 4);
    });

    it('supports FP/FL Validation alias through canonical target lookup', () => {
        const target = STANDARD_TARGETS[normalizeTaskType('FL Validation')];
        assert.equal(calcEstimatedHours('FL Validation', 300, target), 4);
    });

    it('keeps Miscellaneous manual', () => {
        assert.equal(calcEstimatedHours('Miscellaneous', 2, 300), 0);
    });
});

describe('performanceRating periods', () => {
    const entries = [
        { date: '2026-01-15', taskType: 'Preedit', takenTime: 2, targetAchieved: 100, timeAchieved: 100, performerName: 'A', user_id: 'u1' },
        { date: '2026-04-10', taskType: 'Preedit', takenTime: 2, targetAchieved: 80, timeAchieved: 80, performerName: 'A', user_id: 'u1' },
        { date: '2026-07-14', taskType: 'Miscellaneous', takenTime: 4, performerName: 'B', user_id: 'u2' },
    ];

    it('lists available periods', () => {
        const p = listAvailablePeriods(entries);
        assert.ok(p.monthly.includes('2026-07'));
        assert.ok(p.quarterly.includes('2026-Q3'));
        assert.ok(p.yearly.includes('2026'));
    });

    it('filters monthly and quarterly', () => {
        assert.equal(filterEntriesByPeriod(entries, { mode: 'monthly', key: '2026-07' }).length, 1);
        assert.equal(filterEntriesByPeriod(entries, { mode: 'quarterly', key: '2026-Q2' }).length, 1);
        assert.equal(filterEntriesByPeriod(entries, { start: '2026-07-13', end: '2026-07-19' }).length, 1);
    });

    it('computes previous Monday-Sunday week', () => {
        // Friday Jul 17 2026 → previous week Mon Jul 6 – Sun Jul 12
        const range = getPreviousWeekRange(new Date('2026-07-17T12:00:00'));
        assert.equal(range.start, '2026-07-06');
        assert.equal(range.end, '2026-07-12');
    });
});

describe('performanceRating aggregation', () => {
    it('aggregates individuals with hour weighting and includes Miscellaneous', () => {
        const entries = [
            { taskType: 'Preedit', takenTime: 2, targetAchieved: 100, timeAchieved: 100, performerName: 'Alex', user_id: '1' },
            { taskType: 'Miscellaneous', takenTime: 2, performerName: 'Alex', user_id: '1' },
            { taskType: 'Preedit', takenTime: 4, targetAchieved: 50, timeAchieved: 50, performerName: 'Sam', user_id: '2' },
        ];
        // Alex: score 100*2 + 25*2 = 250 / 4 = 62.5
        const rows = aggregatePerformanceRatings(entries, 'individual');
        const alex = rows.find((r) => r.label === 'Alex');
        assert.equal(alex.score, 62.5);
        assert.equal(alex.miscCount, 1);
        assert.ok(rows[0].rank === 1);
    });

    it('groups by process', () => {
        const entries = [
            { taskType: 'Preedit', takenTime: 2, targetAchieved: 100, timeAchieved: 100, performerName: 'A' },
            { taskType: 'Miscellaneous', takenTime: 4, performerName: 'B' },
        ];
        const rows = aggregatePerformanceRatings(entries, 'process');
        assert.equal(rows.length, 2);
        const misc = rows.find((r) => r.label === 'Miscellaneous');
        assert.equal(misc.score, 50);
    });
});

describe('division partition and deep links', () => {
    it('partitions by client and sub_division', () => {
        const parts = partitionByDivision([
            { client_id: 'OUP', sub_division: 'PreEdit' },
            { client_id: 'OUP', sub_division: 'PreEdit' },
            { client_id: 'OUP', sub_division: 'Validation' },
            { client_id: 'CUP' },
        ]);
        assert.equal(parts.length, 3);
        const oupPre = parts.find((p) => p.client_id === 'OUP' && p.sub_division === 'PreEdit');
        assert.equal(oupPre.entries.length, 2);
    });

    it('parses and builds analytics deep links', () => {
        const link = buildAnalyticsDeepLink({
            baseUrl: 'https://example.com/app',
            client: 'OUP',
            division: 'PreEdit',
            start: '2026-07-06',
            end: '2026-07-12',
        });
        assert.ok(link.includes('#analytics?'));
        assert.ok(link.includes('tab=ratings'));
        assert.ok(link.includes('client=OUP'));

        const parsed = parseAnalyticsHash('#analytics?tab=ratings&client=OUP&division=PreEdit&start=2026-07-06&end=2026-07-12');
        assert.equal(parsed.path, 'analytics');
        assert.equal(parsed.tab, 'ratings');
        assert.equal(parsed.client, 'OUP');
        assert.equal(parsed.division, 'PreEdit');
    });
});
