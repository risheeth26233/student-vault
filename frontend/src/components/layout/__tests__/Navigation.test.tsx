// @vitest-environment jsdom
// Test K — navigation rules: the mobile bottom nav stays exactly the original
// five items (Practice must NOT join it), while the tablet drawer and desktop
// sidebar both gain the Practice entry and navigate to /handwriting.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    isAuthenticated: false,
    isLoaded: true,
    signOut: vi.fn(),
    signIn: vi.fn(),
    setProfile: vi.fn(),
  }),
}));

import { MobileNavigation } from '../MobileNavigation';
import { Sidebar } from '../Sidebar';

function setInnerWidth(value: number): void {
  Object.defineProperty(window, 'innerWidth', { value, writable: true, configurable: true });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderNav() {
  return render(
    <MemoryRouter initialEntries={['/vault']}>
      <LocationProbe />
      <MobileNavigation />
      <Sidebar />
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  setInnerWidth(500);
});

afterEach(cleanup);

describe('navigation entries', () => {
  it('keeps the mobile bottom nav at exactly five items — no Practice there', () => {
    setInnerWidth(500);
    renderNav();

    const bottomNav = screen.getByLabelText('Primary navigation');
    const labels = within(bottomNav)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    expect(labels).toEqual(['Vault', 'Attendance', 'YouTube', 'Search', 'AI']);
    expect(within(bottomNav).queryByRole('button', { name: 'Practice' })).toBeNull();
  });

  it('adds Practice to the tablet drawer and navigates to /handwriting', async () => {
    setInnerWidth(900);
    renderNav();

    const drawer = screen.getByLabelText('Navigation drawer');
    expect(drawer.getAttribute('aria-hidden')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(drawer.getAttribute('aria-hidden')).toBe('false');
    expect(within(drawer).getByRole('button', { name: 'Practice' })).toBeTruthy();

    fireEvent.click(within(drawer).getByRole('button', { name: 'Practice' }));
    await waitFor(() =>
      expect(screen.getByTestId('location-probe').textContent).toContain('/handwriting')
    );
  });

  it('adds Practice to the desktop sidebar and navigates to /handwriting', async () => {
    setInnerWidth(1280);
    renderNav();

    // Desktop hides MobileNavigation entirely.
    expect(screen.queryByLabelText('Primary navigation')).toBeNull();

    const practiceButton = screen.getAllByRole('button', { name: 'Practice' })[0];
    fireEvent.click(practiceButton);
    await waitFor(() =>
      expect(screen.getByTestId('location-probe').textContent).toContain('/handwriting')
    );
  });

  it('renders nothing for MobileNavigation on desktop widths', () => {
    setInnerWidth(1440);
    const { container } = render(
      <MemoryRouter>
        <MobileNavigation />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });
});
