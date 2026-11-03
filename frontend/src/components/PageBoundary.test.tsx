// @vitest-environment jsdom
import { lazy } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PageBoundary } from './PageBoundary';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('shows a loading status while a page chunk is pending', () => {
  const Pending = lazy(() => new Promise<{ default: () => null }>(() => {}));
  render(<PageBoundary><Pending /></PageBoundary>);
  expect(screen.getByRole('status').textContent).toContain('Loading page');
});

it('provides recovery after failure and clears the error for a different route key', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  function Broken(): never { throw new Error('Chunk download failed'); }
  const view = render(<PageBoundary key="broken"><Broken /></PageBoundary>);
  expect(screen.getByRole('alert').textContent).toContain('could not load');
  expect(screen.getByRole('button', { name: 'Reload page' })).toBeTruthy();
  view.rerender(<PageBoundary key="working"><p>Working page</p></PageBoundary>);
  expect(screen.getByText('Working page')).toBeTruthy();
});
