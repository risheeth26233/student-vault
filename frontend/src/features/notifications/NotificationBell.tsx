// Notification centre bell — unread badge + dropdown panel.
// Phase 1: local notifications only (see NotificationProvider).

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle,
  Info,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNotifications } from './notificationContext';
import { formatWhen } from './notificationUtils';
import type { AppNotification, NotificationKind } from '../../services/notificationStore';

const KIND_ICONS: Record<NotificationKind, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

const KIND_COLORS: Record<NotificationKind, string> = {
  info: 'text-info-strong bg-info-soft',
  success: 'text-success-strong bg-success-soft',
  warning: 'text-warning-strong bg-warning-soft',
  error: 'text-danger-strong bg-danger-soft',
};

function NotificationRow({
  notification,
  onOpen,
  onDismiss,
}: {
  notification: AppNotification;
  onOpen: (item: AppNotification) => void;
  onDismiss: (id: string) => void;
}) {
  const Icon = KIND_ICONS[notification.kind];
  return (
    <li className="group relative" data-testid="notification-item" data-notification-key={notification.key}>
      <button
        type="button"
        onClick={() => onOpen(notification)}
        className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        data-testid="notification-open"
      >
        <span
          className={cn(
            'mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
            KIND_COLORS[notification.kind]
          )}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span
              className={cn(
                'truncate text-sm',
                notification.read ? 'font-medium text-ink-muted' : 'font-semibold text-ink'
              )}
            >
              {notification.title}
            </span>
            {!notification.read && (
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full bg-coral-500"
                aria-label="Unread"
                data-testid="notification-unread-dot"
              />
            )}
          </span>
          {notification.message && (
            <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
              {notification.message}
            </span>
          )}
          <span className="mt-1 block text-[11px] text-ink-subtle">{formatWhen(notification.createdAt)}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => onDismiss(notification.id)}
        className="absolute right-2 top-2 rounded p-1 text-ink-subtle opacity-0 transition-opacity hover:bg-black/5 hover:text-ink focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 group-hover:opacity-100"
        aria-label={`Dismiss ${notification.title}`}
        data-testid="notification-dismiss"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </li>
  );
}

export function NotificationBell() {
  const { notifications, unread, markRead, markAllRead, dismiss, clearAll } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [open]);

  const handleOpen = (item: AppNotification) => {
    markRead(item.id);
    setOpen(false);
    if (item.href) navigate(item.href);
  };

  return (
    <div ref={containerRef} className="relative flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="sv-notification-trigger relative flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-teal-50 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-controls="notifications-panel"
        aria-expanded={open}
        data-testid="notifications-bell"
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        {unread > 0 && (
          <span
            key={`notifications-badge-${unread}`}
            className="sv-notification-badge absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-bold text-white ring-2 ring-surface"
            data-testid="notifications-badge"
            aria-hidden="true"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          id="notifications-panel"
          role="region"
          aria-label="Notifications"
          className="sv-notification-panel absolute right-0 top-full z-[var(--z-popover)] mt-2 w-[21rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface shadow-3"
          data-testid="notifications-panel"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={markAllRead}
                disabled={unread === 0}
                className="rounded px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                data-testid="notifications-mark-all"
              >
                Mark all read
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={notifications.length === 0}
                className="rounded px-2 py-1 text-xs font-medium text-ink-muted hover:bg-gray-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                data-testid="notifications-clear"
              >
                Clear
              </button>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center" data-testid="notifications-empty">
              <Bell className="mx-auto mb-2 h-8 w-8 text-border" aria-hidden="true" />
              <p className="text-sm font-medium text-ink">You're all caught up</p>
              <p className="mt-1 text-xs text-ink-muted">
                Reminders about assignments, exams and sync appear here.
              </p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto p-2" data-testid="notifications-list">
              {notifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onOpen={handleOpen}
                  onDismiss={dismiss}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
