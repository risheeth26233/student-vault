// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true, isLoading: false, profile: { name: 'Guest', guest: true } }) }));
vi.mock('../hooks/useTopics', () => ({ useTopics: () => ({ data: { topics: [] }, isLoading: false }) }));
vi.mock('../hooks/useAttendance', () => ({ useAttendanceStats: () => ({ isLoading: false }) }));
vi.mock('../hooks/useResources', () => ({ useResources: () => ({ isLoading: true }) }));
vi.mock('../hooks/useAssignments', () => ({ useAssignments: () => ({ data: { assignments: [] } }), sortAssignmentsByDueDate: (items: unknown[]) => items }));
vi.mock('../hooks/useAssessments', () => ({ useAssessments: () => ({ data: { assessments: [] } }), sortAssessmentsByDate: (items: unknown[]) => items }));
afterEach(cleanup);

it('keeps guest navigation and study actions usable while resources are loading', () => {
  render(<MemoryRouter><DashboardPage /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Let’s make a little progress.' })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Your notes/ }).getAttribute('href')).toBe('/notes');
  expect(screen.getByRole('link', { name: 'Create your first note' }).getAttribute('href')).toBe('/notes');
  expect(screen.getByRole('status').textContent).toMatch(/Loading your study records/);
});
