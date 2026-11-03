// Handwritten-work evaluation — deterministic, evidence-grounded, honest.
//
// Produces exactly six distinguishable states:
//   1. confirmed_error         — definite mismatch against a reference answer
//   2. plausible_gap           — candidate gap from available evidence only
//   3. insufficient_evidence   — too little confirmed text to judge
//   4. extraction_failure      — extraction produced nothing usable
//   5. evaluation_unavailable  — nothing to evaluate against (no reference,
//                                no notes to derive key ideas from)
//   6. no_gap                  — no gap found in the available evidence
//
// Rules that keep it honest:
// - Only the student-confirmed text is evaluated (post-correction input).
// - A matching final answer NEVER marks intermediate reasoning as verified —
//   `reasoningVerified` is literally `false` on every result.
// - Coverage checks compare completeness against the student's OWN topic
//   notes; they cannot prove answers correct, and say so.
// - This module never produces GuruGraph `GapCategory` values, so Phase 2
//   classification meanings (and the reserved `confirmed_misconception`)
//   stay untouched.

import type { EvidenceConfidence } from '../../types/gurugraph';
import type {
  EvaluationOutcome,
  EvaluationResult,
  EvaluationTopicContext,
  MatchConceptsResult,
  PageExtractionStatus,
} from './handwritingTypes';

// ---------------------------------------------------------------------------
// Tunables (deterministic thresholds, exported for tests)
// ---------------------------------------------------------------------------

/** Coverage required before a notes-based check reports "no gap". */
export const COVERAGE_NO_GAP_THRESHOLD = 0.7;

/** Minimum confirmed text for a coverage check when no reference exists. */
export const MIN_COVERAGE_TEXT_LENGTH = 40;

/** Token similarity bounds for reference comparisons (Jaccard on content words). */
export const REFERENCE_MATCH_SIMILARITY = 0.85;
export const REFERENCE_MISMATCH_SIMILARITY = 0.4;

/** Reference key parts absent beyond this count downgrades a match to a gap. */
export const MAX_MISSING_FOR_MATCH = 2;

export const EVALUATION_RULES = {
  confirmedError: 'sv.eval.confirmed_error',
  plausibleGap: 'sv.eval.plausible_gap',
  insufficientEvidence: 'sv.eval.insufficient_evidence',
  extractionFailure: 'sv.eval.extraction_failure',
  unavailable: 'sv.eval.evaluation_unavailable',
  noGap: 'sv.eval.no_gap',
} as const;

export const EVALUATION_OUTCOME_LABEL: Record<EvaluationOutcome, string> = {
  confirmed_error: 'Confirmed error',
  plausible_gap: 'Plausible gap (unconfirmed)',
  insufficient_evidence: 'Insufficient evidence',
  extraction_failure: 'Extraction failure',
  evaluation_unavailable: 'Evaluation unavailable',
  no_gap: 'No gap found',
};

export const PROGRESS_CAVEAT =
  'Measured only from checks with definite results. Uncertain evaluations and ungraded answers are excluded.';

// ---------------------------------------------------------------------------
// Text helpers (shared with the practice engine)
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'about','above','after','again','against','also','among','because','been','before','being',
  'below','between','both','cannot','could','does','doing','down','during','each','from','further',
  'have','having','here','hers','herself','himself','into','itself','just','more','most','other',
  'ought','ours','ourselves','over','same','should','some','such','than','that','their','theirs',
  'them','themselves','then','there','these','they','this','those','through','under','until','very',
  'were','what','when','where','which','while','with','would','your','yours','yourself','shall',
  'will','each','once','only','itself','what','whom','why','how',
]);

/** Lowercase, strip punctuation, collapse whitespace — for equality checks. */
export function normalizeAnswerText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s=/.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalisation for duplicate-attempt detection. Same as
 * `normalizeAnswerText` but drops trailing sentence periods, so prose answers
 * that differ only in final punctuation cannot slip past the duplicate check
 * (interior periods stay — they matter for decimals like 3.14).
 */
export function normalizeForDuplicate(answer: string): string {
  return normalizeAnswerText(answer).replace(/\.+$/, '').trim();
}

function contentTokens(text: string): string[] {
  return normalizeAnswerText(text)
    .split(/[\s/]+/)
    .map((token) => token.replace(/^[=-]+|[=-]+$/g, ''))
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

/** Jaccard similarity over content tokens (0..1, 4dp). */
export function textSimilarity(a: string, b: string): number {
  const setA = new Set(contentTokens(a));
  const setB = new Set(contentTokens(b));
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : Math.round((intersection / union) * 10000) / 10000;
}

/**
 * Deterministic key ideas derived from a topic: significant title words first,
 * then significant notes words. Never claims to be a syllabus list.
 */
export function deriveKeyConcepts(topic: EvaluationTopicContext, limit = 8): string[] {
  const seen = new Set<string>();
  const concepts: string[] = [];

  const push = (token: string, minLength: number): void => {
    const clean = token.toLowerCase().replace(/[^a-z0-9^.-]/g, '');
    if (clean.length < minLength || STOPWORDS.has(clean) || /^\d+$/.test(clean)) return;
    if (seen.has(clean)) return;
    seen.add(clean);
    concepts.push(clean);
  };

  for (const token of topic.title.split(/\s+/)) push(token, 4);
  for (const token of topic.notes.split(/\s+/)) push(token, 5);

  return concepts.slice(0, limit);
}

/** Which expected concepts appear in the answer (substring on normalised text). */
export function matchConcepts(concepts: readonly string[], answer: string): MatchConceptsResult {
  const normalized = normalizeAnswerText(answer);
  const matched: string[] = [];
  const missing: string[] = [];
  for (const concept of concepts) {
    const needle = normalizeAnswerText(concept);
    if (needle.length > 0 && normalized.includes(needle)) matched.push(concept);
    else missing.push(concept);
  }
  const coverage =
    concepts.length === 0 ? 0 : Math.round((matched.length / concepts.length) * 10000) / 10000;
  return { matched, missing, coverage };
}

function clip(value: string, max = 90): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

function finalSegment(text: string): string {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.length > 0 ? lines[lines.length - 1] : text.trim();
}

/** Numbers in the final segment: fractions first, then plain decimals. */
function numbersIn(segment: string): number[] {
  const withSeparatedThousands = segment.replace(/(\d),(?=\d{3})/g, '$1');
  const fractions = [
    ...withSeparatedThousands.matchAll(/(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/g),
  ];
  const plain = [...withSeparatedThousands.matchAll(/-?\d+(?:\.\d+)?/g)];
  if (fractions.length > 0 && plain.length > 0) {
    // Prefer the last fraction when it is the last numeric expression seen.
    const lastFractionIndex = fractions[fractions.length - 1].index ?? 0;
    const lastPlainIndex = plain[plain.length - 1].index ?? 0;
    if (lastFractionIndex >= lastPlainIndex) {
      const [, numerator, denominator] = fractions[fractions.length - 1];
      const den = Number(denominator);
      if (den !== 0) return [Number(numerator) / den];
    }
  }
  return plain.map((match) => Number(match[0]));
}

function sameNumber(a: number, b: number): boolean {
  const round4 = (value: number): number => Math.round(value * 10000) / 10000;
  return round4(a) === round4(b);
}

function missingReferenceParts(reference: string, answer: string): string[] {
  const normalizedAnswer = normalizeAnswerText(answer);
  const parts = [...new Set(contentTokens(reference))].filter((token) => token.length >= 4);
  return parts.filter((token) => !normalizedAnswer.includes(token)).slice(0, 6);
}

// ---------------------------------------------------------------------------
// Result builders
// ---------------------------------------------------------------------------

interface EvalContext {
  input: {
    confirmedText: string;
    topic: EvaluationTopicContext;
    referenceAnswer: string;
    pages: readonly { extraction: { status: PageExtractionStatus } }[];
  };
  at: string;
}

function baseResult(
  outcome: EvaluationOutcome,
  headline: string,
  ruleId: string,
  confidence: EvidenceConfidence,
  ctx: EvalContext,
  observed: string[],
  inferred: string[],
  extra: Partial<EvaluationResult> = {}
): EvaluationResult {
  return {
    outcome,
    headline,
    observed,
    inferred,
    missingConcepts: [],
    confidence,
    referenceUsed: false,
    answerMatch: null,
    reasoningVerified: false,
    caveat: '',
    ruleId,
    evaluatedAt: ctx.at,
    ...extra,
  };
}

function extractionFailure(ctx: EvalContext): EvaluationResult {
  const failedPages = ctx.input.pages.filter((p) => p.extraction.status === 'failed').length;
  return baseResult(
    'extraction_failure',
    'Text extraction failed — nothing was evaluated',
    EVALUATION_RULES.extractionFailure,
    'none',
    ctx,
    [
      `${failedPages} of ${ctx.input.pages.length} page(s) could not be read automatically.`,
      'No confirmed text is available, so no evaluation was attempted.',
    ],
    ['Re-running extraction (or transcribing manually) is required before this work can be evaluated.'],
    { caveat: 'Extraction failure says nothing about the quality of the work itself — the text was never available.' }
  );
}

function insufficient(reason: string, ctx: EvalContext): EvaluationResult {
  return baseResult(
    'insufficient_evidence',
    'Not enough confirmed text to evaluate',
    EVALUATION_RULES.insufficientEvidence,
    'none',
    ctx,
    [
      `Confirmed text length: ${ctx.input.confirmedText.trim().length} character(s).`,
      `Pages attached: ${ctx.input.pages.length}.`,
    ],
    [reason],
    { caveat: 'No conclusion about correctness can be drawn from this much text. Correct the transcription and evaluate again.' }
  );
}

function unavailable(reason: string, ctx: EvalContext): EvaluationResult {
  return baseResult(
    'evaluation_unavailable',
    'No reference or topic notes to evaluate against',
    EVALUATION_RULES.unavailable,
    'none',
    ctx,
    [
      `Reference answer provided: ${ctx.input.referenceAnswer.trim() ? 'yes' : 'no'}.`,
      `Topic notes present: ${ctx.input.topic.notes.trim() ? 'yes' : 'no'}.`,
    ],
    [reason],
    { caveat: 'This state means the evaluator had nothing to compare against — it is not a judgement of the work.' }
  );
}

function evaluateAgainstReference(ctx: EvalContext): EvaluationResult {
  const text = ctx.input.confirmedText.trim();
  const reference = ctx.input.referenceAnswer.trim();
  const studentFinal = finalSegment(text);
  const referenceFinal = finalSegment(reference);

  const studentNumbers = numbersIn(studentFinal);
  const referenceNumbers = numbersIn(referenceFinal);
  const exact =
    normalizeAnswerText(text) === normalizeAnswerText(reference) ||
    normalizeAnswerText(studentFinal) === normalizeAnswerText(referenceFinal);
  const numericComparable = studentNumbers.length === 1 && referenceNumbers.length === 1;
  const numericMatch = numericComparable && sameNumber(studentNumbers[0], referenceNumbers[0]);
  const similarity = textSimilarity(reference, text);
  const missing = missingReferenceParts(reference, text);

  const common: Partial<EvaluationResult> = {
    referenceUsed: true,
    missingConcepts: missing,
  };
  const missingObserved = missing.length > 0 ? ` Reference parts absent from the answer: ${missing.join(', ')}.` : '';
  const workingLines = text.split('\n').filter((line) => line.trim().length > 0).length;
  const workingObserved = `Working observed: ${workingLines} line(s) written; only the final answer was compared — intermediate steps were not verified.`;

  // Definite match: identical answers, or a single matching number per side.
  if ((exact || numericMatch) && missing.length <= MAX_MISSING_FOR_MATCH) {
    const matchedVia = exact ? 'text' : 'final number';
    return baseResult(
      'no_gap',
      'No gap found in the available evidence',
      EVALUATION_RULES.noGap,
      'high',
      ctx,
      [
        `Final answer matches the reference (${matchedVia}): submission "${clip(studentFinal)}" vs reference "${clip(referenceFinal)}".`,
        `Comparison basis: reference answer supplied for this question; ${text.length} character(s) of confirmed text compared.`,
        workingObserved,
      ],
      [
        'No gap identified in the available evidence.',
        'A matching final answer does NOT prove the intermediate working is correct — every step was observed but not verified.',
      ],
      {
        ...common,
        answerMatch: true,
        caveat: 'Correctness of the final answer only. Intermediate reasoning was not verified against the reference.',
      }
    );
  }

  // Definite numeric mismatch: both sides resolve to exactly one differing number.
  if (numericComparable && !numericMatch) {
    return baseResult(
      'confirmed_error',
      'Your final answer differs from the reference',
      EVALUATION_RULES.confirmedError,
      'high',
      ctx,
      [
        `Final numeric answer differs: submission "${clip(studentFinal)}" resolves to ${studentNumbers[0]}, reference "${clip(referenceFinal)}" resolves to ${referenceNumbers[0]}.`,
        `Comparison basis: reference answer supplied; confirmed text length ${text.length}.`,
        workingObserved,
      ],
      [
        'Confirmed discrepancy in the final answer against the reference.',
        'Whether the working contains further errors was not verified.',
      ],
      {
        ...common,
        answerMatch: false,
        caveat: 'This confirms the final answer differs from the reference — not that every step of the working is wrong.',
      }
    );
  }

  // Match with too many reference parts missing → plausible, not confirmed.
  if ((exact || numericMatch) && missing.length > MAX_MISSING_FOR_MATCH) {
    return baseResult(
      'plausible_gap',
      'Possible gap: parts of the reference are missing from your answer',
      EVALUATION_RULES.plausibleGap,
      'medium',
      ctx,
      [`Final answer matches, but ${missing.length} key parts of the reference do not appear: ${missing.join(', ')}.`],
      ['Plausible gap: the headline answer is there, yet expected supporting content is absent — unconfirmed until you review it.'],
      {
        ...common,
        answerMatch: true,
        missingConcepts: missing,
        caveat: 'Candidate finding from text comparison only. Review the missing parts before treating them as real gaps.',
      }
    );
  }

  if (similarity >= REFERENCE_MATCH_SIMILARITY && missing.length <= MAX_MISSING_FOR_MATCH) {
    return baseResult(
      'no_gap',
      'No gap found in the available evidence',
      EVALUATION_RULES.noGap,
      'medium',
      ctx,
      [
        `Answer closely matches the reference (similarity ${(similarity * 100).toFixed(0)}%).`,
        `Submission final line: "${clip(studentFinal)}"; reference: "${clip(referenceFinal)}".`,
      ],
      [
        'No gap identified in the available evidence.',
        'Similar text is not proof that every step of the working is correct — steps were not verified.',
      ],
      {
        ...common,
        answerMatch: true,
        caveat: 'Based on text similarity to the reference. Intermediate reasoning was not verified.',
      }
    );
  }

  if (similarity < REFERENCE_MISMATCH_SIMILARITY) {
    return baseResult(
      'confirmed_error',
      'Your answer differs substantially from the reference',
      EVALUATION_RULES.confirmedError,
      'medium',
      ctx,
      [
        `Low similarity to the reference (${(similarity * 100).toFixed(0)}%): submission "${clip(text)}" vs reference "${clip(reference)}".${missingObserved}`,
      ],
      [
        'Confirmed discrepancy: the submitted answer does not carry the reference answer’s content.',
        'Possible causes (wrong method, wrong question, different phrasing) were not distinguished.',
      ],
      {
        ...common,
        answerMatch: false,
        caveat: 'Different from the reference in the available text — re-read the question before assuming the method is wrong.',
      }
    );
  }

  return baseResult(
    'plausible_gap',
    'Possible gap: your answer only partly matches the reference',
    EVALUATION_RULES.plausibleGap,
    similarity < 0.6 ? 'low' : 'medium',
    ctx,
    [
      `Partial similarity to the reference (${(similarity * 100).toFixed(0)}%, between the ${Math.round(REFERENCE_MISMATCH_SIMILARITY * 100)}% mismatch and ${Math.round(REFERENCE_MATCH_SIMILARITY * 100)}% match bounds).${missingObserved}`,
    ],
    ['Plausible but unconfirmed learning gap — the text overlaps the reference without matching it.'],
    {
      ...common,
      answerMatch: null,
      caveat: 'Uncertain comparison. Treat as a review prompt, not a diagnosis.',
    }
  );
}

function evaluateCoverage(ctx: EvalContext): EvaluationResult {
  const text = ctx.input.confirmedText.trim();
  const concepts = deriveKeyConcepts(ctx.input.topic);
  const { matched, missing, coverage } = matchConcepts(concepts, text);
  const coveragePercent = (coverage * 100).toFixed(0);

  if (concepts.length === 0) {
    return unavailable(
      'Add a reference answer for this question, or write what to look for in your topic notes, then evaluate again.',
      ctx
    );
  }

  const shared: Partial<EvaluationResult> = {
    missingConcepts: missing,
    observed: [
      `Key-idea coverage: ${matched.length} of ${concepts.length} derived ideas appear (${coveragePercent}%): ${matched.join(', ') || 'none'}.`,
      `Derived from: ${ctx.input.topic.notes.trim() ? 'topic title and notes' : 'topic title only'}; ${text.length} character(s) of confirmed text checked.`,
    ],
  };

  if (coverage >= COVERAGE_NO_GAP_THRESHOLD) {
    return baseResult(
      'no_gap',
      'No gap found in the available evidence',
      EVALUATION_RULES.noGap,
      'low',
      ctx,
      shared.observed ?? [],
      [
        'The write-up covers the key ideas derived from your own topic notes.',
        'Completeness was checked — answer correctness was NOT verified (no reference answer).',
      ],
      {
        ...shared,
        answerMatch: null,
        confidence: 'low',
        caveat: 'Completeness against your notes only. Without a reference answer this cannot confirm the answers themselves are correct.',
      }
    );
  }

  return baseResult(
    'plausible_gap',
    'Possible gap: key ideas from your notes are missing',
    EVALUATION_RULES.plausibleGap,
    'low',
    ctx,
    shared.observed ?? [],
    [
      `Plausible gap: these derived key ideas do not appear in your answer: ${missing.join(', ')}.`,
      'Unconfirmed — the wording may differ, or the idea may genuinely be missing.',
    ],
    {
      ...shared,
      answerMatch: null,
      confidence: 'low',
      caveat: 'Candidate finding from your own notes, not a confirmed mistake and not a syllabus check.',
    }
  );
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface EvaluationInput {
  /** Pages of the submission (only extraction status is read). */
  pages: readonly { extraction: { status: PageExtractionStatus } }[];
  /** Student-confirmed text — the only input evaluated. */
  confirmedText: string;
  /** Topic context: title + notes as the student wrote them. */
  topic: EvaluationTopicContext;
  /** Optional reference/model answer for this question. */
  referenceAnswer: string;
  /** Clock injection keeps `evaluatedAt` reproducible in tests. */
  now?: () => string;
}

export function evaluateSubmission(input: EvaluationInput): EvaluationResult {
  const ctx: EvalContext = { input, at: (input.now ?? (() => new Date().toISOString()))() };
  const text = input.confirmedText.trim();
  const reference = input.referenceAnswer.trim();
  const pagesFailed = input.pages.some((page) => page.extraction.status === 'failed');

  if (text.length === 0) {
    return pagesFailed ? extractionFailure(ctx) : insufficient('The confirmed text is empty — confirm or transcribe the work first.', ctx);
  }

  if (reference.length > 0) {
    return evaluateAgainstReference(ctx);
  }

  if (text.length < MIN_COVERAGE_TEXT_LENGTH) {
    return insufficient(
      `Only ${text.length} character(s) of confirmed text and no reference answer — at least ${MIN_COVERAGE_TEXT_LENGTH} characters (or a reference answer) are needed to compare.`,
      ctx
    );
  }

  return evaluateCoverage(ctx);
}
