// Shared fixtures for Phase 3 handwriting tests.
// Every factory is deterministic so tests stay reproducible.

import type {
  AnswerCheck,
  EvaluationResult,
  HandwritingSubmission,
  PageExtraction,
  PracticeAttempt,
  PracticeQuestion,
  SubmissionPage,
} from '../handwritingTypes';

export const AT = '2026-10-01T10:00:00.000Z';
export const AT_LATER = '2026-10-02T10:00:00.000Z';
export const AT_EVEN_LATER = '2026-10-03T10:00:00.000Z';

export function makeExtraction(overrides: Partial<PageExtraction> = {}): PageExtraction {
  return {
    status: 'pending',
    text: '',
    estimatedConfidence: null,
    notes: [],
    provider: null,
    ...overrides,
  };
}

export function makePage(overrides: Partial<SubmissionPage> = {}): SubmissionPage {
  return {
    resourceId: 'res-1',
    name: 'page1.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
    page: 1,
    extraction: makeExtraction(),
    ...overrides,
  };
}

export function makeEvaluation(overrides: Partial<EvaluationResult> = {}): EvaluationResult {
  return {
    outcome: 'no_gap',
    headline: 'No gap found in the available evidence',
    observed: ['observed fact'],
    inferred: ['inferred conclusion'],
    missingConcepts: [],
    confidence: 'medium',
    referenceUsed: true,
    answerMatch: true,
    reasoningVerified: false,
    caveat: 'caveat text',
    ruleId: 'sv.eval.test',
    evaluatedAt: AT,
    ...overrides,
  };
}

export function makeCheck(overrides: Partial<AnswerCheck> = {}): AnswerCheck {
  return {
    coverage: 1,
    matchedConcepts: ['photosynthesis'],
    missingConcepts: [],
    passed: true,
    graded: true,
    threshold: 0.6,
    explanation: 'Matched 1 of 1 key ideas.',
    ...overrides,
  };
}

export function makeAttempt(overrides: Partial<PracticeAttempt> = {}): PracticeAttempt {
  return {
    id: 'att-1',
    questionId: 'pq-1',
    phase: 'practice',
    prompt: 'Write the key ideas',
    answer: 'an answer long enough to be checked',
    check: makeCheck(),
    submittedAt: AT_LATER,
    ...overrides,
  };
}

export function makeQuestion(overrides: Partial<PracticeQuestion> = {}): PracticeQuestion {
  return {
    id: 'pq-1',
    topicId: 'topic-1',
    kind: 'recall',
    difficulty: 'foundational',
    prompt: 'Write down the key ideas in your own words.',
    instructions: 'Write 3–6 sentences.',
    expectedConcepts: ['photosynthesis', 'chlorophyll'],
    derivedFrom: 'topic_notes',
    origin: 'deterministic',
    sourceNote: 'Generated from your topic, notes and recorded evidence — not syllabus-verified.',
    locked: false,
    ...overrides,
  };
}

export function makeSubmission(
  overrides: Partial<HandwritingSubmission> = {}
): HandwritingSubmission {
  return {
    id: 'hws-1',
    subject: 'Biology',
    topicId: 'topic-1',
    topicTitle: 'Photosynthesis',
    question: '',
    referenceAnswer: '',
    status: 'draft',
    pages: [],
    confirmedText: '',
    evidenceQuality: null,
    confirmedAt: null,
    reviewedAt: null,
    extractionMessage: null,
    evaluation: null,
    attempts: [],
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

/** Deterministic FNV-ish hash for fixtures — not the production id helper. */
export function fakeFile(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}
