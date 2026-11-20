// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { WelcomePage } from '../WelcomePage';

const auth = vi.hoisted(() => ({ setProfile: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ ...auth, user: null, isAuthenticated: true, isLoading: true }),
}));

afterEach(cleanup);

it('opens the selected guest tool without redirecting to the dashboard', async () => {
  render(<MemoryRouter>
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/attendance" element={<h1>Attendance tool</h1>} />
      <Route path="/dashboard" element={<h1>Dashboard</h1>} />
    </Routes>
  </MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Attendance calculator/ }));
  expect(await screen.findByRole('heading', { name: 'Attendance tool' })).toBeTruthy();
  expect(auth.setProfile).toHaveBeenCalledWith({ name: 'Guest', guest: true });
});

it('explains the student and teacher journeys and keeps account actions visible', () => {
  render(<MemoryRouter><Routes><Route path="/" element={<WelcomePage />} /></Routes></MemoryRouter>);
  expect(screen.getByRole('heading', { name: /Your studies/ })).toBeTruthy();
  expect(screen.getByRole('heading', { name: /From a question to a next step/ })).toBeTruthy();
  expect(screen.getByRole('heading', { name: /Make room for the way you learn/ })).toBeTruthy();
  expect(screen.getByRole('heading', { name: /Turn shared evidence into follow-up/ })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Create a student account' })).toBeTruthy();
});
