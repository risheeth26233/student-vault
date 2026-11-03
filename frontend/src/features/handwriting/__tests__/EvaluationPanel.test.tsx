// @vitest-environment jsdom
// Test F (UI) — evaluation presentation: runs the real deterministic
// evaluator on the student-confirmed text, shows all six outcomes with the
// observed / inferred split, the caveat, and the stale banner when the text
// changed after the evaluation ran.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { EvaluationPanel } from '../components/EvaluationPanel';
import { useHandwritingSubmissions } from '../../../hooks/useHandwriting';
import {
  clearHandwritingData,
  loadSubmissions,
  saveSubmissions,
} from '../../../services/handwritingStore';
import { AT, AT_EVEN_LATER, makeEvaluation, makeSubmission } from './fixtures';

const TOPIC = {
  title: 'Photosynthesis Light Reactions',
  notes:
    'chlorophyll absorbs sunlight and converts water carbon into glucose while releasing oxygen gas as a byproduct of the reaction',
};

const BARE_TOPIC = { title: 'a b c', notes: '' };

function Harness({ id, topic = TOPIC }: { id: string; topic?: { title: string; notes: string } }) {
  const query = useHandwritingSubmissions();
  const submission = (query.data ?? []).find((entry) => entry.id === id) ?? null;
  if (!submission) return <p>loading…</p>;
  return (
    <EvaluationPanel
      submission={submission}
      topicContext={topic}
      onReviewText={vi.fn()}
      onOpenPractice={vi.fn()}
    />
  );
}

function renderHarness(id: string, topic?: { title: string; notes: string }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness id={id} topic={topic} />
    </QueryClientProvider>
  );
}

function confirmedSubmission(overrides = {}) {
  return makeSubmission({
    id: 'hws-e',
    status: 'confirmed',
    confirmedText: 'working line one\nx = 6',
    evidenceQuality: 'ocr_confirmed',
    confirmedAt: '2026-10-01T09:00:00.000Z',
    ...overrides,
  });
}

beforeEach(() => {
  clearHandwritingData();
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('EvaluationPanel', () => {
  it('evaluates against a reference and splits observed facts from inference', async () => {
    saveSubmissions([confirmedSubmission({ referenceAnswer: 'x = 6' })]);
    renderHarness('hws-e');

    expect((await screen.findByTestId('confirmed-text-summary')).textContent).toContain('x = 6');
    fireEvent.click(screen.getByTestId('evaluate-button'));

    await waitFor(() => expect(screen.getByTestId('evaluation-result')).toBeTruthy());
    const stored = loadSubmissions()[0];
    expect(stored.evaluation?.outcome).toBe('no_gap');
    expect(stored.status).toBe('evaluated');

    expect(screen.getByTestId('evaluation-outcome').textContent).toContain('No gap found');
    expect(screen.getByTestId('evaluation-headline').textContent).toBeTruthy();
    expect(screen.getByTestId('evaluation-confidence').textContent).toContain('high confidence');

    // Observed: facts. Inferred: the classified conclusion — and a matching
    // final answer is never presented as verified reasoning.
    const observed = screen.getByTestId('evaluation-observed');
    expect(observed.textContent).toContain('matches the reference');
    const inferred = screen.getByTestId('evaluation-inferred');
    expect(inferred.textContent).toContain('does NOT prove');
    expect(screen.getByTestId('evaluation-caveat')).toBeTruthy();
  });

  it('shows a definite mismatch as a confirmed error with its caveat', async () => {
    saveSubmissions([
      confirmedSubmission({ confirmedText: 'x = 9', referenceAnswer: 'x = 6' }),
    ]);
    renderHarness('hws-e');

    fireEvent.click(await screen.findByTestId('evaluate-button'));
    await waitFor(() => expect(screen.getByTestId('evaluation-result')).toBeTruthy());

    expect(loadSubmissions()[0].evaluation?.outcome).toBe('confirmed_error');
    expect(screen.getByTestId('evaluation-outcome').textContent).toMatch(/Confirmed error/);
    expect(screen.getByTestId('evaluation-caveat').textContent).toContain('not that every step');
  });

  it('renders every result state with confidence and caveat (no bare outcomes)', async () => {
    // No reference and no derivable notes ⇒ evaluation_unavailable — still honest.
    saveSubmissions([
      confirmedSubmission({
        confirmedText: 'A long write-up that clears the minimum text length requirement comfortably.',
        referenceAnswer: '',
      }),
    ]);
    renderHarness('hws-e', BARE_TOPIC);

    fireEvent.click(await screen.findByTestId('evaluate-button'));
    await waitFor(() => expect(screen.getByTestId('evaluation-result')).toBeTruthy());
    expect(loadSubmissions()[0].evaluation?.outcome).toBe('evaluation_unavailable');
    expect(screen.getByTestId('evaluation-confidence').textContent).toContain('no confidence');
    expect(screen.getByTestId('evaluation-caveat').textContent).toContain('not a judgement');
  });

  it('flags a stale evaluation when the confirmed text changed afterwards', async () => {
    saveSubmissions([
      confirmedSubmission({
        evaluation: makeEvaluation({ outcome: 'confirmed_error', evaluatedAt: AT }),
        confirmedAt: AT_EVEN_LATER, // re-confirmed after evaluation
        status: 'evaluated',
      }),
    ]);
    renderHarness('hws-e');

    expect((await screen.findByTestId('evaluation-stale')).textContent).toContain(
      'changed after this evaluation ran'
    );
    expect(screen.getByTestId('evaluate-button').textContent).toContain('Evaluate again');
  });

  it('persists the question and reference answer from the inputs', async () => {
    saveSubmissions([confirmedSubmission()]);
    renderHarness('hws-e');

    fireEvent.change(await screen.findByTestId('evaluation-question'), {
      target: { value: 'Exercise 4 — solve 2x + 5 = 17' },
    });
    fireEvent.blur(screen.getByTestId('evaluation-question'));
    fireEvent.change(screen.getByTestId('evaluation-reference'), { target: { value: 'x = 6' } });
    fireEvent.blur(screen.getByTestId('evaluation-reference'));

    await waitFor(() => {
      const stored = loadSubmissions()[0];
      expect(stored.question).toBe('Exercise 4 — solve 2x + 5 = 17');
      expect(stored.referenceAnswer).toBe('x = 6');
    });
  });
});
