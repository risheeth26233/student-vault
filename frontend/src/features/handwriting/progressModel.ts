// Progress & timeline — measure impact from subsequent evidence, honestly.
//
// Rules:
// - Only definite observations count: an evaluation of `confirmed_error` or
//   `no_gap`, and practice/reassessment attempts whose check was graded.
//   Uncertain evaluations (plausible_gap, insufficient_evidence, …) and
//   ungraded answers are excluded from the comparison — they are recorded,
//   they just cannot support a direction claim.
// - Without a definite baseline AND at least one definite later check, the
//   direction is `not_enough_evidence` with a statement of what is missing.
// - Never claim mastery improvement from a single weak observation: the
//   statement always names how many observations back it is, and the caveat
//   explains what was excluded.

import type { EvidenceConfidence } from '../../types/gurugraph';
import type {
  EvaluationOutcome,
  HandwritingSubmission,
  ProgressDirection,
  ProgressSummary,
  TimelineEntry,
} from './handwritingTypes';
import { EVALUATION_OUTCOME_LABEL, PROGRESS_CAVEAT } from './evaluation';

/**
 * True when the confirmed text changed AFTER the evaluation ran — the result
 * then describes an earlier version of the text. Stale evaluations are
 * excluded from progress baselines and from GuruGraph evidence.
 */
export function isEvaluationStale(submission: HandwritingSubmission): boolean {
  const evaluation = submission.evaluation;
  if (!evaluation || !submission.confirmedAt) return false;
  return submission.confirmedAt > evaluation.evaluatedAt;
}

/** Outcomes that carry a definite (baseline-able) answer about the work. */
const DEFINITE_EVALUATIONS: Partial<Record<EvaluationOutcome, boolean>> = {
  confirmed_error: false,
  no_gap: true,
};

interface Observation {
  at: string;
  ok: boolean;
  stage: 'evaluation' | 'attempt';
  label: string;
}

function observationsFor(submission: HandwritingSubmission): Observation[] {
  const observations: Observation[] = [];

  const evaluation = submission.evaluation;
  // A stale evaluation (text re-confirmed after it ran) is not evidence about
  // the current text — it is recorded in the timeline but cannot baseline
  // progress.
  if (evaluation && !isEvaluationStale(submission)) {
    const definite = evaluation.outcome in DEFINITE_EVALUATIONS;
    if (definite) {
      observations.push({
        at: evaluation.evaluatedAt,
        ok: DEFINITE_EVALUATIONS[evaluation.outcome] as boolean,
        stage: 'evaluation',
        label: EVALUATION_OUTCOME_LABEL[evaluation.outcome],
      });
    }
  }

  for (const attempt of submission.attempts) {
    if (attempt.check && attempt.check.graded) {
      observations.push({
        at: attempt.submittedAt,
        ok: attempt.check.passed,
        stage: 'attempt',
        label:
          attempt.phase === 'reassessment'
            ? `Reassessment ${attempt.check.passed ? 'passed' : 'not passed'}`
            : `Practice ${attempt.check.passed ? 'passed' : 'not passed'}`,
      });
    }
  }

  return observations.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

function confidenceFor(definiteFollowUps: number): EvidenceConfidence {
  if (definiteFollowUps >= 4) return 'high';
  if (definiteFollowUps >= 2) return 'medium';
  return 'low';
}

/**
 * Compare the initial evaluation (baseline) with the latest definite later
 * check. Returns null when there is no definite observation at all.
 */
export function summarizeProgress(submission: HandwritingSubmission): ProgressSummary | null {
  const observations = observationsFor(submission);
  if (observations.length === 0) return null;

  const baselineIndex = observations.findIndex((observation) => observation.stage === 'evaluation');
  const baseline = baselineIndex >= 0 ? observations[baselineIndex] : null;
  const followUps = baseline ? observations.slice(baselineIndex + 1) : observations;

  const definiteObservations = observations.length;

  if (!baseline) {
    return {
      direction: 'not_enough_evidence',
      statement: `No definite starting evaluation to compare against yet — ${definiteObservations} checked answer${definiteObservations === 1 ? '' : 's'} recorded. Evaluate the original submission first to measure change.`,
      confidence: 'none',
      definiteObservations,
      caveat: PROGRESS_CAVEAT,
    };
  }

  if (followUps.length === 0) {
    return {
      direction: 'not_enough_evidence',
      statement: `Baseline recorded (${baseline.label}) but no later checked answer yet — answer a practice or reassessment question to compare against.`,
      confidence: 'none',
      definiteObservations,
      caveat: PROGRESS_CAVEAT,
    };
  }

  const latest = followUps[followUps.length - 1];
  const direction: ProgressDirection = latest.ok && !baseline.ok
    ? 'improved'
    : !latest.ok && baseline.ok
      ? 'declined'
      : 'unchanged';

  const count = followUps.length;
  const pairNote = `Based on ${definiteObservations} definite observation${definiteObservations === 1 ? '' : 's'} (${count} after the initial review).`;

  const statements: Record<Exclude<ProgressDirection, 'not_enough_evidence'>, string> = {
    improved: `Later checked answer passed where the initial review (${baseline.label}) did not. ${pairNote} Encouraging — but a single before/after pair is not proof of lasting mastery.`,
    unchanged: `The latest checked answer matches the initial review (${baseline.label}) — no measurable change yet. ${pairNote}`,
    declined: `The latest checked answer did not pass, where the initial review (${baseline.label}) did. ${pairNote} Check whether the method changed before drawing conclusions.`,
  };

  return {
    direction,
    statement: statements[direction],
    confidence: confidenceFor(count),
    definiteObservations,
    caveat: PROGRESS_CAVEAT,
  };
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

function entry(
  stage: TimelineEntry['stage'],
  label: string,
  detail: string,
  at: string,
  tone: TimelineEntry['tone'] = 'default'
): TimelineEntry {
  return {
    id: `tl_${stage}_${at}`,
    stage,
    label,
    detail,
    at,
    tone,
  };
}

const QUALITY_LABEL: Record<string, string> = {
  ocr_confirmed: 'automatic extraction, confirmed as read',
  ocr_corrected: 'automatic extraction, corrected by you',
  manual: 'typed in by you (manual transcription)',
};

/** Chronological, stage-labelled history of a submission. */
export function buildTimeline(submission: HandwritingSubmission): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  entries.push(
    entry(
      'submitted',
      'Submission created',
      `${submission.pages.length} page${submission.pages.length === 1 ? '' : 's'} · ${submission.subject} · ${submission.topicTitle}`,
      submission.createdAt
    )
  );

  const extractedAt = submission.pages
    .map((page) => page.extraction.extractedAt)
    .filter((at): at is string => Boolean(at))
    .sort()
    .pop();

  if (submission.status !== 'draft' && extractedAt) {
    const lowCount = submission.pages.filter(
      (page) => page.extraction.status === 'low_confidence'
    ).length;
    const provider = submission.pages.find((page) => page.extraction.provider)?.extraction.provider;
    entries.push(
      entry(
        'extracted',
        'Text extracted',
        `Provider: ${provider ?? 'unknown'} · ${lowCount > 0 ? `${lowCount} page(s) flagged for review — correction required` : 'all pages read'}`,
        extractedAt,
        lowCount > 0 ? 'warning' : 'default'
      )
    );
  } else if (submission.status === 'provider_unavailable') {
    entries.push(
      entry(
        'extracted',
        'Automatic extraction unavailable',
        submission.extractionMessage || 'No OCR provider available — manual transcription was used.',
        submission.updatedAt,
        'warning'
      )
    );
  } else if (submission.status === 'extraction_failed') {
    entries.push(
      entry(
        'extracted',
        'Extraction failed',
        submission.extractionMessage || 'The provider returned no usable text.',
        submission.updatedAt,
        'danger'
      )
    );
  }

  if (submission.confirmedAt) {
    entries.push(
      entry(
        'confirmed',
        'Text confirmed for evaluation',
        QUALITY_LABEL[submission.evidenceQuality ?? 'manual'] ?? 'confirmed by you',
        submission.confirmedAt,
        'success'
      )
    );
  }

  if (submission.evaluation) {
    const evaluation = submission.evaluation;
    const stale = isEvaluationStale(submission);
    const tone: TimelineEntry['tone'] =
      evaluation.outcome === 'confirmed_error'
        ? 'danger'
        : evaluation.outcome === 'plausible_gap' || evaluation.outcome === 'insufficient_evidence'
          ? 'warning'
          : 'success';
    entries.push(
      entry(
        'evaluated',
        `Evaluation: ${EVALUATION_OUTCOME_LABEL[evaluation.outcome]}`,
        stale ? `${evaluation.headline} (text changed since — result is from an earlier version)` : evaluation.headline,
        evaluation.evaluatedAt,
        tone
      )
    );
  }

  const practiceAttempts = submission.attempts.filter((attempt) => attempt.phase === 'practice');
  if (practiceAttempts.length > 0) {
    const passed = practiceAttempts.filter((attempt) => attempt.check?.passed).length;
    entries.push(
      entry(
        'practiced',
        'Practice attempts',
        `${practiceAttempts.length} attempt${practiceAttempts.length === 1 ? '' : 's'} recorded · ${passed} passed the automatic check`,
        practiceAttempts[practiceAttempts.length - 1].submittedAt,
        passed > 0 ? 'success' : 'default'
      )
    );
  }

  const reassessments = submission.attempts.filter((attempt) => attempt.phase === 'reassessment');
  if (reassessments.length > 0) {
    const latest = reassessments[reassessments.length - 1];
    entries.push(
      entry(
        'reassessed',
        latest.check?.passed ? 'Reassessment passed' : 'Reassessment not passed',
        latest.check
          ? `Coverage ${(latest.check.coverage * 100).toFixed(0)}% on ${latest.check.matchedConcepts.length}/${latest.check.matchedConcepts.length + latest.check.missingConcepts.length} key ideas`
          : 'Recorded without an automatic check',
        latest.submittedAt,
        latest.check?.passed ? 'success' : 'warning'
      )
    );
  }

  return entries.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}
