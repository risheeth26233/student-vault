// Test C + J — extraction flow: honest provider-state classification, consent
// gate, page-boundary preservation, retry that only re-sends unread pages, and
// API failure handling (client never invents success).

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyExtractError,
  joinDraftText,
  runExtraction,
} from '../extractionService';
import { saveSubmissions, clearHandwritingData, getSubmission } from '../../../services/handwritingStore';
import type { OcrPageInput, OcrExtractResponse } from '../../../types/api';
import { AT, makePage, makeSubmission } from './fixtures';

function pendingPage(resourceId: string, page: number) {
  return makePage({ resourceId, page, name: `p${page}.jpg` });
}

function seed(pages = [pendingPage('res-1', 1), pendingPage('res-2', 2)]) {
  const submission = makeSubmission({ id: 'hws-x', pages });
  saveSubmissions([submission]);
  return submission;
}

const okResponse: OcrExtractResponse = {
  provider: 'openai-vision',
  configured: true,
  pages: [
    { id: 'res-1', status: 'ok', text: 'page one text', estimatedConfidence: 0.92, notes: [] },
    { id: 'res-2', status: 'ok', text: 'page two text', estimatedConfidence: 0.88, notes: [] },
  ],
};

beforeEach(() => {
  clearHandwritingData();
});

describe('classifyExtractError', () => {
  it('treats an unreachable server as provider_unavailable with a manual fallback', () => {
    const result = classifyExtractError(new Error('Failed to fetch'));
    expect(result.kind).toBe('provider_unavailable');
    expect(result.message).toContain('type the text in manually');
    expect(result.message).toContain('pages are saved');
  });

  it('treats auth problems as provider_unavailable (never a fake success)', () => {
    for (const status of [401, 403]) {
      const error = Object.assign(new Error('unauthorized'), { status });
      expect(classifyExtractError(error).kind).toBe('provider_unavailable');
    }
  });

  it('treats an unconfigured OCR provider as provider_unavailable', () => {
    const error = Object.assign(new Error('No OCR provider is configured.'), {
      status: 503,
      code: 'ocr_unavailable',
    });
    const result = classifyExtractError(error);
    expect(result.kind).toBe('provider_unavailable');
    expect(result.message).toContain('No OCR provider');
  });

  it('treats server/provider failures as retryable failures', () => {
    const error = Object.assign(new Error('provider exploded'), { status: 500 });
    const result = classifyExtractError(error);
    expect(result.kind).toBe('failed');
    expect(result.message).toContain('retry');
  });

  it('never classifies an unknown error as success', () => {
    expect(classifyExtractError(undefined).kind).toBe('provider_unavailable');
    expect(classifyExtractError({}).kind).toBe('provider_unavailable');
    expect(classifyExtractError({ status: 422 }).kind).toBe('failed');
  });
});

describe('joinDraftText', () => {
  it('preserves page order and boundaries with markers', () => {
    const joined = joinDraftText([
      makePage({ resourceId: 'b', page: 2, extraction: { status: 'ok', text: 'second', estimatedConfidence: 1, notes: [], provider: 'x' } }),
      makePage({ resourceId: 'a', page: 1, extraction: { status: 'ok', text: 'first', estimatedConfidence: 1, notes: [], provider: 'x' } }),
    ]);
    expect(joined).toBe('--- Page 1 ---\nfirst\n\n--- Page 2 ---\nsecond');
  });
});

describe('runExtraction', () => {
  it('refuses to send anything without explicit consent', async () => {
    const submission = seed();
    const requestExtract = vi.fn();
    const outcome = await runExtraction(
      submission,
      { consent: false },
      { loadPageDataUrl: async () => 'data:image/jpeg;base64,AAA', requestExtract, now: () => AT }
    );
    expect(requestExtract).not.toHaveBeenCalled();
    expect(outcome.result.kind).toBe('provider_unavailable');
    expect(outcome.result.message).toContain('did not consent');
    const stored = getSubmission('hws-x');
    expect(stored?.status).toBe('provider_unavailable');
    expect(stored?.extractionMessage).toContain('did not consent');
  });

  it('extracts every pending page and preserves page boundaries', async () => {
    const submission = seed();
    const loadPageDataUrl = vi.fn(async (id: string) => `data:image/jpeg;base64,${id}`);
    const requestExtract = vi.fn(
      async (_params: { pages: OcrPageInput[]; consent: boolean }) => okResponse
    );
    const outcome = await runExtraction(
      submission,
      { consent: true },
      { loadPageDataUrl, requestExtract, now: () => AT }
    );

    expect(outcome.result.kind).toBe('success');
    expect(requestExtract).toHaveBeenCalledTimes(1);
    expect(requestExtract.mock.calls[0]?.[0]?.pages.map((page) => page.id)).toEqual([
      'res-1',
      'res-2',
    ]);

    const stored = getSubmission('hws-x');
    expect(stored?.status).toBe('extracted');
    expect(stored?.extractionMessage).toBeNull();
    expect(stored?.pages.map((page) => page.extraction.status)).toEqual(['ok', 'ok']);
    expect(stored?.pages[0].extraction.text).toBe('page one text');
    expect(stored?.pages[1].extraction.text).toBe('page two text');
    expect(stored?.pages[0].extraction.provider).toBe('openai-vision');
    expect(stored?.pages[0].extraction.extractedAt).toBe(AT);
  });

  it('re-sends only pending/failed pages — confirmed pages are never re-requested', async () => {
    const submission = seed([
      makePage({
        resourceId: 'res-done',
        page: 1,
        extraction: {
          status: 'ok',
          text: 'already read',
          estimatedConfidence: 0.9,
          notes: [],
          provider: 'openai-vision',
          extractedAt: AT,
        },
      }),
      makePage({ resourceId: 'res-retry', page: 2, extraction: { status: 'failed', text: '', estimatedConfidence: null, notes: [], provider: null, error: 'provider_error' } }),
    ]);
    const requestExtract = vi.fn(
      async (_params: { pages: OcrPageInput[]; consent: boolean }): Promise<OcrExtractResponse> => ({
        provider: 'openai-vision',
        configured: true,
        pages: [{ id: 'res-retry', status: 'ok', text: 'retried text', estimatedConfidence: 0.9, notes: [] }],
      })
    );
    const outcome = await runExtraction(
      submission,
      { consent: true },
      { loadPageDataUrl: async () => 'data:image/jpeg;base64,AAA', requestExtract, now: () => AT }
    );

    expect(requestExtract).toHaveBeenCalledTimes(1);
    expect(requestExtract.mock.calls[0]?.[0]?.pages.map((page) => page.id)).toEqual(['res-retry']);
    expect(outcome.result.kind).toBe('success');
    const stored = getSubmission('hws-x');
    expect(stored?.pages[0].extraction.text).toBe('already read');
    expect(stored?.pages[1].extraction.text).toBe('retried text');
    expect(stored?.status).toBe('extracted');
  });

  it('persists provider_unavailable state when the API reports no provider', async () => {
    const submission = seed();
    const outcome = await runExtraction(
      submission,
      { consent: true },
      {
        loadPageDataUrl: async () => 'data:image/jpeg;base64,AAA',
        requestExtract: async () => {
          throw Object.assign(new Error('No OCR provider is configured on the server.'), {
            status: 503,
            code: 'ocr_unavailable',
          });
        },
        now: () => AT,
      }
    );
    expect(outcome.result.kind).toBe('provider_unavailable');
    const stored = getSubmission('hws-x');
    expect(stored?.status).toBe('provider_unavailable');
    expect(stored?.extractionMessage).toContain('No OCR provider');
    // Drafts remain editable for manual transcription.
    expect(stored?.pages.every((page) => page.extraction.status === 'pending')).toBe(true);
  });

  it('persists a retryable failure when the provider call fails mid-run', async () => {
    const submission = seed();
    const outcome = await runExtraction(
      submission,
      { consent: true },
      {
        loadPageDataUrl: async () => 'data:image/jpeg;base64,AAA',
        requestExtract: async () => {
          throw Object.assign(new Error('upstream boom'), { status: 500 });
        },
        now: () => AT,
      }
    );
    expect(outcome.result.kind).toBe('failed');
    const stored = getSubmission('hws-x');
    expect(stored?.status).toBe('extraction_failed');
    expect(stored?.extractionMessage).toContain('upstream boom');
    expect(stored?.extractionMessage).toContain('retry');
  });

  it('fails honestly when page blobs cannot be loaded (no API call is faked)', async () => {
    const submission = seed();
    const requestExtract = vi.fn();
    const outcome = await runExtraction(
      submission,
      { consent: true },
      {
        loadPageDataUrl: async () => null,
        requestExtract,
        now: () => AT,
      }
    );
    expect(requestExtract).not.toHaveBeenCalled();
    expect(outcome.result.kind).toBe('failed');
    const stored = getSubmission('hws-x');
    expect(stored?.status).toBe('extraction_failed');
    expect(stored?.pages.every((page) => page.extraction.error === 'page_data_unavailable')).toBe(true);
  });

  it('keeps partial results visible when only some pages are read', async () => {
    const submission = seed();
    const outcome = await runExtraction(
      submission,
      { consent: true },
      {
        loadPageDataUrl: async () => 'data:image/jpeg;base64,AAA',
        requestExtract: async (): Promise<OcrExtractResponse> => ({
          provider: 'openai-vision',
          configured: true,
          pages: [
            { id: 'res-1', status: 'ok', text: 'read this one', estimatedConfidence: 0.9, notes: [] },
            { id: 'res-2', status: 'failed', text: '', estimatedConfidence: null, notes: [], error: 'ocr_unavailable' },
          ],
        }),
        now: () => AT,
      }
    );
    expect(outcome.result.kind).toBe('success');
    const stored = getSubmission('hws-x');
    expect(stored?.status).toBe('extracted');
    expect(stored?.extractionMessage).toContain('1 of 2 page(s) could not be read');
    expect(stored?.pages[0].extraction.text).toBe('read this one');
    expect(stored?.pages[1].extraction.status).toBe('failed');
  });

  it('flags low-confidence pages as low_confidence with the provider notes', async () => {
    const submission = seed([pendingPage('res-1', 1)]);
    await runExtraction(
      submission,
      { consent: true },
      {
        loadPageDataUrl: async () => 'data:image/jpeg;base64,AAA',
        requestExtract: async (): Promise<OcrExtractResponse> => ({
          provider: 'openai-vision',
          configured: true,
          pages: [
            {
              id: 'res-1',
              status: 'low_confidence',
              text: 'half readable t3xt',
              estimatedConfidence: 0.55,
              notes: ['unreadable region bottom-right'],
            },
          ],
        }),
        now: () => AT,
      }
    );
    const stored = getSubmission('hws-x');
    expect(stored?.pages[0].extraction.status).toBe('low_confidence');
    expect(stored?.pages[0].extraction.notes).toEqual(['unreadable region bottom-right']);
    expect(stored?.pages[0].extraction.estimatedConfidence).toBe(0.55);
  });

  it('reports success without work when every page already has text', async () => {
    const submission = seed([
      makePage({
        resourceId: 'res-done',
        page: 1,
        extraction: { status: 'ok', text: 'done', estimatedConfidence: 1, notes: [], provider: 'x', extractedAt: AT },
      }),
    ]);
    const requestExtract = vi.fn();
    const outcome = await runExtraction(
      submission,
      { consent: true },
      { loadPageDataUrl: async () => null, requestExtract, now: () => AT }
    );
    expect(requestExtract).not.toHaveBeenCalled();
    expect(outcome.result.kind).toBe('success');
    expect(outcome.result.message).toContain('already');
  });
});
