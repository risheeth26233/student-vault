// Test N (part 1) — Phase 3 → GuruGraph evidence bridge: slim outcome records
// only. Confirmed text, answers and images must never cross the boundary.

import { describe, expect, it } from 'vitest';
import { buildHandwritingEvidence, evaluationOutcomeToEvidence } from '../handwritingEvidence';
import type { EvaluationOutcome } from '../handwritingTypes';
import {
  AT,
  AT_LATER,
  makeAttempt,
  makeCheck,
  makeEvaluation,
  makeSubmission,
} from './fixtures';

describe('evaluationOutcomeToEvidence', () => {
  it('maps definite outcomes to definite evidence and uncertain ones to ungraded', () => {
    expect(evaluationOutcomeToEvidence('no_gap')).toBe('correct');
    expect(evaluationOutcomeToEvidence('confirmed_error')).toBe('incorrect');
    for (const outcome of ['plausible_gap', 'insufficient_evidence', 'extraction_failure', 'evaluation_unavailable'] as EvaluationOutcome[]) {
      expect(evaluationOutcomeToEvidence(outcome)).toBe('ungraded');
    }
  });
});

describe('buildHandwritingEvidence', () => {
  it('emits evaluation and attempt evidence with deterministic ordering', () => {
    const evidence = buildHandwritingEvidence([
      makeSubmission({
        id: 'hws-a',
        topicId: 'topic-1',
        evaluation: makeEvaluation({ outcome: 'confirmed_error', evaluatedAt: AT_LATER }),
        attempts: [
          makeAttempt({ id: 'att-1', submittedAt: AT, check: makeCheck({ passed: true, coverage: 0.8 }) }),
          makeAttempt({ id: 'att-2', phase: 'reassessment', submittedAt: '2026-10-03T10:00:00.000Z', check: makeCheck({ passed: false, coverage: 0.4 }) }),
        ],
      }),
    ]);

    expect(evidence.map((item) => item.id)).toEqual([
      'hws-a:attempt:att-1',
      'hws-a:evaluation',
      'hws-a:attempt:att-2',
    ]);
    expect(evidence.map((item) => item.kind)).toEqual(['practice', 'evaluation', 'reassessment']);
    expect(evidence[0].outcome).toBe('correct');
    expect(evidence[1].outcome).toBe('incorrect');
    expect(evidence[2].outcome).toBe('incorrect');
    expect(evidence.every((item) => item.topicId === 'topic-1')).toBe(true);
  });

  it('records ungraded attempts as ungraded evidence (they cannot move mastery alone)', () => {
    const evidence = buildHandwritingEvidence([
      makeSubmission({
        attempts: [makeAttempt({ check: makeCheck({ graded: false, passed: false, coverage: 0 }) })],
      }),
    ]);
    expect(evidence).toHaveLength(1);
    expect(evidence[0].outcome).toBe('ungraded');
    expect(evidence[0].detail).toContain('without an automatic check');
  });

  it('excludes a stale evaluation (text changed after evaluation)', () => {
    const evidence = buildHandwritingEvidence([
      makeSubmission({
        evaluation: makeEvaluation({ evaluatedAt: AT }),
        confirmedAt: AT_LATER,
        attempts: [],
      }),
    ]);
    expect(evidence).toHaveLength(0);
  });

  it('never lets confirmed text, answers or image bytes cross the boundary', () => {
    const evidence = buildHandwritingEvidence([
      makeSubmission({
        confirmedText: 'SECRET-CONFIRMED-TEXT',
        pages: [{ resourceId: 'res-1', name: 'p.jpg', mimeType: 'image/jpeg', size: 1, page: 1, extraction: { status: 'ok', text: 'SECRET-OCR-DRAFT', estimatedConfidence: 1, notes: [], provider: 'x' } }],
        evaluation: makeEvaluation({ observed: ['SECRET-OBSERVED'] }),
        attempts: [makeAttempt({ answer: 'SECRET-ANSWER' })],
      }),
    ]);
    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toContain('SECRET-CONFIRMED-TEXT');
    expect(serialized).not.toContain('SECRET-OCR-DRAFT');
    expect(serialized).not.toContain('SECRET-OBSERVED');
    expect(serialized).not.toContain('SECRET-ANSWER');
    expect(serialized).not.toContain('data:image');
    for (const item of evidence) {
      expect(Object.keys(item).sort()).toEqual([
        'detail',
        'id',
        'kind',
        'label',
        'observedAt',
        'outcome',
        'topicId',
      ]);
    }
  });

  it('is deterministic over the same records (stable ids for signal dedupe)', () => {
    const submissions = [
      makeSubmission({
        id: 'hws-a',
        evaluation: makeEvaluation({ evaluatedAt: AT }),
        attempts: [makeAttempt({ id: 'att-9', submittedAt: AT_LATER })],
      }),
    ];
    expect(buildHandwritingEvidence(submissions)).toEqual(buildHandwritingEvidence(submissions));
  });

  it('returns an empty list for a workspace with no evaluated/practised work', () => {
    expect(buildHandwritingEvidence([makeSubmission()])).toEqual([]);
    expect(buildHandwritingEvidence([])).toEqual([]);
  });
});
