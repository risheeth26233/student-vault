// @vitest-environment jsdom
// Learning Insights page tests.
//
// The GuruGraph integration hook is mocked at its leaf module so the page's
// loading / offline / data states can be driven directly. Everything else —
// the view-model, the cards and the design-system components — runs for real.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockState = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock('../../../gurugraph/integration/useGuruGraphIntelligence', () => ({
  useGuruGraphIntelligence: () => mockState.current,
}));

import { LearningInsightsPage } from '../../../pages/LearningInsightsPage';
import { createGuruGraphService } from '../../../gurugraph/service/intelligenceService';
import { createMemoryStorage } from '../../../gurugraph/service/storage';
import { masteryRecordKey, subjectIdFromLabel } from '../../../gurugraph/domain/ids';
import { AT, fixtureSource } from '../../../gurugraph/__tests__/fixtures';

const snapshot = (() => {
  const service = createGuruGraphService({ now: () => AT, storage: createMemoryStorage() });
  service.ingest(fixtureSource());
  return service.compute();
})();

const QUADRATIC_KEY = masteryRecordKey(subjectIdFromLabel('Mathematics'), { topicId: 'topic-1' });
const MOLES_KEY = masteryRecordKey(subjectIdFromLabel('Chemistry'), { topicId: 'topic-3' });
const LOW_SCORE_GAP_ID = `gg.rule.low_score::topic-1`;

function hookResult(overrides: Record<string, unknown> = {}) {
  return {
    snapshot: null,
    report: null,
    summary: {
      topics: 0,
      assessments: 0,
      assignments: 0,
      attendanceSubjects: 0,
      resources: 0,
      subjects: 0,
    },
    isLoading: false,
    isReady: false,
    error: null,
    service: {},
    ...overrides,
  };
}

function renderPage(client?: QueryClient) {
  const queryClient =
    client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <LearningInsightsPage />
    </QueryClientProvider>
  );
  return queryClient;
}

beforeEach(() => {
  mockState.current = hookResult();
});

afterEach(() => {
  cleanup();
});

describe('LearningInsightsPage states', () => {
  it('renders a loading skeleton while intelligence is loading', () => {
    mockState.current = hookResult({ isLoading: true });
    renderPage();

    expect(screen.getByTestId('insights-loading')).toBeTruthy();
    expect(screen.queryByTestId('insights-error')).toBeNull();
  });

  it('shows an error state with a working retry when no snapshot is available', () => {
    mockState.current = hookResult({ error: new Error('server unreachable') });
    const client = renderPage();
    const spy = vi.spyOn(client, 'invalidateQueries');

    expect(screen.getByTestId('insights-error')).toBeTruthy();
    expect(screen.getByText(/server unreachable/i)).toBeTruthy();

    fireEvent.click(screen.getByTestId('insights-error-retry'));
    expect(spy).toHaveBeenCalled();
  });

  it('keeps showing last insights when a refresh fails but a snapshot exists', () => {
    mockState.current = hookResult({ snapshot, error: new Error('offline') });
    renderPage();

    expect(screen.getByTestId('insights-stale-banner')).toBeTruthy();
    // Content still renders from the persisted snapshot.
    expect(screen.getByTestId(`mastery-card-${QUADRATIC_KEY}`)).toBeTruthy();
    expect(screen.queryByTestId('insights-error')).toBeNull();
  });

  it('shows an empty state when there is no data at all', () => {
    renderPage();

    expect(screen.getByTestId('insights-empty')).toBeTruthy();
  });
});

describe('LearningInsightsPage content', () => {
  it('renders without any auth provider (guest access) and shows topic mastery', () => {
    mockState.current = hookResult({ snapshot, isReady: true });
    renderPage();

    expect(screen.getByRole('heading', { name: /learning insights/i })).toBeTruthy();

    // Topic with real evidence shows a level and a score.
    const quadratic = screen.getByTestId(`mastery-card-${QUADRATIC_KEY}`);
    expect(within(quadratic).getByTestId(`mastery-level-${QUADRATIC_KEY}`).textContent).toContain(
      'Developing'
    );
    expect(within(quadratic).getByTestId(`mastery-count-${QUADRATIC_KEY}`).textContent).toContain(
      '3 evidence signals'
    );

    // Topic with no measurable evidence is reported honestly, not guessed.
    const moles = screen.getByTestId(`mastery-card-${MOLES_KEY}`);
    expect(within(moles).getByTestId(`mastery-level-${MOLES_KEY}`).textContent).toContain(
      'Insufficient evidence'
    );
    expect(within(moles).getByTestId(`mastery-score-${MOLES_KEY}`).textContent).toContain(
      'No measurable evidence yet'
    );
    expect(within(moles).getByTestId(`mastery-insufficient-${MOLES_KEY}`)).toBeTruthy();
  });

  it('separates the inferred conclusion from observed evidence in the Why? section', () => {
    mockState.current = hookResult({ snapshot, isReady: true });
    renderPage();

    const card = screen.getByTestId(`mastery-card-${QUADRATIC_KEY}`);
    // Panel is collapsed by default.
    expect(within(card).queryByTestId(`mastery-${QUADRATIC_KEY}-why-panel`)).toBeNull();

    fireEvent.click(within(card).getByTestId(`mastery-${QUADRATIC_KEY}-why-toggle`));

    const panel = within(card).getByTestId(`mastery-${QUADRATIC_KEY}-why-panel`);
    expect(within(panel).getByTestId(`mastery-conclusion-${QUADRATIC_KEY}`).textContent).toContain(
      'Level: Developing'
    );
    expect(within(panel).getByTestId(`mastery-conclusion-${QUADRATIC_KEY}`).textContent).toContain(
      'gg.rule.mastery_estimate'
    );
    // Observed evidence lists the actual recorded signals.
    expect(within(panel).getByTestId(`mastery-evidence-${QUADRATIC_KEY}`).textContent).toContain(
      'Assessment result'
    );
    // The honest disclaimer is surfaced.
    expect(panel.textContent).toContain('Not a validated prediction');
  });

  it('renders candidate gaps and explains them in the Why? section', () => {
    mockState.current = hookResult({ snapshot, isReady: true });
    renderPage();

    const gapCard = screen.getByTestId(`gap-card-${LOW_SCORE_GAP_ID}`);
    expect(within(gapCard).getByTestId(`gap-category-${LOW_SCORE_GAP_ID}`).textContent).toContain(
      'Potential learning gap'
    );
    expect(within(gapCard).getByTestId(`gap-detail-${LOW_SCORE_GAP_ID}`)).toBeTruthy();

    fireEvent.click(within(gapCard).getByTestId(`gap-${LOW_SCORE_GAP_ID}-why-toggle`));

    const panel = within(gapCard).getByTestId(`gap-${LOW_SCORE_GAP_ID}-why-panel`);
    expect(within(panel).getByTestId(`gap-conclusion-${LOW_SCORE_GAP_ID}`).textContent).toContain(
      'Category: Potential learning gap'
    );
    expect(within(panel).getByTestId(`gap-conclusion-${LOW_SCORE_GAP_ID}`).textContent).toContain(
      'candidate (not confirmed)'
    );
    expect(within(panel).getByTestId(`gap-evidence-${LOW_SCORE_GAP_ID}`).textContent).toContain(
      'Assessment'
    );
    expect(panel.textContent).toContain('not a confirmed misconception');
  });

  it('shows all five supported gap categories and marks the reserved one', () => {
    mockState.current = hookResult({ snapshot, isReady: true });
    renderPage();

    for (const category of [
      'potential_learning_gap',
      'low_attendance',
      'missing_data',
      'insufficient_evidence',
      'confirmed_misconception',
    ]) {
      expect(screen.getByTestId(`insights-legend-${category}`)).toBeTruthy();
    }

    expect(screen.getByTestId('insights-legend-confirmed_misconception').textContent).toContain(
      'Reserved'
    );
    expect(screen.getByTestId('insights-legend-potential_learning_gap').textContent).toContain(
      'Present'
    );
    expect(screen.getByTestId('insights-legend-insufficient_evidence').textContent).toContain(
      'None now'
    );
  });
});
