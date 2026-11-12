// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock('../../hooks/useYouTube', () => ({
  useYouTubeStatus: () => ({ isPending: false, isError: false, isSuccess: true, data: { configured: true } }),
  useYouTubeSearch: () => ({ mutate: mocks.mutate, isPending: false, isError: false, isSuccess: false, data: undefined }),
}));

import { YouTubePage } from '../YouTubePage';

afterEach(cleanup);
beforeEach(() => mocks.mutate.mockClear());

function renderYouTubePage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/youtube" element={<YouTubePage />} /></Routes>
    </MemoryRouter>,
  );
}

describe('YouTubePage', () => {
  it('runs a related-video search from a topic deep link', async () => {
    renderYouTubePage('/youtube?query=Biology%20Photosynthesis');

    expect((screen.getByTestId('youtube-search-input') as HTMLInputElement).value).toBe('Biology Photosynthesis');
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({
      query: 'Biology Photosynthesis', maxResults: 10, order: 'relevance',
    }));
    const directSearch = screen.getByRole('link', { name: /Search directly on YouTube/ });
    expect(new URL((directSearch as HTMLAnchorElement).href).searchParams.get('search_query')).toBe('Biology Photosynthesis');
  });

  it('keeps the ordinary search form working without a topic deep link', async () => {
    renderYouTubePage('/youtube');
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(screen.getByTestId('youtube-initial')).toBeTruthy();
  });
});
