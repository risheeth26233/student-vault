// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { NotificationBell } from './NotificationBell';

const notificationState = vi.hoisted(() => ({
  notifications: [{ id: 'n1', key: 'exam', kind: 'warning' as const, title: 'Exam soon', message: 'Revise today', createdAt: new Date().toISOString(), read: false, source: 'test' }],
  unread: 1, markRead: vi.fn(), markAllRead: vi.fn(), dismiss: vi.fn(), clearAll: vi.fn(),
}));
vi.mock('./notificationContext', () => ({ useNotifications: () => notificationState }));

afterEach(() => { cleanup(); });

it('announces unread count and opens a keyboard-accessible notification panel', () => {
  render(<MemoryRouter><NotificationBell /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));
  expect(screen.getByRole('region', { name: 'Notifications' })).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mark all read' }));
});

it('closes the panel with Escape and returns focus to the bell', () => {
  render(<MemoryRouter><NotificationBell /></MemoryRouter>);
  const bell = screen.getByRole('button', { name: 'Notifications, 1 unread' });
  fireEvent.click(bell);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('region', { name: 'Notifications' })).toBeNull();
  expect(document.activeElement).toBe(bell);
});
