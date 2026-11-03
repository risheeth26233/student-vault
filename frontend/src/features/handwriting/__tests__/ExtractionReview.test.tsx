// @vitest-environment jsdom
// Tests C + D + E + J — extraction review: honest provider states, the
// consent gate, low-confidence review requirement, student correction as the
// confirmed input, API failure → manual path with a working retry, and stale
// extraction detection. The OCR client is mocked at its module boundary; the
// real extractionService (classification, persistence) runs for real.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../services/api', () => ({ handwritingApi: { extract: vi.fn(), status: vi.fn() } }));
vi.mock('../../../services/resourceStore', () => ({
  getResource: vi.fn(async () => ({ data: 'data:image/jpeg;base64,AA' })),
  addDocument: vi.fn(),
  getDocumentUrl: vi.fn(),
  deleteResource: vi.fn(async () => undefined),
}));

import { ExtractionReview } from '../components/ExtractionReview';
import { useHandwritingSubmissions } from '../../../hooks/useHandwriting';
import {
  clearHandwritingData,
  loadSubmissions,
  saveSubmissions,
} from '../../../services/handwritingStore';
import { handwritingApi } from '../../../services/api';
import type { OcrExtractResponse } from '../../../types/api';
import { makePage, makeSubmission } from './fixtures';

function Harness({
  id,
  ocrConfigured = true,
  ocrProvider = 'openai-vision',
}: {
  id: string;
  ocrConfigured: boolean | null;
  ocrProvider: string | null;
}) {
  const query = useHandwritingSubmissions();
  const submission = (query.data ?? []).find((entry) => entry.id === id) ?? null;
  if (!submission) return <p>loading…</p>;
  return (
    <ExtractionReview
      submission={submission}
      ocrConfigured={ocrConfigured}
      ocrProvider={ocrProvider}
    />
  );
}

function renderHarness(id: string, options: { ocrConfigured?: boolean | null; ocrProvider?: string | null } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness
        id={id}
        ocrConfigured={options.ocrConfigured ?? true}
        ocrProvider={options.ocrProvider ?? 'openai-vision'}
      />
    </QueryClientProvider>
  );
}

const OK_RESPONSE: OcrExtractResponse = {
  provider: 'openai-vision',
  configured: true,
  pages: [
    {
      id: 'res-1',
      status: 'ok',
      text: 'The answer is six',
      estimatedConfidence: 0.91,
      notes: [],
    },
  ],
};

beforeEach(() => {
  clearHandwritingData();
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('ExtractionReview', () => {
  it('offers manual transcription when no OCR provider is configured', async () => {
    saveSubmissions([
      makeSubmission({
        id: 'hws-1',
        status: 'provider_unavailable',
        pages: [makePage({ resourceId: 'res-1', page: 1 })],
        extractionMessage: 'No OCR provider is configured on this server.',
      }),
    ]);
    renderHarness('hws-1', { ocrConfigured: false, ocrProvider: null });

    expect((await screen.findByTestId('extraction-banner')).textContent).toContain('No OCR provider');
    expect(screen.queryByTestId('extract-button')).toBeNull();
    expect(screen.queryByTestId('consent-row')).toBeNull();
    expect(screen.getByTestId('extraction-review').textContent).toContain(
      'Automatic extraction is not configured on this server'
    );
    expect(screen.getByTestId('confirmed-text')).toBeTruthy();
  });

  it('gates extraction behind consent and persists a successful pass', async () => {
    saveSubmissions([
      makeSubmission({ id: 'hws-1', status: 'draft', pages: [makePage({ resourceId: 'res-1', page: 1 })] }),
    ]);
    vi.mocked(handwritingApi.extract).mockResolvedValue(OK_RESPONSE);
    renderHarness('hws-1');

    const extractButton = await screen.findByTestId('extract-button');
    expect((extractButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByTestId('ocr-consent'));
    expect((extractButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(extractButton);

    await waitFor(() => expect(loadSubmissions()[0].status).toBe('extracted'));
    expect(handwritingApi.extract).toHaveBeenCalledWith({
      pages: [{ id: 'res-1', dataUrl: 'data:image/jpeg;base64,AA' }],
      consent: true,
    });
    const stored = loadSubmissions()[0];
    expect(stored.pages[0].extraction.text).toBe('The answer is six');
    expect(stored.pages[0].extraction.provider).toBe('openai-vision');
    expect(stored.pages[0].extraction.extractedAt).toBeTruthy();
  });

  it('persists the manual path on API failure and recovers on retry', async () => {
    saveSubmissions([
      makeSubmission({ id: 'hws-1', status: 'draft', pages: [makePage({ resourceId: 'res-1', page: 1 })] }),
    ]);
    vi.mocked(handwritingApi.extract)
      .mockRejectedValueOnce(
        Object.assign(new Error('No OCR provider is configured on the server.'), {
          status: 503,
          code: 'ocr_unavailable',
        })
      )
      .mockResolvedValueOnce(OK_RESPONSE);
    renderHarness('hws-1');

    fireEvent.click(await screen.findByTestId('ocr-consent'));
    fireEvent.click(screen.getByTestId('extract-button'));

    await waitFor(() => expect(loadSubmissions()[0].status).toBe('provider_unavailable'));
    expect(loadSubmissions()[0].extractionMessage).toContain('No OCR provider');
    // The extract control is still offered — pages remain pending for retry.
    expect(screen.getByTestId('extract-button')).toBeTruthy();

    fireEvent.click(screen.getByTestId('extract-button'));
    await waitFor(() => expect(loadSubmissions()[0].status).toBe('extracted'));
    expect(loadSubmissions()[0].pages[0].extraction.text).toBe('The answer is six');
    expect(vi.mocked(handwritingApi.extract)).toHaveBeenCalledTimes(2);
  });

  it('requires an explicit review before confirming low-confidence pages', async () => {
    saveSubmissions([
      makeSubmission({
        id: 'hws-1',
        status: 'extracted',
        pages: [
          makePage({
            resourceId: 'res-1',
            page: 1,
            extraction: {
              status: 'low_confidence',
              text: 'h4lf readable t3xt',
              estimatedConfidence: 0.55,
              notes: ['unreadable region bottom-right'],
              provider: 'openai-vision',
              extractedAt: '2026-10-01T10:00:00.000Z',
            },
          }),
        ],
      }),
    ]);
    renderHarness('hws-1');

    expect(await screen.findByTestId('review-row')).toBeTruthy();
    expect(screen.getByTestId('page-notes-1').textContent).toContain('unreadable region bottom-right');
    expect((screen.getByTestId('confirm-text-button') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByTestId('review-confirmed'));
    expect((screen.getByTestId('confirm-text-button') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId('confirm-text-button'));

    await waitFor(() => expect(loadSubmissions()[0].status).toBe('confirmed'));
    const stored = loadSubmissions()[0];
    expect(stored.reviewedAt).toBeTruthy();
    expect(stored.evidenceQuality).toBe('ocr_confirmed'); // accepted as read
    expect(stored.confirmedText).toBe('--- Page 1 ---\nh4lf readable t3xt');
  });

  it('records student corrections as the confirmed input (ocr_corrected)', async () => {
    saveSubmissions([
      makeSubmission({
        id: 'hws-1',
        status: 'extracted',
        pages: [
          makePage({
            resourceId: 'res-1',
            page: 1,
            extraction: {
              status: 'ok',
              text: 'orginal text',
              estimatedConfidence: 0.9,
              notes: [],
              provider: 'openai-vision',
              extractedAt: '2026-10-01T10:00:00.000Z',
            },
          }),
        ],
      }),
    ]);
    renderHarness('hws-1');

    fireEvent.change(await screen.findByTestId('confirmed-text'), {
      target: { value: '--- Page 1 ---\ncorrected text' },
    });
    fireEvent.click(screen.getByTestId('confirm-text-button'));

    await waitFor(() => expect(loadSubmissions()[0].status).toBe('confirmed'));
    const stored = loadSubmissions()[0];
    expect(stored.confirmedText).toBe('--- Page 1 ---\ncorrected text');
    expect(stored.evidenceQuality).toBe('ocr_corrected');
  });

  it('labels hand-typed transcription as manual evidence', async () => {
    saveSubmissions([
      makeSubmission({
        id: 'hws-1',
        status: 'provider_unavailable',
        pages: [makePage({ resourceId: 'res-1', page: 1 })],
      }),
    ]);
    renderHarness('hws-1', { ocrConfigured: false, ocrProvider: null });

    fireEvent.change(await screen.findByTestId('confirmed-text'), {
      target: { value: 'typed the page out by hand' },
    });
    fireEvent.click(screen.getByTestId('confirm-text-button'));

    await waitFor(() => expect(loadSubmissions()[0].status).toBe('confirmed'));
    const stored = loadSubmissions()[0];
    expect(stored.evidenceQuality).toBe('manual');
    expect(stored.confirmedText).toBe('typed the page out by hand');
  });

  it('surfaces a stale "extracting" state (reloaded mid-run) with a retry affordance', async () => {
    saveSubmissions([
      makeSubmission({ id: 'hws-1', status: 'extracting', pages: [makePage({ resourceId: 'res-1', page: 1 })] }),
    ]);
    renderHarness('hws-1');
    expect((await screen.findByTestId('extraction-stale')).textContent).toContain('did not finish');
    expect(screen.getByTestId('extract-button')).toBeTruthy();
  });
});
