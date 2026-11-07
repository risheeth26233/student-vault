// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { topicsApi } from './api';
import { saveProfile } from './storage';

afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });
it('routes guest records to local fallback without waiting for the cloud', async () => {
  saveProfile({ name: 'Guest', guest: true });
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  await expect(topicsApi.list()).rejects.toMatchObject({ status: 401, code: 'guest_local' });
  expect(fetch).not.toHaveBeenCalled();
});
