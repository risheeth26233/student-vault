// Notification sources — pure builders that turn existing Student-Vault data
// (assignments, exam dates, connection mode) into notification payloads.
// Deliberately descriptive only: no predictions, no scoring, no intelligence.

import type { Assessment, Assignment, Topic } from '../../types/api';
import type { NotificationKind } from '../../services/notificationStore';

export interface NotificationInput {
  key: string;
  kind: NotificationKind;
  title: string;
  message?: string;
  href?: string;
  source: string;
}

/** Local calendar day as `YYYY-MM-DD` (matches the date inputs used everywhere). */
export function todayISO(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole days from today until `iso` (negative = past). Returns null when unusable. */
export function daysUntil(iso: string, from = new Date()): number | null {
  if (!iso) return null;
  const target = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const base = new Date(`${todayISO(from)}T00:00:00`);
  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}

function formatDateLabel(iso: string): string {
  const target = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return iso;
  return target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const MAX_PER_SOURCE = 5;

export function overdueAssignmentNotifications(assignments: Assignment[]): NotificationInput[] {
  return assignments
    .filter((assignment) => assignment.status !== 'completed')
    .map((assignment) => ({ assignment, days: daysUntil(assignment.dueDate ?? '') }))
    .filter((entry): entry is { assignment: Assignment; days: number } => entry.days !== null && entry.days < 0)
    .slice(0, MAX_PER_SOURCE)
    .map(({ assignment, days }) => ({
      key: `assignment-overdue:${assignment.id}`,
      kind: 'warning' as const,
      title: 'Assignment overdue',
      message: `${assignment.title} was due ${formatDateLabel(assignment.dueDate ?? '')} (${Math.abs(
        days
      )} day${Math.abs(days) === 1 ? '' : 's'} ago).`,
      href: '/assignments',
      source: 'assignments',
    }));
}

export function dueTodayAssignmentNotifications(assignments: Assignment[]): NotificationInput[] {
  const today = todayISO();
  return assignments
    .filter((assignment) => assignment.status !== 'completed' && (assignment.dueDate ?? '').slice(0, 10) === today)
    .slice(0, MAX_PER_SOURCE)
    .map((assignment) => ({
      key: `assignment-due-today:${assignment.id}`,
      kind: 'info' as const,
      title: 'Assignment due today',
      message: `${assignment.title} is due today.`,
      href: '/assignments',
      source: 'assignments',
    }));
}

/** Exam dates landing within the next `window` days (inclusive of today). */
export function upcomingExamNotifications(topics: Topic[], window = 7): NotificationInput[] {
  return topics
    .map((topic) => ({ topic, days: daysUntil(topic.examDate ?? '') }))
    .filter(
      (entry): entry is { topic: Topic; days: number } =>
        entry.days !== null && entry.days >= 0 && entry.days <= window
    )
    .sort((a, b) => a.days - b.days)
    .slice(0, MAX_PER_SOURCE)
    .map(({ topic, days }) => ({
      key: `exam-upcoming:${topic.id}`,
      kind: 'info' as const,
      title: days === 0 ? 'Exam today' : `Exam in ${days} day${days === 1 ? '' : 's'}`,
      message: `${topic.subject} — ${topic.title} on ${formatDateLabel(topic.examDate ?? '')}.`,
      href: `/vault?subject=${encodeURIComponent(topic.subject)}`,
      source: 'topics',
    }));
}

export function offlineNotification(): NotificationInput {
  return {
    key: 'offline-local-mode',
    kind: 'warning',
    title: 'Working offline',
    message: 'The server is unreachable — your changes are being saved on this device.',
    href: '/sync',
    source: 'system',
  };
}

/** Low test scores are surfaced as a reminder, never as judgement. */
export function lowScoreNotifications(assessments: Assessment[], threshold = 50): NotificationInput[] {
  return assessments
    .filter((assessment) => assessment.percentage < threshold)
    .slice(0, MAX_PER_SOURCE)
    .map((assessment) => ({
      key: `low-score:${assessment.id}`,
      kind: 'info' as const,
      title: 'Result worth revisiting',
      message: `${assessment.title} — ${assessment.percentage}%. Add it to your revision list.`,
      href: `/performance?subject=${encodeURIComponent(assessment.subject)}`,
      source: 'performance',
    }));
}

/** Compact relative timestamp for the notification list. */
export function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
