// @vitest-environment jsdom
// Tests A + B — upload validation in the UI: multi-page selection, type/size
// rejection reasons (dismissible, never silent), retry queue for failed
// uploads, previews from resource storage, two-step page removal, and topic
// deep-link preselection.

import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../services/resourceStore', () => ({
  addDocument: vi.fn(),
  getResource: vi.fn(),
  getDocumentUrl: vi.fn(() => 'data:image/png;base64,PREVIEW'),
  deleteResource: vi.fn(async () => undefined),
}));

import { SubmissionComposer } from '../components/SubmissionComposer';
import { useHandwritingSubmissions } from '../../../hooks/useHandwriting';
import {
  clearHandwritingData,
  loadSubmissions,
  saveSubmissions,
} from '../../../services/handwritingStore';
import { addDocument, getResource } from '../../../services/resourceStore';
import type { Resource, Topic } from '../../../types/api';
import { makePage, makeSubmission } from './fixtures';

const TOPICS = [
  { id: 'topic-1', subject: 'Biology', title: 'Photosynthesis', notes: '' },
  { id: 'topic-2', subject: 'Mathematics', title: 'Quadratics', notes: '' },
] as unknown as Topic[];

function Harness({
  initialTopicId,
  initialActiveId,
}: {
  initialTopicId?: string;
  initialActiveId?: string | null;
}) {
  const query = useHandwritingSubmissions();
  const [activeId, setActiveId] = useState<string | null>(initialActiveId ?? null);
  const active = (query.data ?? []).find((submission) => submission.id === activeId) ?? null;
  return (
    <SubmissionComposer
      topics={TOPICS}
      submission={active}
      initialTopicId={initialTopicId}
      creationToken={0}
      onCreated={(submission) => setActiveId(submission.id)}
    />
  );
}

function renderHarness(props: Parameters<typeof Harness>[0] = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness {...props} />
    </QueryClientProvider>
  );
}

function fakeFile(name: string, type: string, size = 512): File {
  const created = new File(['x'], name, { type });
  Object.defineProperty(created, 'size', { value: size });
  return created;
}

function setFiles(files: File[]): void {
  fireEvent.change(screen.getByTestId('composer-file-input'), { target: { files } });
}

beforeEach(() => {
  clearHandwritingData();
  vi.clearAllMocks();
  vi.mocked(addDocument).mockImplementation(
    async (file: File) => ({ id: `res-${file.name}` }) as unknown as Resource
  );
  vi.mocked(getResource).mockResolvedValue({ data: 'data:image/png;base64,AA' } as unknown as Resource);
});

afterEach(cleanup);

describe('SubmissionComposer', () => {
  it('requires a topic before pages can be added and preselects deep-linked topics', () => {
    renderHarness();
    expect((screen.getByTestId('composer-add-pages') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByTestId('composer-subject'), { target: { value: 'Mathematics' } });
    const topicSelect = screen.getByTestId('composer-topic') as HTMLSelectElement;
    expect(topicSelect.value).toBe('');
    fireEvent.change(topicSelect, { target: { value: 'topic-2' } });
    expect((screen.getByTestId('composer-add-pages') as HTMLButtonElement).disabled).toBe(false);

    cleanup();
    renderHarness({ initialTopicId: 'topic-2' });
    expect((screen.getByTestId('composer-topic') as HTMLSelectElement).value).toBe('topic-2');
    expect((screen.getByTestId('composer-add-pages') as HTMLButtonElement).disabled).toBe(false);
  });

  it('uploads multiple pages, creates the submission and previews every page', async () => {
    renderHarness();
    fireEvent.change(screen.getByTestId('composer-topic'), { target: { value: 'topic-1' } });
    setFiles([fakeFile('p1.jpg', 'image/jpeg'), fakeFile('p2.png', 'image/png')]);

    await waitFor(() => expect(screen.getByTestId('page-preview-1')).toBeTruthy());
    expect(screen.getByTestId('page-preview-2')).toBeTruthy();
    expect(screen.getByAltText('Page 1 of p1.jpg').getAttribute('src')).toBe('data:image/png;base64,PREVIEW');
    expect(screen.getByTestId('composer-page-count').textContent).toContain('2/8');
    expect(addDocument).toHaveBeenCalledTimes(2);

    const stored = loadSubmissions();
    expect(stored).toHaveLength(1);
    expect(stored[0].topicId).toBe('topic-1');
    expect(stored[0].subject).toBe('Biology');
    expect(stored[0].pages.map((page) => page.extraction.status)).toEqual(['pending', 'pending']);
  });

  it('lists rejected files with dismissible reasons and creates nothing for them', () => {
    renderHarness();
    fireEvent.change(screen.getByTestId('composer-topic'), { target: { value: 'topic-1' } });
    setFiles([
      fakeFile('notes.pdf', 'application/pdf'),
      fakeFile('huge.png', 'image/png', 9 * 1024 * 1024),
    ]);

    const rejections = screen.getByTestId('composer-rejections');
    expect(within(rejections).getAllByTestId('rejection-item')).toHaveLength(2);
    expect(rejections.textContent).toContain('application/pdf');
    expect(rejections.textContent).toContain('JPEG, PNG or WebP');
    expect(rejections.textContent).toContain('8MB');
    expect(addDocument).not.toHaveBeenCalled();
    expect(loadSubmissions()).toHaveLength(0);

    fireEvent.click(screen.getByTestId('composer-rejections-dismiss'));
    expect(screen.queryByTestId('composer-rejections')).toBeNull();
  });

  it('keeps a failed upload in a retry queue instead of discarding it', async () => {
    vi.mocked(addDocument)
      .mockRejectedValueOnce(new Error('Network down — the file was not saved.'))
      .mockImplementation(
        async (file: File) => ({ id: `res-${file.name}` }) as unknown as Resource
      );
    renderHarness();
    fireEvent.change(screen.getByTestId('composer-topic'), { target: { value: 'topic-1' } });
    setFiles([fakeFile('p1.jpg', 'image/jpeg')]);

    await waitFor(() => expect(screen.getByTestId('composer-pending')).toBeTruthy());
    expect(screen.getByTestId('composer-pending').textContent).toContain('Network down');
    expect(screen.queryByTestId('page-preview-1')).toBeNull();
    expect(loadSubmissions()).toHaveLength(0); // failed upload created no phantom page

    fireEvent.click(screen.getByTestId('retry-p1.jpg#0'));
    await waitFor(() => expect(screen.getByTestId('page-preview-1')).toBeTruthy());
    expect(screen.queryByTestId('composer-pending')).toBeNull();
    expect(addDocument).toHaveBeenCalledTimes(2);
    expect(loadSubmissions()[0].pages).toHaveLength(1);
  });

  it('requires a two-step confirmation before removing a page', async () => {
    saveSubmissions([
      makeSubmission({ id: 'hws-r', pages: [makePage({ resourceId: 'res-1', page: 1 })] }),
    ]);
    renderHarness({ initialActiveId: 'hws-r' });
    await screen.findByTestId('page-preview-1');

    fireEvent.click(screen.getByTestId('remove-page-1'));
    expect(screen.getByText(/Remove page 1\? The image is deleted too\./)).toBeTruthy();
    expect(loadSubmissions()[0].pages).toHaveLength(1); // still there until confirmed

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(loadSubmissions()[0].pages).toHaveLength(0));
  });

  it('shows an honest empty state for a submission without pages', async () => {
    saveSubmissions([makeSubmission({ id: 'hws-e', pages: [] })]);
    renderHarness({ initialActiveId: 'hws-e' });
    await screen.findByTestId('composer-empty-upload');
    expect(screen.getByTestId('composer-page-count').textContent).toContain('0/8');
    expect(screen.getByTestId('submission-composer').textContent).toContain('stored on this device');
  });
});
