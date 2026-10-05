// Shared notification context — kept separate from the provider so the module
// exports components only (fast-refresh friendly).

import { createContext, useContext } from 'react';
import type { AppNotification } from '../../services/notificationStore';
import type { NotificationInput } from './notificationUtils';

export interface NotifyOptions {
  /** Suppress repeats even after the user dismisses or clears the item. */
  suppress?: boolean;
}

export interface NotificationContextType {
  notifications: AppNotification[];
  unread: number;
  notify: (input: NotificationInput, options?: NotifyOptions) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

export const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
