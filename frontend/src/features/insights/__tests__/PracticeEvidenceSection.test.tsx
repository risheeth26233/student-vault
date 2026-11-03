// @vitest-environment jsdom
// Test N (UI) — the Learning Insights integration: handwritten practice
// evidence appears as labelled, honest cards and stays invisible when there
// is nothing to show. The submissions query is mocked at the hook boundary.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockQuery = vi.hoisted(() => ({
  current: {
    isPending: false,
    isError: false,
    data: [] as unknown[],
  },
}));

vi.mock('../../../hooks/useHandwriting', () => ({
  useHandwritingSubmissions: () => mockQuery.current,
}));

import { PracticeEvidenceSection } from '../PracticeEvidenceSection';
import type { HandwritingSubmission } from '../../handwriting/handwritingTypes';
import {
  AT,
  AT_LATER,
  makeAttempt,
  makeCheck,
  makeEvaluation,
  makeSubmission,
} from '../../handwriting/__tests__/fixtures';

function renderSection() {
  return render(
    <MemoryRouter>
      <PracticeEvidenceSection />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockQuery.current = { isPending: false, isError: false, data: [] };
});

afterEach(cleanup);

describe('PracticeEvidenceSection', () => {
  it('stays hidden while records are loading', () => {
    mockQuery.current = { isPending: true, isError: false, data: [] };
    const { container } = renderSection();
    expect(container.firstChild).toBeNull();
  });

  it('hides itself when there are no practice records', () => {
    const { container } = renderSection();
    expect(container.firstChild).toBeNull();
  });

  it('hides submissions that have no evaluation or attempt evidence', () => {
    mockQuery.current = {
      isPending: false,
      isError: false,
      data: [makeSubmission({ id: 'hws-draft' })],
    };
    const { container } = renderSection();
    expect(container.firstChild).toBeNull();
  });

  it('shows an honest read error without breaking the page', () => {
    mockQuery.current = { isPending: false, isError: true, data: [] };
    renderSection();
    expect(screen.getByTestId('practice-evidence-error').textContent).toContain(
      'could not be read from this device'
    );
  });

  it('renders evidence cards linking back to the workflow', () => {
    const submission: HandwritingSubmission = makeSubmission({
      id: 'hws-a',
      subject: 'Biology',
      topicTitle: 'Photosynthesis',
      status: 'evaluated',
      evaluation: makeEvaluation({ outcome: 'confirmed_error', evaluatedAt: AT }),
      attempts: [
        makeAttempt({ check: makeCheck({ passed: true, coverage: 0.8 }), submittedAt: AT_LATER }),
      ],
    });
    mockQuery.current = { isPending: false, isError: false, data: [submission] };
    renderSection();

    expect(screen.getByTestId('practice-evidence-section')).toBeTruthy();
    expect(screen.getByTestId('practice-evidence-hws-a').textContent).toContain('Photosynthesis');
    expect(screen.getByTestId('practice-evidence-hws-a').textContent).toMatch(/Confirmed error/);
    expect(screen.getByTestId('practice-progress-hws-a').textContent).toContain('observations');
    expect(screen.getByRole('link', { name: /Open handwritten practice/ }).getAttribute('href')).toBe('/handwriting');
  });
});
