// @vitest-environment jsdom
// Test G (UI) — practice flow: deterministic questions with visible
// provenance, answer submission with the automatic coverage check, honest
// duplicate rejection, locked stretch question, empty state, and the
// reassessment path.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { PracticePanel } from '../components/PracticePanel';
import { generatePracticeSet, type PracticeTopicContext } from '../practiceEngine';
import { useHandwritingSubmissions } from '../../../hooks/useHandwriting';
import { clearHandwritingData, loadSubmissions, saveSubmissions } from '../../../services/handwritingStore';
import { AT, AT_LATER, makeCheck, makeSubmission } from './fixtures';

const TOPIC_CONTEXT: PracticeTopicContext = {
  id: 'topic-1',
  title: 'Photosynthesis Light Reactions',
  subject: 'Biology',
  notes:
    'chlorophyll absorbs sunlight and converts water carbon into glucose while releasing oxygen gas as a byproduct of the reaction',
};

const PASSING_ANSWER =
  'Photosynthesis: the light reactions use chlorophyll which absorbs sunlight, converts water and carbon into glucose while releasing oxygen.';

function Harness({ id }: { id: string }) {
  const query = useHandwritingSubmissions();
  const submission = (query.data ?? []).find((entry) => entry.id === id) ?? null;
  if (!submission) return <p>loading…</p>;
  return (
    <PracticePanel submission={submission} topicContext={TOPIC_CONTEXT} topicIntelligence={null} />
  );
}

function renderHarness(id: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness id={id} />
    </QueryClientProvider>
  );
}

async function submitAnswer(value: string): Promise<void> {
  fireEvent.change(await screen.findByTestId('practice-answer'), { target: { value } });
  fireEvent.click(screen.getByTestId('practice-submit'));
}

beforeEach(() => {
  clearHandwritingData();
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('PracticePanel', () => {
  it('renders the first generated question with honest provenance labels', async () => {
    saveSubmissions([makeSubmission({ id: 'hws-p' })]);
    renderHarness('hws-p');

    const question = await screen.findByTestId('practice-question');
    expect(question.textContent).toContain('generated · not syllabus-verified');
    expect(screen.getByTestId('practice-question-prompt').textContent).toMatch(/\w/);
    expect(screen.getByTestId('practice-locked-stretch')).toBeTruthy();
    expect(screen.getByTestId('practice-empty')).toBeTruthy();
    expect(screen.getByTestId('practice-panel').textContent).toContain(
      'an automatic coverage check'
    );
  });

  it('records a checked attempt and shows the check result', async () => {
    saveSubmissions([makeSubmission({ id: 'hws-p' })]);
    renderHarness('hws-p');

    await submitAnswer(PASSING_ANSWER);

    await waitFor(() => expect(loadSubmissions()[0].attempts).toHaveLength(1));
    const attempt = loadSubmissions()[0].attempts[0];
    expect(attempt.phase).toBe('practice');
    expect(attempt.check?.passed).toBe(true);
    expect(attempt.check?.coverage).toBeGreaterThanOrEqual(0.6);

    await screen.findByTestId('latest-check');
    expect(screen.getByTestId('practice-check-result').textContent).toContain(
      'Passed the automatic check'
    );
    expect(screen.getByTestId('check-explanation').textContent).toContain('not a teacher');
    expect(screen.getByTestId('practice-attempts')).toBeTruthy();
  });

  it('rejects a duplicate answer with an explanation instead of recording it twice', async () => {
    saveSubmissions([makeSubmission({ id: 'hws-p' })]);
    renderHarness('hws-p');

    await submitAnswer('no');
    await waitFor(() => expect(loadSubmissions()[0].attempts).toHaveLength(1));
    expect(loadSubmissions()[0].attempts[0].check?.passed).toBe(false);
    // Failed ⇒ same question stays active.

    await submitAnswer('no');
    await screen.findByTestId('practice-duplicate');
    expect(screen.getByTestId('practice-duplicate').textContent).toContain('already recorded');
    expect(loadSubmissions()[0].attempts).toHaveLength(1);
  });

  it('blocks empty answers with an inline message and records nothing', async () => {
    saveSubmissions([makeSubmission({ id: 'hws-p' })]);
    renderHarness('hws-p');

    await submitAnswer('   ');
    expect(screen.getByTestId('practice-error').textContent).toContain(
      'Type your answer before submitting.'
    );
    expect(loadSubmissions()[0].attempts).toHaveLength(0);
  });

  it('unlocks everything after passing attempts and runs a reassessment', async () => {
    // All generated questions (including the stretch once unlocked) passed.
    const baseQuestions = generatePracticeSet({
      topic: TOPIC_CONTEXT,
      evaluation: null,
      topicIntelligence: null,
      attempts: [],
    });
    const passedAttempts = baseQuestions.map((question, index) => ({
      id: `att-${index}`,
      questionId: question.id,
      phase: 'practice' as const,
      prompt: question.prompt,
      answer: 'a recorded answer from an earlier session',
      check: makeCheck({ passed: true }),
      submittedAt: AT_LATER,
    }));
    saveSubmissions([makeSubmission({ id: 'hws-p', attempts: passedAttempts })]);
    renderHarness('hws-p');

    await screen.findByTestId('practice-all-passed');
    expect(screen.queryByTestId('practice-question')).toBeNull();

    fireEvent.click(screen.getByTestId('practice-reassessment-cta'));
    expect(screen.getByTestId('reassessment-prompt').textContent).toContain(
      'Without consulting your notes'
    );

    fireEvent.change(screen.getByTestId('reassessment-answer'), {
      target: { value: PASSING_ANSWER },
    });
    fireEvent.click(screen.getByTestId('reassessment-submit'));

    await waitFor(() => {
      const attempts = loadSubmissions()[0].attempts;
      expect(attempts.some((attempt) => attempt.phase === 'reassessment')).toBe(true);
    });
    const reassessment = loadSubmissions()[0].attempts.find(
      (attempt) => attempt.phase === 'reassessment'
    );
    expect(reassessment?.check?.passed).toBe(true);
    expect(loadSubmissions()[0].attempts).toHaveLength(baseQuestions.length + 1);
    expect(await screen.findByTestId('reassessment-result')).toBeTruthy();
  });

  it('shows attempts recorded on a past session, including ungraded ones', async () => {
    saveSubmissions([
      makeSubmission({
        id: 'hws-p',
        attempts: [
          {
            id: 'att-old',
            questionId: 'pq-legacy',
            phase: 'practice',
            prompt: 'An older question',
            answer: 'recorded without an automatic check',
            check: makeCheck({ graded: false, passed: false, coverage: 0 }),
            submittedAt: AT,
          },
        ],
      }),
    ]);
    renderHarness('hws-p');

    expect(await screen.findByTestId('practice-attempts')).toBeTruthy();
    expect(screen.getByTestId('attempt-att-old').textContent).toContain('recorded');
    expect(screen.queryByTestId('practice-empty')).toBeNull();
  });
});
