// Notification data layer
// Local-first notification centre storage. Phase 1 keeps every notification on
// this device (localStorage) — there is no backend notification model yet, so
// this module is the single source of truth the later phases can move behind an
// API without touching the UI.

export type NotificationKind = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  /** Stable identity used to suppress duplicates (e.g. `assignment-overdue:<id>`). */
  key: string;
  kind: NotificationKind;
  title: string;
  message?: string;
  /** In-app deep link the notification opens. */
  href?: string;
  /** Feature that produced it: assignments | topics | system | sync | ... */
  source: string;
  createdAt: string;
  read: boolean;
}

export interface NotificationState {
  version: 1;
  items: AppNotification[];
  /** Keys that have already been raised automatically and must not repeat. */
  seen: string[];
}

const STORAGE_KEY = 'sv_notifications';
const MAX_ITEMS = 50;
const MAX_SEEN = 300;

const EMPTY_STATE: NotificationState = { version: 1, items: [], seen: [] };

function emptyState(): NotificationState {
  return { version: 1, items: [], seen: [] };
}

export function loadNotifications(): NotificationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyState();
    const candidate = parsed as Partial<NotificationState>;
    const items = Array.isArray(candidate.items) ? candidate.items.filter(isNotification) : [];
    const seen = Array.isArray(candidate.seen)
      ? candidate.seen.filter((entry): entry is string => typeof entry === 'string')
      : [];
    return { version: 1, items, seen };
  } catch {
    return EMPTY_STATE;
  }
}

function isNotification(value: unknown): value is AppNotification {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<AppNotification>;
  return typeof item.id === 'string' && typeof item.key === 'string' && typeof item.title === 'string';
}

export function saveNotifications(state: NotificationState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        items: state.items.slice(0, MAX_ITEMS),
        seen: state.seen.slice(0, MAX_SEEN),
      })
    );
  } catch (error) {
    console.error('Failed to save notifications:', error);
  }
}

export function clearNotificationStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures (private mode, quota, ...).
  }
}

export function createNotificationId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

/** Newer items first, capped at MAX_ITEMS. */
export function prependNotification(
  state: NotificationState,
  notification: AppNotification
): NotificationState {
  return {
    ...state,
    items: [notification, ...state.items.filter((item) => item.id !== notification.id)].slice(
      0,
      MAX_ITEMS
    ),
  };
}

export function rememberKey(state: NotificationState, key: string): NotificationState {
  if (state.seen.includes(key)) return state;
  return { ...state, seen: [key, ...state.seen].slice(0, MAX_SEEN) };
}

export function unreadCount(state: NotificationState): number {
  return state.items.filter((item) => !item.read).length;
}
