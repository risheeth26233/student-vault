// Handwritten work & adaptive practice — Phase 3 domain types.
//
// Boundary rules:
// - Student-Vault page IMAGES live in the existing Resource storage
//   (IndexedDB / R2). This module's records hold only metadata, extracted and
//   confirmed TEXT, evaluations and attempts — never image bytes (localStorage
//   is not a blob store).
// - Evaluation outcomes are Phase 3's own six states. They are deliberately
//   NOT GuruGraph `GapCategory` values: Phase 2 classification meanings stay
//   untouched, and `confirmed_misconception` remains reserved/unemitted.
// - Every derived value is deterministic and reproducible from the record.

import type { EvidenceConfidence } from '../../types/gurugraph';

// ---------------------------------------------------------------------------
// Submission pipeline
// ---------------------------------------------------------------------------

/** Per-page extraction state. `manual` is never set — manual transcription is
 *  recorded as the combined confirmed text instead (page boundaries are kept
 *  for automatic extraction only). */
export type PageExtractionStatus = 'pending' | 'ok' | 'low_confidence' | 'failed';

/**
 * Submission pipeline status:
 * - draft:               pages added, extraction not requested yet
 * - extracting:          extraction request in flight
 * - extracted:           automatic text available for review (maybe partial)
 * - provider_unavailable: automatic extraction unavailable → manual path
 * - extraction_failed:   provider ran but produced nothing usable → retry
 * - confirmed:           confirmed text frozen → evaluation possible
 * - evaluated:           evaluation recorded
 */
export type SubmissionStatus =
  | 'draft'
  | 'extracting'
  | 'extracted'
  | 'provider_unavailable'
  | 'extraction_failed'
  | 'confirmed'
  | 'evaluated';

/** How the confirmed text was produced — carried into progress reporting. */
export type EvidenceQuality = 'ocr_confirmed' | 'ocr_corrected' | 'manual';

export interface PageExtraction {
  status: PageExtractionStatus;
  /** Raw provider draft for this page (editable by the student). */
  text: string;
  /** Provider self-estimate 0..1, or null when it reported none. */
  estimatedConfidence: number | null;
  /** Provider ambiguity notes (e.g. unreadable regions) — require review. */
  notes: string[];
  /** Provider name that produced the draft, e.g. 'openai-vision'. */
  provider: string | null;
  /** Machine-readable failure code when status === 'failed'. */
  error?: string;
  extractedAt?: string;
}

export interface SubmissionPage {
  /** Resource id — the image blob itself lives in IndexedDB/R2. */
  resourceId: string;
  name: string;
  mimeType: string;
  size: number;
  /** 1-based page number (order preserved through extraction). */
  page: number;
  extraction: PageExtraction;
}

// ---------------------------------------------------------------------------
// Evaluation (deterministic, evidence-grounded — six distinguishable states)
// ---------------------------------------------------------------------------

/** Topic context the evaluator may read (the student's own records). */
export interface EvaluationTopicContext {
  title: string;
  notes: string;
}

/** Result of checking an answer against a set of expected key ideas. */
export interface MatchConceptsResult {
  matched: string[];
  missing: string[];
  /** matched/expected, 4dp (0 when the expected list is empty). */
  coverage: number;
}

export type EvaluationOutcome =
  | 'confirmed_error'
  | 'plausible_gap'
  | 'insufficient_evidence'
  | 'extraction_failure'
  | 'evaluation_unavailable'
  | 'no_gap';

export interface EvaluationResult {
  outcome: EvaluationOutcome;
  /** Student-facing one-line conclusion. */
  headline: string;
  /** Facts OBSERVED directly in the records (text, comparisons, counts). */
  observed: string[];
  /** Conclusions INFERRED or classified from those facts. */
  inferred: string[];
  /** Concepts present in the basis but absent from the student's answer. */
  missingConcepts: string[];
  confidence: EvidenceConfidence;
  /** True when a reference answer drove the comparison. */
  referenceUsed: boolean;
  /** Final-answer comparison: true/false when comparable, null otherwise. */
  answerMatch: boolean | null;
  /** Always false: matching final answers never proves intermediate reasoning. */
  reasoningVerified: false;
  caveat: string;
  /** Deterministic rule id — the "why" handle for this evaluation. */
  ruleId: string;
  evaluatedAt: string;
}

// ---------------------------------------------------------------------------
// Adaptive practice
// ---------------------------------------------------------------------------

export type PracticeDifficulty = 'foundational' | 'intermediate' | 'stretch';

export type PracticeQuestionKind = 'recall' | 'explain' | 'apply' | 'review' | 'summarise';

export interface PracticeQuestion {
  /** Deterministic id: same topic + prompt ⇒ same id across reloads. */
  id: string;
  topicId: string;
  kind: PracticeQuestionKind;
  difficulty: PracticeDifficulty;
  prompt: string;
  /** Answer format / instructions shown above the answer box. */
  instructions: string;
  /** Key ideas the answer is checked against (derived — never a syllabus). */
  expectedConcepts: string[];
  derivedFrom: 'topic_title' | 'topic_notes' | 'evaluation_gap' | 'gurugraph_gap';
  origin: 'deterministic';
  /** Honest provenance label rendered with every generated question. */
  sourceNote: string;
  /** Stretch questions unlock after the first passing attempt. */
  locked: boolean;
}

export interface AnswerCheck {
  /** matched/expected key ideas (0 when ungraded). */
  coverage: number;
  matchedConcepts: string[];
  missingConcepts: string[];
  passed: boolean;
  /** False when no key ideas could be derived — nothing was verified. */
  graded: boolean;
  /** Coverage threshold used for `passed` (0 when ungraded). */
  threshold: number;
  /** Explanation built only from verified sources (the student's own notes). */
  explanation: string;
}

export interface PracticeAttempt {
  id: string;
  questionId: string;
  phase: 'practice' | 'reassessment';
  /** Prompt snapshot so history stays readable across regeneration. */
  prompt: string;
  answer: string;
  /** Null only if an attempt was recorded without running the check. */
  check: AnswerCheck | null;
  submittedAt: string;
}

// ---------------------------------------------------------------------------
// Submission record
// ---------------------------------------------------------------------------

export interface HandwritingSubmission {
  id: string;
  subject: string;
  topicId: string;
  topicTitle: string;
  /** The question the work answers (free text, optional). */
  question: string;
  /** Optional reference/model answer used for deterministic comparison. */
  referenceAnswer: string;
  status: SubmissionStatus;
  pages: SubmissionPage[];
  /** Student-confirmed text — the ONLY input evaluation may use. */
  confirmedText: string;
  evidenceQuality: EvidenceQuality | null;
  confirmedAt: string | null;
  /** Set when low-confidence pages were explicitly reviewed. */
  reviewedAt: string | null;
  /** Last human-readable reason extraction could not run/complete. */
  extractionMessage: string | null;
  evaluation: EvaluationResult | null;
  attempts: PracticeAttempt[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Progress & timeline (measure impact honestly)
// ---------------------------------------------------------------------------

export type ProgressDirection = 'improved' | 'unchanged' | 'declined' | 'not_enough_evidence';

export interface ProgressSummary {
  direction: ProgressDirection;
  /** Student-facing statement; never claims mastery from weak evidence. */
  statement: string;
  confidence: EvidenceConfidence;
  /** Count of definite (non-uncertain) observations used. */
  definiteObservations: number;
  caveat: string;
}

export type TimelineStage =
  | 'submitted'
  | 'extracted'
  | 'confirmed'
  | 'evaluated'
  | 'practiced'
  | 'reassessed';

export interface TimelineEntry {
  id: string;
  stage: TimelineStage;
  label: string;
  detail: string;
  at: string;
  tone: 'default' | 'success' | 'warning' | 'danger';
}

// ---------------------------------------------------------------------------
// Slim evidence handed to the GuruGraph signal layer
// ---------------------------------------------------------------------------

/** Phase 3 → GuruGraph bridge record. Built by the store (never by UI code):
 *  no confirmed text, no answers and no images — just outcomes. */
export interface HandwritingEvidence {
  id: string;
  topicId: string;
  observedAt: string;
  kind: 'evaluation' | 'practice' | 'reassessment';
  outcome: 'correct' | 'incorrect' | 'ungraded';
  label: string;
  detail: string;
}

// ---------------------------------------------------------------------------
// Transient UI state (not persisted)
// ---------------------------------------------------------------------------

export type ExtractionRunKind = 'success' | 'provider_unavailable' | 'failed';

export interface ExtractionRunResult {
  kind: ExtractionRunKind;
  message: string;
}
