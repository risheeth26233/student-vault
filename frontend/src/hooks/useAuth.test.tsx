// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './useAuth';
import { loadProfile, saveProfile } from '../services/storage';

const clerk = vi.hoisted(() => ({ hang: false }));
vi.mock('../services/api', () => ({
  initClerk: () => clerk.hang ? new Promise(() => {}) : Promise.resolve().then(() => {
    window.dispatchEvent(new CustomEvent('clerk:auth-change', {
      detail: { session: null, user: null },
    }));
  }),
  getCurrentUser: () => null,
}));

function SessionStatus() {
  const { isLoading, profile, user } = useAuth();
  if (isLoading) return <p>Loading</p>;
  return <p>{user ? 'Signed in' : profile?.name ?? 'Signed out'}</p>;
}

function GuestEntry() {
  const { setProfile } = useAuth();
  return <button onClick={() => setProfile({ name: 'Guest', guest: true })}>Start as guest</button>;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  clerk.hang = false;
});

it.each([
  [{ name: 'Guest', guest: true }, 'Guest'],
  [{ name: 'Stale account' }, 'Signed out'],
] as const)('handles a saved profile when Clerk reports no session', async (profile, label) => {
  saveProfile(profile);
  render(<AuthProvider publishableKey="pk_test_fixture"><SessionStatus /></AuthProvider>);
  expect(await screen.findByText(label)).toBeTruthy();
  expect(loadProfile()).toEqual('guest' in profile ? profile : null);
});

it('opens a local guest session while Clerk is still loading', async () => {
  clerk.hang = true;
  render(<AuthProvider publishableKey="pk_test_fixture"><><SessionStatus /><GuestEntry /></></AuthProvider>);
  expect(screen.getByText('Loading')).toBeTruthy();
  screen.getByRole('button', { name: 'Start as guest' }).click();
  expect(await screen.findByText('Guest')).toBeTruthy();
  expect(loadProfile()).toEqual({ name: 'Guest', guest: true });
});
