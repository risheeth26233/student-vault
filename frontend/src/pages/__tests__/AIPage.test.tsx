// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  providers: vi.fn(),
  chat: vi.fn(),
  study: vi.fn(),
  getTopic: vi.fn(),
  saveNotes: vi.fn(),
  topics: [] as Array<{ id: string; subject: string; title: string; notes: string }>,
  resources: [] as Array<{ id: string; topicId: string; name: string; mimeType: string; downloadUrl: string | null; data: string | null }>,
}));
vi.mock('../../services/api', () => ({ aiApi: { providers: mocks.providers, chat: mocks.chat, study: mocks.study } }));
vi.mock('../../hooks/useTopics', () => ({
  useAllTopics: () => ({ data: { topics: mocks.topics } }),
  useSaveTopicNotes: () => ({ mutateAsync: mocks.saveNotes, isPending: false }),
}));
vi.mock('../../services/topicStore', () => ({ getTopic: mocks.getTopic }));
vi.mock('../../hooks/useResources', () => ({ useResources: () => ({ data: { resources: mocks.resources }, isPending: false }) }));

import { AIPage } from '../AIPage';

afterEach(() => { cleanup(); vi.clearAllMocks(); });
beforeEach(() => { mocks.topics = []; mocks.resources = []; });

describe('AIPage', () => {
  it('shows configured providers and sends only entered conversation messages', async () => {
    mocks.providers.mockResolvedValue({ providers: ['openai'], default: 'openai' });
    mocks.chat.mockResolvedValue({ content: 'Try a small example first.' });
    render(<AIPage />);
    await screen.findByText('Available providers: openai');
    fireEvent.change(screen.getByLabelText('Your study question'), { target: { value: 'Explain recursion' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
    await screen.findByText('Try a small example first.');
    expect(mocks.chat).toHaveBeenCalledWith(expect.objectContaining({ messages: expect.arrayContaining([expect.objectContaining({ role: 'user', content: 'Explain recursion' })]) }));
    expect(mocks.chat.mock.calls[0][0].messages.some((message: { content: string }) => message.content.includes('Student notes'))).toBe(false);
  });

  it('adds a requested AI answer without replacing the latest notes', async () => {
    mocks.topics = [{ id: 'topic-1', subject: 'Math', title: 'Fractions', notes: 'Old snapshot' }];
    mocks.getTopic.mockResolvedValue({ notes: 'Existing notes' });
    mocks.saveNotes.mockResolvedValue({});
    mocks.providers.mockResolvedValue({ providers: ['openai'] });
    mocks.chat.mockResolvedValue({ content: 'Use a common denominator.' });
    render(<AIPage />);
    await screen.findByText('Available providers: openai');
    fireEvent.change(screen.getByLabelText('Study topic'), { target: { value: 'topic-1' } });
    fireEvent.change(screen.getByLabelText('Your study question'), { target: { value: 'How do I add fractions?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add to notes for Fractions' }));
    await screen.findByText('Added to your notes for Fractions.');
    expect(mocks.saveNotes).toHaveBeenCalledWith({
      id: 'topic-1',
      notes: 'Existing notes\n\n---\n\nAI study notes (review before relying)\n\nHow do I add fractions?\n\nUse a common denominator.',
    });
  });

  it('handles provider outage and keeps the typed question available for retry', async () => {
    mocks.providers.mockRejectedValue(new Error('Provider service unavailable'));
    mocks.chat.mockRejectedValue(new Error('Request timed out'));
    render(<AIPage />);
    await screen.findByText('Provider availability could not be checked.');
    const input = screen.getByLabelText('Your study question');
    fireEvent.change(input, { target: { value: 'Help me review vectors' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/timed out/i));
    expect((input as HTMLTextAreaElement).value).toBe('Help me review vectors');
  });

  it('explains the unconfigured-provider state', async () => {
    mocks.providers.mockResolvedValue({ providers: [], default: null });
    render(<AIPage />);
    expect((await screen.findByRole('status')).textContent).toMatch(/no AI chat provider is configured/i);
    expect((screen.getByRole('button', { name: 'Send question' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Your study question'), { target: { value: 'Help me make a revision plan' } });
    expect((screen.getByRole('button', { name: 'Send question' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
    expect(await screen.findByText(/Offline study scaffold/)).toBeTruthy();
    expect(mocks.chat).not.toHaveBeenCalled();
  });

  it('retrieves selected PDF passages locally by default and shows the retrieved evidence', async () => {
    mocks.providers.mockResolvedValue({ providers: ['openai'], default: 'openai' });
    mocks.topics = [{ id: 'topic-1', subject: 'Biology', title: 'Photosynthesis', notes: '' }];
    mocks.resources = [{ id: 'res-1', topicId: 'topic-1', name: 'Biology.pdf', mimeType: 'application/pdf', downloadUrl: null, data: 'data:application/pdf;base64,JVBERi0=' }];
    mocks.study.mockResolvedValue({ mode: 'local_excerpts', answer: 'Local document excerpts', sources: [{ resourceId: 'res-1', title: 'Biology.pdf', page: 2, text: 'Chlorophyll absorbs light.' }], sourceErrors: [], extractionProviders: [], provider: null, providerAttempted: false, notice: 'The excerpts stayed local.' });
    render(<AIPage />);
    await screen.findByText('Available providers: openai');
    fireEvent.change(screen.getByLabelText('Study topic'), { target: { value: 'topic-1' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Biology\.pdf/ }));
    fireEvent.change(screen.getByLabelText('Your study question'), { target: { value: 'What does chlorophyll do?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
    expect(await screen.findByText('Retrieved passages')).toBeTruthy();
    expect(screen.getByText('Chlorophyll absorbs light.')).toBeTruthy();
    expect(mocks.study).toHaveBeenCalledWith({ question: 'What does chlorophyll do?', resourceIds: ['res-1'], shareWithProvider: false });
    expect(mocks.chat).not.toHaveBeenCalled();
  });

  it('sends selected-source retrieval only after explicit external-sharing consent', async () => {
    mocks.providers.mockResolvedValue({ providers: ['openai'], default: 'openai' });
    mocks.topics = [{ id: 'topic-1', subject: 'Biology', title: 'Photosynthesis', notes: '' }];
    mocks.resources = [{ id: 'res-1', topicId: 'topic-1', name: 'Biology.pdf', mimeType: 'application/pdf', downloadUrl: null, data: 'data:application/pdf;base64,JVBERi0=' }];
    mocks.study.mockResolvedValue({ mode: 'provider_grounded', answer: 'From your documents: chlorophyll absorbs light.', sources: [{ resourceId: 'res-1', title: 'Biology.pdf', page: 2, text: 'Chlorophyll absorbs light.' }], sourceErrors: [], extractionProviders: [], provider: 'openai', providerAttempted: true, notice: 'Retrieved excerpts were sent to openai.' });
    render(<AIPage />);
    await screen.findByText('Available providers: openai');
    fireEvent.change(screen.getByLabelText('Study topic'), { target: { value: 'topic-1' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Biology\.pdf/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Allow selected sources to be sent/ }));
    fireEvent.change(screen.getByLabelText('Your study question'), { target: { value: 'What does chlorophyll do?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
    expect(await screen.findByText(/From your documents: chlorophyll absorbs light/)).toBeTruthy();
    expect(mocks.study).toHaveBeenCalledWith({ question: 'What does chlorophyll do?', resourceIds: ['res-1'], shareWithProvider: true });
    expect(mocks.chat).not.toHaveBeenCalled();
  });
});
