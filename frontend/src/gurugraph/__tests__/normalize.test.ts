import { describe, expect, it } from 'vitest';
import { normalizeLearningSignals } from '../signals/normalize';
import { subjectIdFromLabel } from '../domain/ids';
import type { GuruGraphDataSource } from '../domain/types';
import { AT, fixtureSource, makeAssessment, makeAssignment, makeTopic } from './fixtures';

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  copy.unshift(copy.pop() as T);
  copy.push(copy.shift() as T);
  return copy;
}

function shuffled(source: GuruGraphDataSource): GuruGraphDataSource {
  return {
    topics: shuffle(source.topics ?? []),
    assessments: shuffle(source.assessments ?? []),
    assignments: shuffle(source.assignments ?? []),
    attendanceSubjects: shuffle(source.attendanceSubjects ?? []),
    resources: shuffle(source.resources ?? []),
    subjectRegistry: source.subjectRegistry,
  };
}

describe('signal normalization', () => {
  it('turns every supported Student-Vault source into learning signals', () => {
    const normalized = normalizeLearningSignals(fixtureSource(), AT);

    const kinds = new Set(normalized.signals.map((signal) => signal.kind));
    expect(kinds).toEqual(
      new Set([
        'study_activity',
        'assessment_result',
        'assignment_outcome',
        'attendance_session',
        'resource_activity',
      ])
    );
    expect(normalized.signals).toHaveLength(10);
    expect(normalized.skipped).toHaveLength(0);
  });

  it('produces evidence for every signal', () => {
    const normalized = normalizeLearningSignals(fixtureSource(), AT);
    for (const signal of normalized.signals) {
      expect(signal.id).toBeTruthy();
      expect(signal.weight).toBeGreaterThan(0);
      expect(signal.evidence.sourceId).toBeTruthy();
      expect(signal.evidence.sourceType).toBeTruthy();
      expect(signal.evidence.label).toBeTruthy();
      expect(signal.evidence.detail).toBeTruthy();
      expect(Number.isNaN(Date.parse(signal.observedAt))).toBe(false);
      if (signal.outcome.type !== 'none') {
        expect(signal.outcome.value).toBeGreaterThanOrEqual(0);
        expect(signal.outcome.value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('does not invent signals for activity that never happened', () => {
    const normalized = normalizeLearningSignals(
      { topics: [makeTopic({ checklist: undefined })] },
      AT
    );
    expect(normalized.signals).toHaveLength(0);
    expect(normalized.topics).toHaveLength(1);
  });

  it('is deterministic and independent of input ordering', () => {
    const first = normalizeLearningSignals(fixtureSource(), AT);
    const second = normalizeLearningSignals(shuffled(fixtureSource()), AT);

    expect(second.signals.map((signal) => signal.id)).toEqual(first.signals.map((signal) => signal.id));
    expect(second.subjects).toEqual(first.subjects);
    expect(second.topics).toEqual(first.topics);
    expect(second.concepts).toEqual(first.concepts);
    expect(second.attendance).toEqual(first.attendance);
    expect(second.skipped).toEqual(first.skipped);
  });
});

describe('subject and topic mapping', () => {
  it('maps topics, assessments and assignments to one subject id', () => {
    const normalized = normalizeLearningSignals(fixtureSource(), AT);
    const mathId = subjectIdFromLabel('Mathematics');

    expect(normalized.topics.find((topic) => topic.id === 'topic-1')?.subjectId).toBe(mathId);
    const mathSignal = normalized.signals.find(
      (signal) => signal.kind === 'assessment_result' && signal.id === 'assessment_result:assessment-1'
    );
    expect(mathSignal?.subjectId).toBe(mathId);

    const subjects = normalized.subjects.map((subject) => subject.label).sort();
    expect(subjects).toEqual(['Chemistry', 'History', 'Mathematics', 'Physics']);
  });

  it('collapses case and whitespace variants of a subject name', () => {
    const normalized = normalizeLearningSignals(
      {
        topics: [
          makeTopic({ id: 'a', subject: '  mathematics ' }),
          makeTopic({ id: 'b', subject: 'MATHEMATICS', title: 'Other' }),
        ],
      },
      AT
    );

    expect(normalized.subjects).toHaveLength(1);
    expect(normalized.topics.map((topic) => topic.subjectId)).toEqual([
      subjectIdFromLabel('mathematics'),
      subjectIdFromLabel('MATHEMATICS'),
    ]);
    expect(normalized.topics[0].subjectId).toBe(normalized.topics[1].subjectId);
  });

  it('links topic-scoped evidence to the topic and its derived concept', () => {
    const normalized = normalizeLearningSignals(fixtureSource(), AT);
    const assessment = normalized.signals.find((signal) => signal.id === 'assessment_result:assessment-1');

    expect(assessment?.topicId).toBe('topic-1');
    expect(assessment?.conceptIds).toEqual(['concept_topic_topic-1']);
  });

  it('falls back to subject scope when a topic link cannot be resolved', () => {
    const normalized = normalizeLearningSignals(
      {
        topics: [makeTopic()],
        assessments: [makeAssessment({ id: 'orphan', topicId: 'does-not-exist' })],
        assignments: [makeAssignment({ id: 'orphan-assignment', topicId: 'does-not-exist' })],
      },
      AT
    );

    const assessment = normalized.signals.find((signal) => signal.id === 'assessment_result:orphan');
    const assignment = normalized.signals.find(
      (signal) => signal.id === 'assignment_outcome:orphan-assignment'
    );
    expect(assessment?.topicId).toBeNull();
    expect(assignment?.topicId).toBeNull();
    expect(assessment?.conceptIds).toEqual([]);
    expect(normalized.skipped).toHaveLength(0);
  });

  it('rolls attendance up per subject for later gap classification', () => {
    const normalized = normalizeLearningSignals(fixtureSource(), AT);
    const physics = normalized.attendance.find((item) => item.label === 'Physics');

    expect(physics).toBeDefined();
    expect(physics?.target).toBe(75);
    expect(physics?.present).toBe(1);
    expect(physics?.absent).toBe(2);
    expect(physics?.rate).toBe(0.3333);
  });
});

describe('invalid and missing data', () => {
  it('skips unsupported records instead of guessing', () => {
    const normalized = normalizeLearningSignals(
      {
        topics: [
          { id: '', subject: 'Math', title: 'x' },
          { id: 'no-subject', subject: '   ', title: 'x', status: 'learning' },
          { id: 'no-title', subject: 'Math', title: '', status: 'learning' },
          { id: 'bad-status', subject: 'Math', title: 'x', status: 'done', updatedAt: AT },
          { id: 'bad-date', subject: 'Math', title: 'x', status: 'learning', updatedAt: 'nope', createdAt: null },
        ],
        assessments: [
          { id: 'a1', subject: 'Math', score: 'x', maxScore: 10, date: AT },
          { id: 'a2', subject: 'Math', score: 5, maxScore: 0, date: AT },
          { id: 'a3', subject: 'Math', score: -1, maxScore: 10, date: AT },
          { id: 'a4', subject: 'Math', score: 5, maxScore: 10, date: 'not-a-date' },
        ],
        assignments: [{ id: 'b1', subject: 'Math', status: 'archived', updatedAt: AT }],
        attendanceSubjects: [{ id: 'at1', name: '', records: [] }],
        resources: [{ id: 'r1', topicId: 'missing', createdAt: AT }],
      },
      AT
    );

    expect(normalized.signals).toHaveLength(0);
    expect(normalized.skipped.map((item) => item.reason)).toEqual(
      expect.arrayContaining([
        'missing_id',
        'missing_subject',
        'invalid_title',
        'invalid_status',
        'invalid_date',
        'invalid_score',
        'unknown_topic',
      ])
    );
  });

  it('keeps partial records usable instead of dropping the whole source', () => {
    const normalized = normalizeLearningSignals(
      {
        topics: [makeTopic({ id: 'good', subject: 'Math' })],
        assessments: [{ id: 'broken', subject: 'Math', score: 'x', maxScore: 10 }],
      },
      AT
    );

    expect(normalized.topics).toHaveLength(1);
    expect(normalized.signals.some((signal) => signal.kind === 'study_activity')).toBe(true);
    expect(normalized.skipped).toHaveLength(1);
  });
});
