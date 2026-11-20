// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProfilePage } from './ProfilePage';

const mocks = vi.hoisted(() => ({ profileApi: { publicId: vi.fn() }, setProfile: vi.fn() }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user_private_clerk_id', firstName: 'Maya', emailAddresses: [{ emailAddress: 'maya@example.test' }] }, profile: { name: 'Maya' }, setProfile: mocks.setProfile, isAuthenticated: true }) }));
vi.mock('../services/api', () => ({ profileApi: mocks.profileApi }));

function renderProfile() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ProfilePage /></QueryClientProvider>);
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('loads a public Student-Vault ID without displaying the Clerk ID', async () => {
  mocks.profileApi.publicId.mockResolvedValue({ publicId: 'SV-2026-A7K92MZ' });
  renderProfile();
  expect(await screen.findByText('SV-2026-A7K92MZ')).toBeTruthy();
  expect(screen.queryByText('user_private_clerk_id')).toBeNull();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  fireEvent.click(screen.getByRole('button', { name: 'Copy Student-Vault ID' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('SV-2026-A7K92MZ'));
  expect(screen.getByText('Copied')).toBeTruthy();
});

it('offers a useful ID fallback when the account service is unavailable', async () => {
  mocks.profileApi.publicId.mockRejectedValue(new Error('unavailable'));
  renderProfile();
  expect(await screen.findByText('ID is temporarily unavailable.')).toBeTruthy();
  const retry = screen.getByRole('button', { name: /retry/i });
  retry.click();
  await waitFor(() => expect(mocks.profileApi.publicId).toHaveBeenCalledTimes(3));
});
