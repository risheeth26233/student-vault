// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { initClerk, topicsApi } from './api';

afterEach(() => { delete window.Clerk; localStorage.clear(); vi.unstubAllGlobals(); });
it('loads Clerk with its publishable-key options and keeps tokens out of localStorage', async () => {
  const load = vi.fn().mockResolvedValue(undefined);
  const getToken = vi.fn().mockResolvedValue('ephemeral-token');
  const session = { getToken };
  window.Clerk = {
    session, user: null, load,
    addListener: callback => { callback({ session, user: null }); },
    openSignIn: vi.fn(), openSignUp: vi.fn(), signOut: vi.fn(),
  };
  localStorage.setItem('clerk_session_token', 'obsolete-token');
  await initClerk('pk_test_synthetic');
  expect(load).toHaveBeenCalledWith({ publishableKey: 'pk_test_synthetic' });
  expect(localStorage.getItem('clerk_session_token')).toBeNull();
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ topics: [] }) });
  vi.stubGlobal('fetch', fetch);
  await topicsApi.list();
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer ephemeral-token');
});
it('never authenticates an API request with an obsolete cached token', async () => {
  localStorage.setItem('clerk_session_token', 'obsolete-token');
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ topics: [] }) });
  vi.stubGlobal('fetch', fetch);
  await topicsApi.list();
  expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
});
