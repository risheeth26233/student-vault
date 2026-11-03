// Test H — progress & timeline: direction claims only from definite
// observations, honest "not enough evidence" states, stale evaluations
// excluded, and the caveat always present.

import { describe, expect, it } from 'vitest';
import { PROGRESS_CAVEAT } from '../evaluation';
import { buildTimeline, isEvaluationStale, summarizeProgress } from '../progressModel';
import {
  AT,
  AT_EVEN_LATER,
  AT_LATER,
  makeAttempt,
  makeCheck,
  makeEvaluation,
  makeSubmission,
} from './fixtures';

describe('summarizeProgress', () => {
  it('returns null when there is no observation at all', () => {
    expect(summarizeProgress(makeSubmission())).toBeNull();
  });

  it('returns null when only an uncertain evaluation exists (no definite observation)', () => {
    const submission = makeSubmission({
      evaluation: makeEvaluation({ outcome: 'plausible_gap', confidence: 'low' }),
    });
    // The UI shows an honest "no definite observations yet" empty state for null.
    expect(summarizeProgress(submission)).toBeNull();
  });

  it('reports not_enough_evidence when graded answers exist but no definite evaluation', () => {
    const submission = makeSubmission({
      evaluation: makeEvaluation({ outcome: 'insufficient_evidence', evaluatedAt: AT }),
      attempts: [makeAttempt({ check: makeCheck({ passed: true }), submittedAt: AT_LATER })],
    });
    const summary = summarizeProgress(submission);
    expect(summary?.direction).toBe('not_enough_evidence');
    expect(summary?.statement).toContain('No definite starting evaluation');
    expect(summary?.statement).toContain('1 checked answer');
    expect(summary?.confidence).toBe('none');
    expect(summary?.caveat).toBe(PROGRESS_CAVEAT);
  });

  it('reports not_enough_evidence when a baseline exists but nothing follows it', () => {
    const submission = makeSubmission({
      evaluation: makeEvaluation({ outcome: 'confirmed_error', evaluatedAt: AT }),
    });
    const summary = summarizeProgress(submission);
    expect(summary?.direction).toBe('not_enough_evidence');
    expect(summary?.statement).toContain('no later checked answer');
  });

  it('reports improved when a later graded check passes where the baseline failed', () => {
    const submission = makeSubmission({
      evaluation: makeEvaluation({ outcome: 'confirmed_error', evaluatedAt: AT }),
      attempts: [
        makeAttempt({ check: makeCheck({ passed: false, coverage: 0.3 }), submittedAt: AT_LATER }),
        makeAttempt({ id: 'att-2', check: makeCheck({ passed: true }), submittedAt: AT_EVEN_LATER }),
      ],
    });
    const summary = summarizeProgress(submission);
    expect(summary?.direction).toBe('improved');
    expect(summary?.statement).toContain('single before/after pair is not proof');
    expect(summary?.definiteObservations).toBe(3);
    expect(summary?.confidence).toBe('medium'); // 2 follow-ups
  });

  it('reports declined when a later graded check fails where the baseline passed', () => {
    const submission = makeSubmission({
      evaluation: makeEvaluation({ outcome: 'no_gap', evaluatedAt: AT }),
      attempts: [makeAttempt({ check: makeCheck({ passed: false }), submittedAt: AT_LATER })],
    });
    const summary = summarizeProgress(submission);
    expect(summary?.direction).toBe('declined');
    expect(summary?.statement).toContain('did not pass');
  });

  it('reports unchanged when the latest check matches a passing baseline', () => {
    const submission = makeSubmission({
      evaluation: makeEvaluation({ outcome: 'no_gap', evaluatedAt: AT }),
      attempts: [makeAttempt({ check: makeCheck({ passed: true }), submittedAt: AT_LATER })],
    });
    expect(summarizeProgress(submission)?.direction).toBe('unchanged');
  });

  it('returns null when ungraded attempts and uncertain evaluations are all there is', () => {
    const submission = makeSubmission({
      evaluation: makeEvaluation({ outcome: 'insufficient_evidence', evaluatedAt: AT }),
      attempts: [makeAttempt({ check: makeCheck({ graded: false, passed: false, coverage: 0 }), submittedAt: AT_LATER })],
    });
    // Nothing definite was observed ⇒ no direction claim, no counts.
    expect(summarizeProgress(submission)).toBeNull();
  });

  it('never claims mastery — improved statements explicitly disclaim proof', () => {
    const submission = makeSubmission({
      evaluation: makeEvaluation({ outcome: 'confirmed_error', evaluatedAt: AT }),
      attempts: [makeAttempt({ check: makeCheck({ passed: true }), submittedAt: AT_LATER })],
    });
    const summary = summarizeProgress(submission);
    expect(summary?.statement).toContain('not proof of lasting mastery');
    expect(summary?.statement.toLowerCase()).not.toContain('mastery improved');
    expect(summary?.statement.toLowerCase()).not.toContain('mastered');
    expect(summary?.caveat).toBe(PROGRESS_CAVEAT);
  });

  it('returns null when the only evaluation is stale (text changed after it ran)', () => {
    const submission = makeSubmission({
      evaluation: makeEvaluation({ outcome: 'confirmed_error', evaluatedAt: AT }),
      confirmedAt: AT_EVEN_LATER, // text changed AFTER evaluation
    });
    expect(summarizeProgress(submission)).toBeNull();
  });
});

describe('isEvaluationStale', () => {
  it('is false without an evaluation or without a re-confirmation', () => {
    expect(isEvaluationStale(makeSubmission())).toBe(false);
    expect(
      isEvaluationStale(makeSubmission({ evaluation: makeEvaluation(), confirmedAt: AT }))
    ).toBe(false);
  });

  it('is true only when the confirmation happened after the evaluation', () => {
    expect(
      isEvaluationStale(
        makeSubmission({
          evaluation: makeEvaluation({ evaluatedAt: AT }),
          confirmedAt: AT_LATER,
        })
      )
    ).toBe(true);
    expect(
      isEvaluationStale(
        makeSubmission({
          evaluation: makeEvaluation({ evaluatedAt: AT_LATER }),
          confirmedAt: AT,
        })
      )
    ).toBe(false);
  });
});

describe('buildTimeline', () => {
  it('records every stage of the full loop in chronological order', () => {
    const submission = makeSubmission({
      status: 'evaluated',
      pages: [
        {
          resourceId: 'r1',
          name: 'p1.jpg',
          mimeType: 'image/jpeg',
          size: 1,
          page: 1,
          extraction: {
            status: 'ok',
            text: 'some text',
            estimatedConfidence: 0.9,
            notes: [],
            provider: 'openai-vision',
            extractedAt: AT,
          },
        },
      ],
      confirmedText: 'some text',
      evidenceQuality: 'ocr_confirmed',
      confirmedAt: AT_LATER,
      reviewedAt: null,
      evaluation: makeEvaluation({ outcome: 'confirmed_error', evaluatedAt: AT_EVEN_LATER }),
      attempts: [
        makeAttempt({ check: makeCheck({ passed: true }), submittedAt: '2026-10-04T10:00:00.000Z' }),
        makeAttempt({
          id: 'att-2',
          phase: 'reassessment',
          check: makeCheck({ passed: true, coverage: 0.8 }),
          submittedAt: '2026-10-05T10:00:00.000Z',
        }),
      ],
    });

    const timeline = buildTimeline(submission);
    const stages = timeline.map((entry) => entry.stage);
    expect(stages).toEqual(['submitted', 'extracted', 'confirmed', 'evaluated', 'practiced', 'reassessed']);

    const times = timeline.map((entry) => entry.at);
    expect([...times].sort()).toEqual(times);

    const extracted = timeline.find((entry) => entry.stage === 'extracted');
    expect(extracted?.detail).toContain('openai-vision');

    const reassessed = timeline.find((entry) => entry.stage === 'reassessed');
    expect(reassessed?.label).toContain('passed');
  });

  it('marks unavailable/failed extraction honestly', () => {
    const unavailable = buildTimeline(
      makeSubmission({ status: 'provider_unavailable', extractionMessage: 'no provider' })
    );
    const extractedEntry = unavailable.find((entry) => entry.stage === 'extracted');
    expect(extractedEntry?.label).toContain('unavailable');
    expect(extractedEntry?.tone).toBe('warning');

    const failed = buildTimeline(makeSubmission({ status: 'extraction_failed' }));
    expect(failed.find((entry) => entry.stage === 'extracted')?.tone).toBe('danger');
  });

  it('flags a stale evaluation in the timeline detail', () => {
    const submission = makeSubmission({
      evaluation: makeEvaluation({ evaluatedAt: AT }),
      confirmedAt: AT_EVEN_LATER,
    });
    const entry = buildTimeline(submission).find((item) => item.stage === 'evaluated');
    expect(entry?.detail).toContain('text changed since');
  });

  it('shows only the submitted stage for a fresh draft', () => {
    const timeline = buildTimeline(makeSubmission());
    expect(timeline.map((entry) => entry.stage)).toEqual(['submitted']);
  });
});
