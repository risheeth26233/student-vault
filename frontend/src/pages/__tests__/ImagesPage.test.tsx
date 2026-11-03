// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
const state = vi.hoisted(() => ({ configured: false, mutate: vi.fn() }));
vi.mock('../../hooks/useImages', () => ({
  useImagesStatus: () => ({ data: { configured: state.configured } }),
  useGenerateImage: () => ({ mutate: state.mutate }),
}));
import { ImagesPage } from '../ImagesPage';
afterEach(() => { cleanup(); state.configured = false; state.mutate.mockClear(); });
it('shows provider-unavailable state and prevents generation', () => {
  render(<ImagesPage />);
  expect(screen.getByText(/generation is unavailable/)).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Generate image' }) as HTMLButtonElement).disabled).toBe(true);
});
it('requires consent before sending a prompt to generation', () => {
  state.configured = true;
  render(<ImagesPage />);
  fireEvent.change(screen.getByLabelText('Image description'), { target: { value: 'Diagram of a plant cell' } });
  const button = screen.getByRole('button', { name: 'Generate image' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(state.mutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(button);
  expect(state.mutate).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'Diagram of a plant cell' }));
});
