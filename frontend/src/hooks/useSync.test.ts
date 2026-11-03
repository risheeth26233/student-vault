// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ push: vi.fn(), pull: vi.fn(), load: vi.fn(), save: vi.fn() }));
vi.mock('../services/api', () => ({ syncApi: { push: mocks.push, pull: mocks.pull }, importApi: {} }));
vi.mock('../services/storage', () => ({
  loadClientVersion: () => 0, saveClientVersion: vi.fn(), loadProfile: () => null,
  loadTopics: () => JSON.parse(localStorage.getItem('sv_topics') ?? '[]'),
  loadAttendanceSubjects: () => [], loadResourcesFromIDB: mocks.load, saveResourcesToIDB: mocks.save,
}));
import { performFullSync } from './useSync';
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mocks.load.mockResolvedValue(new Map()); mocks.save.mockResolvedValue(undefined); });
it('does not pull or replace local records when the server reports conflicts', async () => {
  localStorage.setItem('sv_topics', '[{"id":"local"}]');
  mocks.push.mockResolvedValue({ success: false, conflicts: [{ id: 'local' }] });
  await expect(performFullSync()).rejects.toThrow('conflicts');
  expect(mocks.pull).not.toHaveBeenCalled();
  expect(localStorage.getItem('sv_topics')).toContain('local');
});
it('preserves edits made while a pull is running', async () => {
  mocks.push.mockResolvedValue({ success: true, serverVersion: 1 });
  mocks.pull.mockImplementation(async () => { localStorage.setItem('sv_topics', '[{"id":"new-edit"}]'); return { topics: [], attendanceSubjects: [], resources: [], serverVersion: 2 }; });
  await expect(performFullSync()).rejects.toThrow('changed during sync');
  expect(localStorage.getItem('sv_topics')).toContain('new-edit');
});
it('performs real push then pull and retains inline resource bytes', async () => {
  const push = { success: true, serverVersion: 1 };
  mocks.push.mockResolvedValue(push);
  mocks.pull.mockResolvedValue({ profile: null, topics: [], attendanceSubjects: [], resources: [{ id: 'r', topicId: 't', name: 'image', mimeType: 'image/png', size: '8', data: 'inline-bytes', createdAt: '2026-11-03T00:00:00Z' }], serverVersion: 2 });
  const result = await performFullSync();
  expect(result.push).toBe(push);
  expect(mocks.save.mock.calls[0][0][0].data).toBe('inline-bytes');
});

it('keeps existing topic records when saving pulled files fails', async () => {
  localStorage.setItem('sv_topics', '[{"id":"local"}]');
  mocks.push.mockResolvedValue({ success: true, serverVersion: 1 });
  mocks.pull.mockResolvedValue({ profile: null, topics: [], attendanceSubjects: [], resources: [], serverVersion: 2 });
  mocks.save.mockRejectedValueOnce(new Error('Storage full'));
  await expect(performFullSync()).rejects.toThrow('Storage full');
  expect(localStorage.getItem('sv_topics')).toContain('local');
});
