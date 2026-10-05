// Assignment helpers — labels, badges and date handling shared by the
// assignments page, the form dialog and the dashboard widget.

import type {
  Assignment,
  AssignmentCreate,
  AssignmentPriority,
  AssignmentStatus,
  AssignmentUpdate,
} from '../../types/api';

/** Normalised form values shared by the assignment dialog and the page. */
export interface AssignmentFormValues {
  title: string;
  description: string;
  subject: string;
  topicId: string | null;
  dueDate: string | null;
  status: AssignmentStatus;
  priority: AssignmentPriority;
}

export function toCreatePayload(values: AssignmentFormValues): AssignmentCreate {
  return {
    title: values.title,
    description: values.description,
    subject: values.subject,
    topicId: values.topicId,
    dueDate: values.dueDate,
    status: values.status,
    priority: values.priority,
  };
}

export function toUpdatePayload(values: AssignmentFormValues): AssignmentUpdate {
  return toCreatePayload(values);
}

export function toFormValues(assignment: Assignment | null): AssignmentFormValues {
  if (!assignment) {
    return {
      title: '',
      description: '',
      subject: '',
      topicId: null,
      dueDate: null,
      status: 'pending',
      priority: 'medium',
    };
  }
  return {
    title: assignment.title,
    description: assignment.description,
    subject: assignment.subject,
    topicId: assignment.topicId,
    dueDate: assignment.dueDate,
    status: assignment.status,
    priority: assignment.priority,
  };
}

export const STATUS_OPTIONS: AssignmentStatus[] = ['pending', 'in_progress', 'completed'];
export const PRIORITY_OPTIONS: AssignmentPriority[] = ['low', 'medium', 'high'];

interface Meta {
  label: string;
  variant: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export const STATUS_META: Record<AssignmentStatus, Meta> = {
  pending: { label: 'Pending', variant: 'warning' },
  in_progress: { label: 'In progress', variant: 'info' },
  completed: { label: 'Completed', variant: 'success' },
};

export const PRIORITY_META: Record<AssignmentPriority, Meta> = {
  low: { label: 'Low', variant: 'default' },
  medium: { label: 'Medium', variant: 'info' },
  high: { label: 'High', variant: 'danger' },
};

export function statusLabel(status: AssignmentStatus): string {
  return STATUS_META[status].label;
}

export function priorityLabel(priority: AssignmentPriority): string {
  return PRIORITY_META[priority].label;
}

export type DueKind = 'none' | 'overdue' | 'today' | 'tomorrow' | 'soon' | 'upcoming' | 'completed';

export interface DueTreatment {
  kind: DueKind;
  label: string;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function dayDiff(due: Date, base: Date): number {
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((dueDay.getTime() - base.getTime()) / 86400000);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Turn a due date into a human label plus a machine-readable kind so the card
 * can colour it (overdue = red, today = amber, upcoming = neutral).
 */
export function dueTreatment(
  dueDate: string | null,
  status: AssignmentStatus = 'pending'
): DueTreatment {
  if (!dueDate) return { kind: 'none', label: 'No due date' };

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return { kind: 'none', label: 'No due date' };

  const diff = dayDiff(due, startOfToday());
  const time = formatTime(due);

  if (status === 'completed') {
    return { kind: 'completed', label: `Due ${due.toLocaleDateString()} ${time}`.trim() };
  }
  if (diff < 0) {
    const days = Math.abs(diff);
    return {
      kind: 'overdue',
      label: `Overdue by ${days} ${days === 1 ? 'day' : 'days'}`,
    };
  }
  if (diff === 0) return { kind: 'today', label: `Due today ${time}`.trim() };
  if (diff === 1) return { kind: 'tomorrow', label: `Due tomorrow ${time}`.trim() };
  if (diff <= 7) {
    return {
      kind: 'soon',
      label: `Due ${due.toLocaleDateString(undefined, { weekday: 'long' })} ${time}`.trim(),
    };
  }
  return { kind: 'upcoming', label: `Due ${due.toLocaleDateString()} ${time}`.trim() };
}

export function isOverdue(assignment: { dueDate: string | null; status: AssignmentStatus }): boolean {
  return dueTreatment(assignment.dueDate, assignment.status).kind === 'overdue';
}

/** `<input type="datetime-local">` value (local, no timezone) from an ISO string. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** ISO string (UTC) from a datetime-local value, or null when cleared. */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function assignmentCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'assignment' : 'assignments'}`;
}
