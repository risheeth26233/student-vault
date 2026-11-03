// @vitest-environment jsdom
// Tests J + K (page side) — workflow orchestration: honest empty/loading
// states, OCR status failure never breaks the page, deep link opens the
// topic's latest submission, history list with open/delete, and the header
// links to Learning Insights and topics.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockTopics = vi.hoisted(() => ({
  current: { topics: [] as unknown[], isLoading: false },
}));
const mockGuru = vi.hoisted(() => ({
  current: {
    isLoading: false,
    snapshot: null,
    service: { getTopicIntelligence: () => null },
  },
}));

vi.mock('../../../hooks/useTopics', () => ({
  useAllTopics: () => ({
    data: { topics: mockTopics.current.topics },
    isLoading: mockTopics.current.isLoading,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('../../../gurugraph/integration/useGuruGraphIntelligence', () => ({
  useGuruGraphIntelligence: () => mockGuru.current,
}));
vi.mock('../../../services/api', () => ({
  handwritingApi: { status: vi.fn(), extract: vi.fn() },
}));

import { HandwritingPage } from '../../../pages/HandwritingPage';
import {
  clearHandwritingData,
  loadSubmissions,
  saveSubmissions,
} from '../../../services/handwritingStore';
import { handwritingApi } from '../../../services/api';
import type { Topic } from '../../../types/api';
import { makeEvaluation, makeSubmission } from './fixtures';

const BIOLOGY_TOPIC = {
  id: 'topic-1',
  subject: 'Biology',
  title: 'Photosynthesis',
  notes: 'chlorophyll absorbs sunlight',
} as unknown as Topic;

const MATH_TOPIC = {
  id: 'topic-2',
  subject: 'Mathematics',
  title: 'Quadratics',
  notes: '',
} as unknown as Topic;

function renderPage(initialEntry = '/handwriting') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={client}>
        <HandwritingPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  clearHandwritingData();
  vi.clearAllMocks();
  mockTopics.current = { topics: [BIOLOGY_TOPIC, MATH_TOPIC], isLoading: false };
  mockGuru.current = {
    isLoading: false,
    snapshot: null,
    service: { getTopicIntelligence: () => null },
  };
  vi.mocked(handwritingApi.status).mockResolvedValue({
    configured: true,
    provider: 'openai-vision',
    maxPages: 8,
    maxPageDataUrlChars: 11_200_000,
  });
});

afterEach(cleanup);

describe('HandwritingPage', () => {
  it('asks for a topic first when none exist', async () => {
    mockTopics.current = { topics: [], isLoading: false };
    renderPage();
    expect(await screen.findByText('Add a topic first')).toBeTruthy();
    expect(screen.queryByTestId('submission-composer')).toBeNull();
  });

  it('shows skeletons while records load', () => {
    mockTopics.current = { topics: [], isLoading: true };
    renderPage();
    expect(screen.getByTestId('handwriting-loading')).toBeTruthy();
  });

  it('renders the composer and honest empty history for a fresh workspace', async () => {
    renderPage();
    expect(await screen.findByTestId('submission-composer')).toBeTruthy();
    expect(screen.getByText('No handwritten work yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Learning Insights' }).getAttribute('href')).toBe('/insights');
  });

  it('keeps working when the OCR status endpoint fails (J)', async () => {
    vi.mocked(handwritingApi.status).mockRejectedValue(new Error('server unreachable'));
    renderPage();
    // The page still renders the full workflow; OCR state stays "unknown".
    expect(await screen.findByTestId('submission-composer')).toBeTruthy();
    await waitFor(() =>
      expect(vi.mocked(handwritingApi.status)).toHaveBeenCalledTimes(1)
    );
    expect(screen.getByText('No handwritten work yet')).toBeTruthy();
  });

  it('deep link opens the latest submission for the topic with its panels', async () => {
    saveSubmissions([
      makeSubmission({
        id: 'hws-deep',
        topicId: 'topic-1',
        topicTitle: 'Photosynthesis',
        status: 'evaluated',
        confirmedText: 'chlorophyll absorbs sunlight to release oxygen',
        evidenceQuality: 'ocr_confirmed',
        confirmedAt: '2026-10-01T09:00:00.000Z',
        evaluation: makeEvaluation({ outcome: 'no_gap' }),
      }),
    ]);
    renderPage('/handwriting?topic=topic-1');

    expect(await screen.findByTestId('evaluation-panel')).toBeTruthy();
    expect(screen.getByTestId('practice-panel')).toBeTruthy();
    expect(screen.getByTestId('progress-panel')).toBeTruthy();
    expect(screen.getByTestId('guru-context')).toBeTruthy();
    expect(screen.getByTestId('active-status').textContent).toContain('evaluated');
    // Composer locks to the linked topic.
    expect(screen.queryByTestId('composer-topic')).toBeNull();
  });

  it('lists history with open and two-step delete', async () => {
    saveSubmissions([
      makeSubmission({ id: 'hws-1', topicId: 'topic-1', topicTitle: 'Photosynthesis' }),
      makeSubmission({ id: 'hws-2', topicId: 'topic-2', topicTitle: 'Quadratics', subject: 'Mathematics' }),
    ]);
    renderPage();

    const list = await screen.findByTestId('submission-list');
    expect(list.textContent).toContain('Photosynthesis');
    expect(list.textContent).toContain('Quadratics');

    fireEvent.click(screen.getByTestId('open-hws-1'));
    expect(await screen.findByTestId('active-toolbar')).toBeTruthy();

    fireEvent.click(screen.getByTestId('delete-submission'));
    fireEvent.click(screen.getByTestId('confirm-delete'));
    await waitFor(() => expect(loadSubmissions()).toHaveLength(1));
    expect(loadSubmissions()[0].id).toBe('hws-2');
    expect(await screen.findByTestId('submission-list')).toBeTruthy();
  });

  it('starts a new submission without discarding the active one from history', async () => {
    saveSubmissions([
      makeSubmission({
        id: 'hws-old',
        topicId: 'topic-1',
        topicTitle: 'Photosynthesis',
        status: 'evaluated',
        evaluation: makeEvaluation(),
      }),
    ]);
    renderPage('/handwriting?topic=topic-1');
    await screen.findByTestId('evaluation-panel');

    fireEvent.click(screen.getByTestId('new-submission'));
    // Back to the composer, topic preselected from the link, history intact.
    expect(await screen.findByTestId('composer-topic')).toBeTruthy();
    expect((screen.getByTestId('composer-topic') as HTMLSelectElement).value).toBe('topic-1');
    expect(loadSubmissions()).toHaveLength(1);
  });
});
