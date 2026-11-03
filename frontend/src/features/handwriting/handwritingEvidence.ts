// Phase 3 → GuruGraph evidence bridge.
//
// This is the ONLY shape allowed across the boundary into the intelligence
// layer: slim outcome records built from submissions. Confirmed text, answers
// and images never leave the Phase 3 store — the signal normaliser sees only
// topic, timestamp, outcome and a human-readable label/detail.

import type { EvaluationOutcome, HandwritingEvidence, HandwritingSubmission } from './handwritingTypes';
import { isEvaluationStale } from './progressModel';

/** Definite evaluation outcomes map to definite outcomes; uncertain states stay ungraded. */
export function evaluationOutcomeToEvidence(
  outcome: EvaluationOutcome
): HandwritingEvidence['outcome'] {
  switch (outcome) {
    case 'no_gap':
      return 'correct';
    case 'confirmed_error':
      return 'incorrect';
    default:
      // plausible_gap / insufficient_evidence / extraction_failure /
      // evaluation_unavailable — recorded as considered evidence, never as a
      // pass/fail, so they cannot move mastery on their own.
      return 'ungraded';
  }
}

function attemptOutcome(check: {
  graded: boolean;
  passed: boolean;
} | null): HandwritingEvidence['outcome'] {
  if (!check) return 'ungraded';
  if (!check.graded) return 'ungraded';
  return check.passed ? 'correct' : 'incorrect';
}

/**
 * Build the evidence list for GuruGraph ingestion. Deterministic and ordered
 * by observation time (submission id as the tiebreaker), so re-running over
 * the same records yields the same list — which keeps signal ids stable.
 */
export function buildHandwritingEvidence(
  submissions: readonly HandwritingSubmission[]
): HandwritingEvidence[] {
  const evidence: HandwritingEvidence[] = [];

  for (const submission of submissions) {
    if (submission.evaluation && !isEvaluationStale(submission)) {
      const evaluation = submission.evaluation;
      evidence.push({
        id: `${submission.id}:evaluation`,
        topicId: submission.topicId,
        observedAt: evaluation.evaluatedAt,
        kind: 'evaluation',
        outcome: evaluationOutcomeToEvidence(evaluation.outcome),
        label: `Evaluation: ${submission.topicTitle}`,
        detail: evaluation.headline,
      });
    }

    for (const attempt of submission.attempts) {
      evidence.push({
        id: `${submission.id}:attempt:${attempt.id}`,
        topicId: submission.topicId,
        observedAt: attempt.submittedAt,
        kind: attempt.phase === 'reassessment' ? 'reassessment' : 'practice',
        outcome: attemptOutcome(attempt.check),
        label: `${attempt.phase === 'reassessment' ? 'Reassessment' : 'Practice attempt'}: ${submission.topicTitle}`,
        detail: attempt.check
          ? attempt.check.graded
            ? attempt.check.passed
              ? `Coverage check passed (${Math.round(attempt.check.coverage * 100)}%)`
              : `Coverage check not passed (${Math.round(attempt.check.coverage * 100)}%)`
            : 'Answer recorded without an automatic check'
          : 'Answer recorded without an automatic check',
      });
    }
  }

  return evidence.sort((a, b) => {
    if (a.observedAt !== b.observedAt) return a.observedAt < b.observedAt ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
