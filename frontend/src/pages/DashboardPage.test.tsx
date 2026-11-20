// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from './DashboardPage';

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true, isLoading: false, profile: { name: 'Guest', guest: true } }) }));
vi.mock('../hooks/useTopics', () => ({ useTopics: () => ({ data: { topics: [] }, isLoading: false }) }));
vi.mock('../hooks/useAttendance', () => ({ useAttendanceStats: () => ({ isLoading: false }) }));
vi.mock('../hooks/useResources', () => ({ useResources: () => ({ isLoading: true }) }));
vi.mock('../hooks/useAssignments', () => ({ useAssignments: () => ({ data: { assignments: [] } }), sortAssignmentsByDueDate: (items: unknown[]) => items }));
vi.mock('../hooks/useAssessments', () => ({ useAssessments: () => ({ data: { assessments: [] } }), sortAssessmentsByDate: (items: unknown[]) => items }));
vi.mock('../hooks/useHandwriting', () => ({ useHandwritingSubmissions: () => ({ data: [{ id: 'practice-1', topicId: 'topic-1', topicTitle: 'Cell division', subject: 'Biology', status: 'evaluated', attempts: [{ id: 'attempt-1' }], updatedAt: '2026-11-20T00:00:00.000Z' }] }) }));
vi.mock('../gurugraph', () => ({ useGuruGraphIntelligence: () => ({ snapshot: null, isLoading: false, error: null }) }));
vi.mock('../features/insights/insightsViewModel', () => ({ buildInsightsViewModel: () => ({ hasAnyRecords: false, topicsWithEvidence: 0, potentialGapCount: 0, signals: 0, topicMastery: [] }), formatScorePercent: (score: number) => `${Math.round(score * 100)}%` }));
afterEach(cleanup);

it('keeps guest navigation and study actions usable while resources are loading', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><DashboardPage /></MemoryRouter></QueryClientProvider>);
  expect(screen.getByRole('heading', { name: 'Welcome back, Guest.' })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Your notes/ }).getAttribute('href')).toBe('/notes');
  expect(screen.getByRole('link', { name: 'Create your first note' }).getAttribute('href')).toBe('/notes');
  expect(screen.getByRole('status').textContent).toMatch(/Loading your study records/);
  expect(screen.getByRole('link', { name: /Cell division/ }).getAttribute('href')).toBe('/handwriting?topic=topic-1');
  expect(screen.getByRole('heading', { name: 'Teacher follow-up' })).toBeTruthy();
});
