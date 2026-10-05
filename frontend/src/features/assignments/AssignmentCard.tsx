// Assignment card — title, subject, due date, priority and status controls.

import { CalendarClock, Pencil, Trash2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Input';
import { cn } from '../../lib/utils';
import {
  PRIORITY_META,
  STATUS_META,
  STATUS_OPTIONS,
  dueTreatment,
  priorityLabel,
  statusLabel,
} from './assignmentUtils';
import type { Assignment, AssignmentStatus } from '../../types/api';

export interface AssignmentCardProps {
  assignment: Assignment;
  topicTitle?: string;
  onEdit: (assignment: Assignment) => void;
  onDelete: (assignment: Assignment) => void;
  onStatusChange?: (assignment: Assignment, status: AssignmentStatus) => void;
  statusBusy?: boolean;
}

const DUE_CLASS: Record<string, string> = {
  overdue: 'text-coral-700',
  today: 'text-amber-700',
  tomorrow: 'text-amber-700',
};

export function AssignmentCard({
  assignment,
  topicTitle,
  onEdit,
  onDelete,
  onStatusChange,
  statusBusy,
}: AssignmentCardProps) {
  const status = STATUS_META[assignment.status];
  const priority = PRIORITY_META[assignment.priority];
  const due = dueTreatment(assignment.dueDate, assignment.status);

  return (
    <Card
      elevation={1}
      padding="md"
      className="flex h-full flex-col gap-3"
      data-testid="assignment-card"
      data-assignment-id={assignment.id}
      data-assignment-title={assignment.title}
      data-assignment-subject={assignment.subject}
      data-assignment-status={assignment.status}
      data-assignment-priority={assignment.priority}
      data-assignment-due={assignment.dueDate ?? ''}
      data-assignment-topic={topicTitle ?? ''}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h3
            className="truncate text-base font-semibold leading-snug text-ink"
            title={assignment.title}
            data-testid="assignment-title-text"
          >
            {assignment.title}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700"
              data-testid="assignment-subject-label"
            >
              {assignment.subject}
            </span>
            <Badge variant={priority.variant} size="sm" data-testid="assignment-priority-badge">
              {priorityLabel(assignment.priority)}
            </Badge>
          </div>
        </div>
        <Badge variant={status.variant} size="sm" data-testid="assignment-status-badge">
          {status.label}
        </Badge>
      </div>

      {assignment.description && (
        <p
          className="line-clamp-2 text-sm text-ink-muted"
          data-testid="assignment-description"
        >
          {assignment.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
        <span
          className={cn(
            'inline-flex items-center gap-1 font-medium',
            DUE_CLASS[due.kind] ?? 'text-ink-muted'
          )}
          data-testid="assignment-due-label"
        >
          <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
          {due.label}
        </span>
        {topicTitle && (
          <span className="truncate text-ink-subtle" data-testid="assignment-topic-label">
            Topic: {topicTitle}
          </span>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
          Status
          <Select
            value={assignment.status}
            disabled={statusBusy}
            onChange={(event) =>
              onStatusChange?.(assignment, event.target.value as AssignmentStatus)
            }
            options={STATUS_OPTIONS.map((value) => ({ value, label: statusLabel(value) }))}
            aria-label={`Status for ${assignment.title}`}
            data-testid="assignment-status-select"
            className="h-8 w-32 text-xs"
          />
        </label>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Pencil className="w-3.5 h-3.5" />}
            onClick={() => onEdit(assignment)}
            aria-label={`Edit assignment ${assignment.title}`}
            data-testid="assignment-edit"
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-coral-600 hover:bg-coral-50"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => onDelete(assignment)}
            aria-label={`Delete assignment ${assignment.title}`}
            data-testid="assignment-delete"
          >
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}
