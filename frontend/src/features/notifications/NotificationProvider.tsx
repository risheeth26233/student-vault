// Notification centre provider
// Phase 1 foundation: local persistence + an extensible API (notify / read /
// dismiss) and a small set of descriptive sources derived from data the app
// already has. No push, no backend model — later phases can swap the store for
// an API without changing consumers.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  createNotificationId,
  loadNotifications,
  prependNotification,
  rememberKey,
  saveNotifications,
  unreadCount,
  type AppNotification,
  type NotificationState,
} from '../../services/notificationStore';
import {
  dueTodayAssignmentNotifications,
  lowScoreNotifications,
  offlineNotification,
  overdueAssignmentNotifications,
  upcomingExamNotifications,
  type NotificationInput,
} from './notificationUtils';
import {
  NotificationContext,
  useNotifications,
  type NotifyOptions,
} from './notificationContext';
import { getAssignmentsMode, listAssignments } from '../../services/assignmentStore';
import { getTopicsMode, listTopics } from '../../services/topicStore';
import { getAssessmentsMode, listAssessments } from '../../services/assessmentStore';
import { assignmentsKey } from '../../hooks/useAssignments';
import { topicsKey } from '../../hooks/useTopics';
import { assessmentsKey } from '../../hooks/useAssessments';
import { useAuth } from '../../hooks/useAuth';

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NotificationState>(() => loadNotifications());

  useEffect(() => {
    saveNotifications(state);
  }, [state]);

  const notify = useCallback((input: NotificationInput, options: NotifyOptions = {}) => {
    setState((current) => {
      if (current.items.some((item) => item.key === input.key)) return current;
      if (options.suppress && current.seen.includes(input.key)) return current;

      const notification: AppNotification = {
        id: createNotificationId(),
        key: input.key,
        kind: input.kind,
        title: input.title,
        message: input.message,
        href: input.href,
        source: input.source,
        createdAt: new Date().toISOString(),
        read: false,
      };
      const next = prependNotification(current, notification);
      return options.suppress ? rememberKey(next, input.key) : next;
    });
  }, []);

  const markRead = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, read: true } : item)),
    }));
  }, []);

  const markAllRead = useCallback(() => {
    setState((current) => ({
      ...current,
      items: current.items.map((item) => (item.read ? item : { ...item, read: true })),
    }));
  }, []);

  const dismiss = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id),
    }));
  }, []);

  const clearAll = useCallback(() => {
    setState((current) => ({ ...current, items: [] }));
  }, []);

  const value = useMemo(
    () => ({
      notifications: state.items,
      unread: unreadCount(state),
      notify,
      markRead,
      markAllRead,
      dismiss,
      clearAll,
    }),
    [state, notify, markRead, markAllRead, dismiss, clearAll]
  );

  return (
    <NotificationContext.Provider value={value}>
      <NotificationSources />
      {children}
    </NotificationContext.Provider>
  );
}

/**
 * Derives notifications from existing data. Queries share the cache keys used
 * by their feature pages, so this never creates a second copy of the data.
 */
function NotificationSources() {
  const { isAuthenticated } = useAuth();
  const { notify } = useNotifications();

  const assignmentsQuery = useQuery({
    queryKey: assignmentsKey,
    queryFn: () => listAssignments(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2,
  });
  const topicsQuery = useQuery({
    queryKey: [...topicsKey, 'all'],
    queryFn: () => listTopics(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2,
  });
  const assessmentsQuery = useQuery({
    queryKey: assessmentsKey,
    queryFn: () => listAssessments(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2,
  });

  const assignments = useMemo(() => assignmentsQuery.data?.assignments ?? [], [assignmentsQuery.data]);
  const topics = useMemo(() => topicsQuery.data?.topics ?? [], [topicsQuery.data]);
  const assessments = useMemo(() => assessmentsQuery.data?.assessments ?? [], [assessmentsQuery.data]);

  // `suppress` keeps every key from firing more than once, ever.
  useEffect(() => {
    if (!isAuthenticated) return;
    for (const input of [
      ...overdueAssignmentNotifications(assignments),
      ...dueTodayAssignmentNotifications(assignments),
      ...upcomingExamNotifications(topics),
      ...lowScoreNotifications(assessments),
    ]) {
      notify(input, { suppress: true });
    }
  }, [isAuthenticated, assignments, topics, assessments, notify]);

  // Local/offline fallback is worth telling the user about once.
  const settled =
    (assignmentsQuery.isSuccess || assignmentsQuery.isError) &&
    (topicsQuery.isSuccess || topicsQuery.isError);
  const localMode =
    getTopicsMode() === 'local' ||
    getAssignmentsMode() === 'local' ||
    getAssessmentsMode() === 'local';

  const notifiedOffline = useRef(false);
  useEffect(() => {
    if (!settled || !localMode || notifiedOffline.current) return;
    notifiedOffline.current = true;
    notify(offlineNotification(), { suppress: true });
  }, [settled, localMode, notify]);

  return null;
}
