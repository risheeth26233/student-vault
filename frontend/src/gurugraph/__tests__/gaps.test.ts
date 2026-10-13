import { describe, expect, it } from 'vitest';
import { EMITTABLE_GAP_CATEGORIES, detectLearningGaps } from '../intelligence/gaps';
import { normalizeLearningSignals } from '../signals/normalize';
import { GAP_RULES, LOW_SCORE_THRESHOLD } from '../domain/constants';
import type { GapCategory, GuruGraphDataSource } from '../domain/types';
import { AT, fixtureSource, makeAssessment, makeResource, makeTopic } from './fixtures';

function gapsFor(source: GuruGraphDataSource) {
  const normalized = normalizeLearningSignals(source, AT);
  return detectLearningGaps(normalized, AT);
}

describe('learning gap representation', () => {
  it('flags a recorded low score as a candidate learning gap with evidence', () => {
    const gaps = gapsFor(fixtureSource());
    const gap = gaps.find((item) => item.topicId === 'topic-1');

    expect(gap).toBeDefined();
    expect(gap?.category).toBe('potential_learning_gap');
    expect(gap?.ruleId).toBe(GAP_RULES.lowScore);
    expect(gap?.status).toBe('candidate');
    expect(gap?.severity).toBe('low');
    expect(gap?.evidence.map((item) => item.sourceId)).toContain('assessment-1');
    expect(gap?.reason).toContain(`${Math.round(LOW_SCORE_THRESHOLD * 100)}%`);
    expect(gap?.disclaimer).toContain('not a confirmed misconception');
    expect(gap?.distinguishers).toEqual({
      confirmedMisconception: false,
      lowAttendance: false,
      missingData: false,
      insufficientEvidence: false,
    });
  });

  it('separates missing data from a learning gap', () => {
    const gap = gapsFor(fixtureSource()).find((item) => item.topicId === 'topic-3');

    expect(gap?.category).toBe('missing_data');
    expect(gap?.ruleId).toBe(GAP_RULES.missingData);
    expect(gap?.severity).toBe('unknown');
    expect(gap?.distinguishers).toEqual({
      confirmedMisconception: false,
      lowAttendance: false,
      missingData: true,
      insufficientEvidence: false,
    });
    expect(gap?.evidence).toEqual([]);
  });

  it('separates insufficient evidence from missing data and from a gap', () => {
    const gaps = gapsFor({
      topics: [makeTopic({ id: 'ctx', subject: 'Biology', title: 'Cells', checklist: undefined })],
      resources: [makeResource({ id: 'r-ctx', topicId: 'ctx' })],
    });
    const gap = gaps.find((item) => item.topicId === 'ctx');

    expect(gap?.category).toBe('insufficient_evidence');
    expect(gap?.ruleId).toBe(GAP_RULES.insufficientEvidence);
    expect(gap?.distinguishers).toEqual({
      confirmedMisconception: false,
      lowAttendance: false,
      missingData: false,
      insufficientEvidence: true,
    });
    expect(gap?.evidence.map((item) => item.sourceId)).toEqual(['r-ctx']);
  });

  it('separates low attendance from a learning gap', () => {
    const gap = gapsFor(fixtureSource()).find((item) => item.category === 'low_attendance');

    expect(gap).toBeDefined();
    expect(gap?.scope).toBe('subject');
    expect(gap?.topicId).toBeNull();
    expect(gap?.ruleId).toBe(GAP_RULES.lowAttendance);
    expect(gap?.severity).toBe('high');
    expect(gap?.distinguishers).toEqual({
      confirmedMisconception: false,
      lowAttendance: true,
      missingData: false,
      insufficientEvidence: false,
    });
    expect(gap?.detail).toContain('not a learning gap');
  });

  it('does not report low attendance when the student meets their target', () => {
    const gaps = gapsFor({
      attendanceSubjects: [
        {
          id: 'att-ok',
          name: 'Chemistry',
          target: 75,
          records: [
            { id: 'r1', record: 'present', createdAt: AT },
            { id: 'r2', record: 'present', createdAt: AT },
            { id: 'r3', record: 'present', createdAt: AT },
          ],
        },
      ],
    });
    expect(gaps).toEqual([]);
  });

  it('never emits a confirmed misconception in Phase 2', () => {
    const gaps = gapsFor({
      ...fixtureSource(),
      assessments: [makeAssessment({ id: 'failing', score: 0, maxScore: 10, topicId: 'topic-1' })],
    });

    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.some((gap) => gap.category === 'confirmed_misconception')).toBe(false);
    expect(EMITTABLE_GAP_CATEGORIES).not.toContain('confirmed_misconception');
    expect(EMITTABLE_GAP_CATEGORIES).toEqual(
      expect.arrayContaining<GapCategory>([
        'potential_learning_gap',
        'low_attendance',
        'missing_data',
        'insufficient_evidence',
      ])
    );
  });

  it('keeps exactly one category per finding and is deterministic', () => {
    const first = gapsFor(fixtureSource());
    const second = gapsFor(fixtureSource());

    expect(second).toEqual(first);
    expect(first).toHaveLength(3);
    for (const gap of first) {
      const flags = Object.values(gap.distinguishers).filter(Boolean);
      expect(flags.length).toBeLessThanOrEqual(1);
    }
  });

  it('raises severity as the recorded score falls', () => {
    const build = (score: number) =>
      gapsFor({
        topics: [makeTopic({ id: 'graded', subject: 'Mathematics' })],
        assessments: [makeAssessment({ topicId: 'graded', score, maxScore: 10 })],
      }).find((item) => item.category === 'potential_learning_gap');

    expect(build(5.5)?.severity).toBe('low');
    expect(build(4.5)?.severity).toBe('medium');
    expect(build(2)?.severity).toBe('high');
  });
});
