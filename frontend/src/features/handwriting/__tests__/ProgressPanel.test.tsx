// @vitest-environment jsdom
// Test H (UI) — progress panel: honest direction badges, always-present
// caveat, labelled timeline, and the "no definite observations" empty state.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { ProgressPanel } from '../components/ProgressPanel';
import { clearHandwritingData } from '../../../services/handwritingStore';
import { PROGRESS_CAVEAT } from '../evaluation';
import { AT, AT_LATER, makeAttempt, makeCheck, makeEvaluation, makeSubmission } from './fixtures';

beforeEach(() => {
  clearHandwritingData();
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('ProgressPanel', () => {
  it('shows an honest empty state when nothing definite was observed', () => {
    render(<ProgressPanel submission={makeSubmission({ id: 'hws-g' })} />);
    expect(screen.getByTestId('progress-empty').textContent).toContain('No definite observations yet');
    expect(screen.queryByTestId('progress-summary')).toBeNull();
    expect(screen.getByTestId('progress-timeline')).toBeTruthy();
    expect(screen.getByTestId('timeline-submitted')).toBeTruthy();
  });

  it('reports an improved direction with its pair count and caveat', () => {
    const submission = makeSubmission({
      id: 'hws-g',
      status: 'evaluated',
      evaluation: makeEvaluation({ outcome: 'confirmed_error', evaluatedAt: AT }),
      attempts: [
        makeAttempt({ check: makeCheck({ passed: true }), submittedAt: AT_LATER }),
      ],
    });
    render(<ProgressPanel submission={submission} />);

    expect(screen.getByTestId('progress-direction').textContent).toContain('improved');
    expect(screen.getByTestId('progress-statement').textContent).toContain(
      'not proof of lasting mastery'
    );
    expect(screen.getByTestId('progress-caveat').textContent).toContain(PROGRESS_CAVEAT);
    expect(screen.getByTestId('progress-timeline')).toBeTruthy();
    expect(screen.getByTestId('timeline-evaluated')).toBeTruthy();
    expect(screen.getByTestId('timeline-practiced')).toBeTruthy();
  });

  it('states what is missing instead of guessing when evidence is thin', () => {
    const submission = makeSubmission({
      id: 'hws-g',
      evaluation: makeEvaluation({ outcome: 'confirmed_error', evaluatedAt: AT }),
    });
    render(<ProgressPanel submission={submission} />);

    expect(screen.getByTestId('progress-direction').textContent).toContain('not enough evidence');
    expect(screen.getByTestId('progress-statement').textContent).toContain('no later checked answer');
    expect(screen.getByTestId('progress-caveat')).toBeTruthy();
  });
});
