// @vitest-environment jsdom
// Test I — submission persistence: records survive a simulated reload, image
// bytes never enter localStorage, mutations are durable, and duplicate
// attempts are rejected at the storage boundary.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addAttempt,
  addSubmissionPages,
  clearHandwritingData,
  confirmSubmissionText,
  createSubmission,
  deleteSubmission,
  getSubmission,
  loadSubmissions,
  removeSubmissionPage,
  saveEvaluation,
  saveSubmissions,
  updateSubmission,
} from '../../../services/handwritingStore';
import { AT, AT_LATER, makeAttempt, makeCheck, makeEvaluation, makePage, makeSubmission } from './fixtures';

/** Same key the store writes to — asserted so a rename cannot go unnoticed. */
const STORAGE_KEY = 'sv_handwriting';

beforeEach(() => {
  clearHandwritingData();
  vi.restoreAllMocks();
});

describe('persistence', () => {
  it('creates and reloads a submission across a simulated page reload', () => {
    const created = createSubmission(
      { subject: 'Biology', topicId: 'topic-1', topicTitle: 'Photosynthesis' },
      () => AT
    );
    expect(created.status).toBe('draft');

    // Simulated reload: a fresh read straight from localStorage.
    const reloaded = loadSubmissions();
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0]).toEqual(created);
    expect(getSubmission(created.id)).toEqual(created);
  });

  it('stores no image bytes and no data URLs in localStorage', () => {
    const submission = makeSubmission({
      pages: [
        makePage({ resourceId: 'res-blob', extraction: { status: 'ok', text: 'x', estimatedConfidence: 1, notes: [], provider: 'p' } }),
      ],
      confirmedText: 'the confirmed text',
    });
    saveSubmissions([submission]);
    const raw = localStorage.getItem(STORAGE_KEY) ?? '';
    expect(raw).not.toContain('data:image');
    expect(raw).not.toContain('base64');
    // Pages reference Resource ids only.
    expect(raw).toContain('res-blob');
  });

  it('drops malformed or version-mismatched payloads instead of throwing', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadSubmissions()).toEqual([]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, submissions: [makeSubmission()] }));
    expect(loadSubmissions()).toEqual([]);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, submissions: [{ bogus: true }, makeSubmission()] })
    );
    expect(loadSubmissions()).toHaveLength(1); // malformed entry filtered
  });

  it('reports a storage failure instead of pretending the save happened', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => saveSubmissions([makeSubmission()])).toThrow(/storage|quota|full/i);
    spy.mockRestore();
  });
});

describe('mutations', () => {
  it('appends pages and stamps updatedAt', () => {
    const created = createSubmission({ subject: 'Biology', topicId: 't', topicTitle: 'T' }, () => AT);
    const updated = addSubmissionPages(created.id, [makePage()], () => AT_LATER);
    expect(updated?.pages).toHaveLength(1);
    expect(updated?.updatedAt).toBe(AT_LATER);
    expect(loadSubmissions()[0].pages).toHaveLength(1);
  });

  it('confirming text freezes it as the evaluation input with quality', () => {
    const created = createSubmission({ subject: 'Biology', topicId: 't', topicTitle: 'T' }, () => AT);
    const confirmed = confirmSubmissionText(
      created.id,
      { text: 'the work says...', evidenceQuality: 'ocr_corrected', markReviewed: true },
      () => AT_LATER
    );
    expect(confirmed?.status).toBe('confirmed');
    expect(confirmed?.confirmedAt).toBe(AT_LATER);
    expect(confirmed?.evidenceQuality).toBe('ocr_corrected');
    expect(confirmed?.reviewedAt).toBe(AT_LATER);
    expect(loadSubmissions()[0].confirmedText).toBe('the work says...');
  });

  it('saving an evaluation moves status to evaluated', () => {
    const created = createSubmission({ subject: 'Biology', topicId: 't', topicTitle: 'T' }, () => AT);
    const evaluated = saveEvaluation(created.id, makeEvaluation({ evaluatedAt: AT_LATER }), () => AT_LATER);
    expect(evaluated?.status).toBe('evaluated');
    expect(evaluated?.evaluation?.outcome).toBe('no_gap');
  });

  it('rejects a duplicate attempt (same question, same normalised answer) at the storage boundary', () => {
    const created = createSubmission({ subject: 'Biology', topicId: 't', topicTitle: 'T' }, () => AT);
    const attempt = makeAttempt({
      questionId: 'pq-1',
      answer: 'The light reactions happen here.',
      check: makeCheck({ passed: false, coverage: 0.3 }),
      submittedAt: AT_LATER,
    });

    const first = addAttempt(created.id, attempt, () => AT_LATER);
    expect(first?.duplicate).toBe(false);
    expect(first?.attempt.id).toBe(attempt.id);

    const duplicate = addAttempt(
      created.id,
      { ...attempt, id: 'different-local-id', answer: 'the light reactions happen here' },
      () => AT_LATER
    );
    expect(duplicate?.duplicate).toBe(true);
    expect(duplicate?.attempt.id).toBe(attempt.id); // returns the original
    expect(loadSubmissions()[0].attempts).toHaveLength(1);
  });

  it('accepts a genuinely different answer for the same question', () => {
    const created = createSubmission({ subject: 'Biology', topicId: 't', topicTitle: 'T' }, () => AT);
    addAttempt(created.id, makeAttempt({ questionId: 'pq-1', answer: 'first attempt text', submittedAt: AT }), () => AT);
    const second = addAttempt(
      created.id,
      makeAttempt({ id: 'att-2', questionId: 'pq-1', answer: 'a corrected second attempt', submittedAt: AT_LATER }),
      () => AT_LATER
    );
    expect(second?.duplicate).toBe(false);
    expect(loadSubmissions()[0].attempts).toHaveLength(2);
  });

  it('returns null for unknown submission ids instead of creating records', () => {
    expect(updateSubmission('missing-id', (submission) => submission)).toBeNull();
    expect(loadSubmissions()).toEqual([]);
  });

  it('removes a page record and cleans up its resource best-effort', async () => {
    const created = createSubmission({ subject: 'Biology', topicId: 't', topicTitle: 'T' }, () => AT);
    addSubmissionPages(created.id, [makePage({ resourceId: 'res-del' })], () => AT);
    const after = await removeSubmissionPage(created.id, 'res-del', () => AT_LATER);
    expect(after?.pages).toHaveLength(0);
    expect(loadSubmissions()[0].pages).toHaveLength(0);
  });

  it('deleting a submission removes the record from storage', async () => {
    const created = createSubmission({ subject: 'Biology', topicId: 't', topicTitle: 'T' }, () => AT);
    expect(await deleteSubmission(created.id)).toBe(true);
    expect(loadSubmissions()).toEqual([]);
    expect(await deleteSubmission(created.id)).toBe(false);
  });
});
