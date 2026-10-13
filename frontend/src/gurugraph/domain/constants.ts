// GuruGraph — shared thresholds, weights and rule identifiers.
// All intelligence output is a pure function of these constants plus the
// Student-Vault data, so results are reproducible and easy to explain.

/** Minimum usable evidence before a mastery score is reported at all. */
export const MIN_MASTERY_EVIDENCE = 1;

/** Mastery bands. Deterministic cut-offs, never model predictions. */
export const MASTERY_BANDS = {
  emergingMax: 0.4,
  developingMax: 0.7,
} as const;

/** Relative weight of each signal kind when forming a mastery estimate. */
export const SIGNAL_WEIGHTS = {
  assessment_result: 1,
  assignment_outcome: 0.5,
  study_activity: 0.6,
  attendance_session: 0.3,
  resource_activity: 0.2,
} as const;

/**
 * Kinds that are recorded as learning signals but deliberately do NOT move
 * mastery: attendance is participation context and an attached document is an
 * engagement indicator, neither is evidence of learning by itself.
 */
export const MASTERY_EXCLUDED_KINDS = ['attendance_session', 'resource_activity'] as const;

/** Score below this on an assessment suggests a potential learning gap. */
export const LOW_SCORE_THRESHOLD = 0.6;

/** Attendance below the student's own target is reported as low attendance. */
export const ATTENDANCE_TARGET_DEFAULT = 75;

/** Floating point helper: 4 decimal places is enough to rank, stable to compare. */
export const ROUND_DIGITS = 4;

export function roundScore(value: number): number {
  const factor = 10 ** ROUND_DIGITS;
  return Math.round(value * factor) / factor;
}

/** Deterministic rule ids — the "why" handle attached to every derived record. */
export const GAP_RULES = {
  lowScore: 'gg.rule.low_score',
  missingData: 'gg.rule.missing_data',
  insufficientEvidence: 'gg.rule.insufficient_evidence',
  lowAttendance: 'gg.rule.low_attendance',
  /** Reserved for a future misconception engine. Never emitted by Phase 2. */
  confirmedMisconception: 'gg.rule.confirmed_misconception',
} as const;

export const MASTERY_RULE = 'gg.rule.mastery_estimate';

/** Honest wording carried on every mastery record (Phase 2 does not predict). */
export const MASTERY_DISCLAIMER =
  'Deterministic estimate from recorded Student-Vault signals only. Not a validated prediction of learning.';

export const GAP_DISCLAIMER =
  'Candidate finding derived from recorded signals. It is not a confirmed misconception and not a diagnosis.';

/** Schema version of the persisted intelligence snapshot. */
export const INTELLIGENCE_VERSION = 1;

/** localStorage keys (local/offline-first, matching the Phase 1 store pattern). */
export const STORAGE_KEYS = {
  snapshot: 'gurugraph.intelligence.v1',
  relationships: 'gurugraph.relationships.v1',
} as const;
