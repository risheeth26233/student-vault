// Handwritten-work submission records — local-first persistence (Phase 3).
//
// Persistence conventions follow Phase 1/2:
// - Records are small JSON (metadata, extracted/confirmed text, evaluations,
//   attempts) stored in localStorage under `sv_handwriting`, with an in-memory
//   fallback when localStorage is unavailable — same shape as the GuruGraph
//   service storage.
// - Page IMAGES never enter localStorage: pages reference Resource ids whose
//   blobs live in IndexedDB/R2 via the existing resourceStore. `loadSubmissions`
//   output must stay JSON-safe and image-free by construction.
// - The backend holds no submission records (stateless OCR only), so there is
//   no API-first layer to fall back from — documented in AGENTS.md.

import type {
  EvaluationResult,
  HandwritingSubmission,
  PracticeAttempt,
  SubmissionPage,
} from '../features/handwriting/handwritingTypes';
import { normalizeForDuplicate } from '../features/handwriting/evaluation';
import { deleteResource } from './resourceStore';
import { createId } from './storage';

const STORAGE_KEY = 'sv_handwriting';
const HANDWRITING_VERSION = 1;

interface HandwritingEnvelope {
  version: number;
  submissions: HandwritingSubmission[];
}

// In-memory fallback when localStorage is unavailable (non-browser contexts).
let memoryStore: HandwritingSubmission[] = [];

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Structural sanity check — malformed records are dropped, never thrown. */
function isSubmission(value: unknown): value is HandwritingSubmission {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.topicId === 'string' &&
    typeof value.subject === 'string' &&
    typeof value.topicTitle === 'string' &&
    typeof value.status === 'string' &&
    Array.isArray(value.pages) &&
    Array.isArray(value.attempts) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function parseEnvelope(raw: string | null): HandwritingSubmission[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed) || parsed.version !== HANDWRITING_VERSION) return [];
    const submissions = Array.isArray(parsed.submissions) ? parsed.submissions : [];
    return submissions.filter(isSubmission);
  } catch {
    return [];
  }
}

export function loadSubmissions(): HandwritingSubmission[] {
  if (!hasLocalStorage()) return [...memoryStore];
  try {
    return parseEnvelope(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveSubmissions(submissions: readonly HandwritingSubmission[]): void {
  const list = [...submissions];
  if (!hasLocalStorage()) {
    memoryStore = list;
    return;
  }
  const envelope: HandwritingEnvelope = { version: HANDWRITING_VERSION, submissions: list };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Quota/serialization failure — keep the in-memory copy so the session
    // still works and the student is not silently told their work was saved.
    memoryStore = list;
    throw new Error(
      'Could not save the submission on this device (browser storage is full or blocked). Free space and try again.'
    );
  }
  memoryStore = list;
}

/** Test/reset helper — clears records only (page images stay in Resource storage). */
export function clearHandwritingData(): void {
  memoryStore = [];
  if (!hasLocalStorage()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getSubmission(id: string): HandwritingSubmission | null {
  return loadSubmissions().find((submission) => submission.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Mutations (every mutation persists synchronously and bumps `updatedAt`)
// ---------------------------------------------------------------------------

function mutate(
  id: string,
  updater: (submission: HandwritingSubmission) => HandwritingSubmission | null,
  now: () => string
): HandwritingSubmission | null {
  const submissions = loadSubmissions();
  const index = submissions.findIndex((submission) => submission.id === id);
  if (index < 0) return null;
  const updated = updater(submissions[index]);
  if (!updated) return null;
  const stamped: HandwritingSubmission = { ...updated, updatedAt: now() };
  submissions[index] = stamped;
  saveSubmissions(submissions);
  return stamped;
}

export function createSubmission(
  input: { subject: string; topicId: string; topicTitle: string },
  now: () => string = () => new Date().toISOString()
): HandwritingSubmission {
  const at = now();
  const submission: HandwritingSubmission = {
    id: `hws_${createId()}`,
    subject: input.subject,
    topicId: input.topicId,
    topicTitle: input.topicTitle,
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
    createdAt: at,
    updatedAt: at,
  };
  const submissions = loadSubmissions();
  submissions.push(submission);
  saveSubmissions(submissions);
  return submission;
}

export function updateSubmission(
  id: string,
  updater: (submission: HandwritingSubmission) => HandwritingSubmission,
  now: () => string = () => new Date().toISOString()
): HandwritingSubmission | null {
  return mutate(id, updater, now);
}

/** Append uploaded pages (each already persisted as a Resource). */
export function addSubmissionPages(
  id: string,
  pages: readonly SubmissionPage[],
  now: () => string = () => new Date().toISOString()
): HandwritingSubmission | null {
  return mutate(
    id,
    (submission) => ({
      ...submission,
      pages: [...submission.pages, ...pages],
      extractionMessage: null,
    }),
    now
  );
}

/**
 * Remove one page's record. The image blob is deleted from Resource storage
 * best-effort (the record update succeeds even if blob deletion fails, so the
 * student is never stuck with an unremovable page).
 */
export async function removeSubmissionPage(
  id: string,
  resourceId: string,
  now: () => string = () => new Date().toISOString()
): Promise<HandwritingSubmission | null> {
  try {
    await deleteResource(resourceId);
  } catch {
    // Blob cleanup is best-effort; the reference is dropped either way.
  }
  return mutate(
    id,
    (submission) => {
      const pages = submission.pages.filter((page) => page.resourceId !== resourceId);
      if (pages.length === submission.pages.length) return submission;
      return { ...submission, pages };
    },
    now
  );
}

/** Delete the whole submission, cleaning up its page images best-effort. */
export async function deleteSubmission(id: string): Promise<boolean> {
  const submissions = loadSubmissions();
  const target = submissions.find((submission) => submission.id === id);
  if (!target) return false;
  for (const page of target.pages) {
    try {
      await deleteResource(page.resourceId);
    } catch {
      // best-effort
    }
  }
  saveSubmissions(submissions.filter((submission) => submission.id !== id));
  return true;
}

/** Freeze the student-confirmed text — the only input evaluation may use. */
export function confirmSubmissionText(
  id: string,
  input: {
    text: string;
    evidenceQuality: HandwritingSubmission['evidenceQuality'];
    /** Set when low-confidence pages were explicitly reviewed before confirming. */
    markReviewed?: boolean;
  },
  now: () => string = () => new Date().toISOString()
): HandwritingSubmission | null {
  return mutate(
    id,
    (submission) => ({
      ...submission,
      confirmedText: input.text,
      evidenceQuality: input.evidenceQuality,
      confirmedAt: now(),
      reviewedAt: input.markReviewed ? now() : submission.reviewedAt,
      status: submission.evaluation ? 'evaluated' : 'confirmed',
    }),
    now
  );
}

export function saveEvaluation(
  id: string,
  evaluation: EvaluationResult,
  now: () => string = () => new Date().toISOString()
): HandwritingSubmission | null {
  return mutate(
    id,
    (submission) => ({ ...submission, evaluation, status: 'evaluated' }),
    now
  );
}

export interface AddAttemptResult {
  attempt: PracticeAttempt;
  duplicate: boolean;
}

/**
 * Record a practice/reassessment attempt. Duplicate-submission prevention: the
 * same question with the same (normalised) answer is rejected and the existing
 * attempt returned, so identical re-submits cannot inflate progress evidence.
 */
export function addAttempt(
  submissionId: string,
  attempt: PracticeAttempt,
  now: () => string = () => new Date().toISOString()
): AddAttemptResult | null {
  // Holder object: closure assignment is tracked reliably on properties.
  const holder: { result: AddAttemptResult | null } = { result: null };

  const updated = mutate(
    submissionId,
    (submission) => {
      const normalized = normalizeForDuplicate(attempt.answer);
      const existing = submission.attempts.find(
        (candidate) =>
          candidate.questionId === attempt.questionId &&
          normalizeForDuplicate(candidate.answer) === normalized &&
          normalized.length > 0
      );
      if (existing) {
        holder.result = { attempt: existing, duplicate: true };
        return submission;
      }
      holder.result = { attempt, duplicate: false };
      return { ...submission, attempts: [...submission.attempts, attempt] };
    },
    now
  );

  if (!updated) return null;
  return holder.result;
}
