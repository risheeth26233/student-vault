import { describe, expect, it } from 'vitest';
import { computeMastery, computeMasteryRecords, isMasteryEvidence } from '../intelligence/mastery';
import { normalizeLearningSignals } from '../signals/normalize';
import { MASTERY_DISCLAIMER, MASTERY_RULE, SIGNAL_WEIGHTS } from '../domain/constants';
import type { LearningSignal, SignalOutcome } from '../domain/types';
import { AT, fixtureSource, makeTopic } from './fixtures';

function signal(overrides: Partial<LearningSignal> = {}): LearningSignal {
  const kind = overrides.kind ?? 'assessment_result';
  const outcome: SignalOutcome = overrides.outcome ?? { type: 'scored', value: 0.5, raw: '5/10' };
  return {
    id: overrides.id ?? `signal-${kind}`,
    kind,
    subjectId: 'subject-1',
    topicId: 'topic-1',
    conceptIds: ['concept_topic_topic-1'],
    observedAt: AT,
    outcome,
    weight: SIGNAL_WEIGHTS[kind],
    evidence: {
      sourceType: 'assessment',
      sourceId: 'assessment-1',
      label: 'Assessment: quiz',
      detail: 'quiz score 5/10 (50%)',
      observedAt: AT,
    },
    ...overrides,
  };
}

function masteryFor(signals: LearningSignal[]) {
  return computeMastery({
    scope: 'topic',
    subjectId: 'subject-1',
    topicId: 'topic-1',
    label: 'Quadratic Equations',
    signals,
    computedAt: AT,
  });
}

describe('mastery foundation', () => {
  it('reports insufficient evidence instead of guessing', () => {
    const record = masteryFor([]);

    expect(record.level).toBe('insufficient_evidence');
    expect(record.score).toBeNull();
    expect(record.evidenceCount).toBe(0);
    expect(record.confidence).toBe('none');
    expect(record.contributions).toEqual([]);
    expect(record.ruleId).toBe(MASTERY_RULE);
    expect(record.disclaimer).toBe(MASTERY_DISCLAIMER);
  });

  it('computes a weighted average from recorded evidence only', () => {
    const record = masteryFor([
      signal({ id: 's1', outcome: { type: 'scored', value: 0.5, raw: '5/10' } }),
      signal({
        id: 's2',
        kind: 'study_activity',
        outcome: { type: 'progress', value: 1 / 3, raw: '1/3' },
        evidence: {
          sourceType: 'topic',
          sourceId: 'topic-1',
          label: 'Topic: Quadratic Equations',
          detail: 'Checklist 1/3 complete',
          observedAt: AT,
        },
      }),
    ]);

    // (0.5*1 + 0.3333*0.6) / (1 + 0.6) = 0.69998 / 1.6
    expect(record.score).toBe(0.4375);
    expect(record.evidenceCount).toBe(2);
    expect(record.confidence).toBe('medium');
    expect(record.level).toBe('developing');
    expect(record.contributingKinds).toEqual(['assessment_result', 'study_activity']);
  });

  it('ignores attendance and resource activity as mastery evidence', () => {
    const signals = [
      signal({ id: 's1', kind: 'attendance_session', outcome: { type: 'binary', value: 1, raw: 'present' } }),
      signal({ id: 's2', kind: 'resource_activity', outcome: { type: 'binary', value: 1, raw: 'attached' } }),
      signal({ id: 's3', outcome: { type: 'scored', value: 0.2, raw: '2/10' } }),
    ];

    expect(isMasteryEvidence(signals[0])).toBe(false);
    expect(isMasteryEvidence(signals[1])).toBe(false);

    const record = masteryFor(signals);
    expect(record.evidenceCount).toBe(1);
    expect(record.score).toBe(0.2);
    expect(record.level).toBe('emerging');
    expect(record.confidence).toBe('low');
  });

  it('treats unfinished assignments as activity, not evidence', () => {
    const pending = signal({
      id: 's1',
      kind: 'assignment_outcome',
      outcome: { type: 'none', raw: 'in_progress' },
    });
    const completed = signal({
      id: 's2',
      kind: 'assignment_outcome',
      outcome: { type: 'binary', value: 1, raw: 'completed' },
    });

    expect(masteryFor([pending]).evidenceCount).toBe(0);
    expect(masteryFor([completed]).evidenceCount).toBe(1);
    expect(masteryFor([completed]).score).toBe(1);
  });

  it('applies deterministic mastery bands', () => {
    const at = (value: number) =>
      masteryFor([signal({ id: `s${value}`, outcome: { type: 'scored', value, raw: String(value) } })]).level;

    expect(at(0.2)).toBe('emerging');
    expect(at(0.39)).toBe('emerging');
    expect(at(0.4)).toBe('developing');
    expect(at(0.69)).toBe('developing');
    expect(at(0.7)).toBe('secure');
    expect(at(1)).toBe('secure');
  });

  it('always carries an honest disclaimer', () => {
    const record = masteryFor([signal({ id: 's1' })]);
    expect(record.disclaimer).toContain('Not a validated prediction');
  });

  it('produces identical records for identical inputs', () => {
    const normalized = normalizeLearningSignals(fixtureSource(), AT);
    expect(computeMasteryRecords(normalized, AT)).toEqual(computeMasteryRecords(normalized, AT));
  });

  it('covers every topic, concept and subject in the snapshot', () => {
    const normalized = normalizeLearningSignals(fixtureSource(), AT);
    const records = computeMasteryRecords(normalized, AT);

    const scopes = new Set(records.map((record) => record.scope));
    expect(scopes).toEqual(new Set(['topic', 'concept', 'subject']));
    expect(records.filter((record) => record.scope === 'topic')).toHaveLength(normalized.topics.length);
    expect(records.filter((record) => record.scope === 'concept')).toHaveLength(normalized.concepts.length);
    expect(records.filter((record) => record.scope === 'subject')).toHaveLength(normalized.subjects.length);
  });

  it('keeps mastery at insufficient evidence for a brand new topic', () => {
    const normalized = normalizeLearningSignals(
      { topics: [makeTopic({ id: 'fresh', checklist: undefined })] },
      AT
    );
    const record = computeMasteryRecords(normalized, AT).find((item) => item.topicId === 'fresh');

    expect(record?.level).toBe('insufficient_evidence');
    expect(record?.score).toBeNull();
  });
});
