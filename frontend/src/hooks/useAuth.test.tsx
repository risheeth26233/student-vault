// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './useAuth';
import { loadProfile, saveProfile } from '../services/storage';

vi.mock('../services/api', () => ({
  initClerk: async () => {
    window.dispatchEvent(new CustomEvent('clerk:auth-change', {
      detail: { session: null, user: null },
    }));
  },
  getCurrentUser: () => null,
}));

function SessionStatus() {
  const { isLoading, profile, user } = useAuth();
  if (isLoading) return <p>Loading</p>;
  return <p>{user ? 'Signed in' : profile?.name ?? 'Signed out'}</p>;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
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
