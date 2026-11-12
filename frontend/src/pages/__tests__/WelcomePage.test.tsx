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
