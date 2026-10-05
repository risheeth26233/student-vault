// Assignment form dialog — create or edit a single assignment.
// The topic is optional; when chosen it locks the subject to the topic's
// subject so the assignment and its Vault topic stay consistent.

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import {
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  isoToLocalInput,
  localInputToIso,
  priorityLabel,
  statusLabel,
  toFormValues,
  type AssignmentFormValues,
} from './assignmentUtils';
import type { Assignment, Topic } from '../../types/api';

export interface AssignmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment | null;
  subjects: string[];
  topics: Topic[];
  isSubmitting: boolean;
  onSubmit: (values: AssignmentFormValues) => Promise<void>;
}

export function AssignmentFormDialog({
  open,
  onOpenChange,
  assignment,
  subjects,
  topics,
  isSubmitting,
  onSubmit,
}: AssignmentFormDialogProps) {
  const [values, setValues] = useState<AssignmentFormValues>(() => toFormValues(null));
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setValues(toFormValues(assignment));
    setError(null);
  }, [open, assignment]);

  const topicOptions = useMemo(
    () =>
      topics.map((topic) => ({
        value: topic.id,
        label: `${topic.subject} — ${topic.title}`,
      })),
    [topics]
  );

  const selectedTopic = topics.find((topic) => topic.id === values.topicId) ?? null;

  const setField = <K extends keyof AssignmentFormValues>(key: K, value: AssignmentFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const handleTopicChange = (topicId: string) => {
    const topic = topics.find((item) => item.id === topicId) ?? null;
    setValues((current) => ({
      ...current,
      topicId: topic ? topic.id : null,
      // Keep subject in step with the linked topic so the backend can validate.
      subject: topic ? topic.subject : current.subject,
    }));
  };

  const handleSubmit = async () => {
    const title = values.title.trim();
    const subject = values.subject.trim();

    if (!title) {
      setError('Enter a title for the assignment.');
      return;
    }
    if (title.length > 120) {
      setError('Title must be 120 characters or fewer.');
      return;
    }
    if (!subject) {
      setError('Enter a subject for the assignment.');
      return;
    }
    if (values.description.length > 2000) {
      setError('Description must be 2000 characters or fewer.');
      return;
    }

    setError(null);
    try {
      await onSubmit({
        title,
        description: values.description,
        subject,
        topicId: values.topicId,
        dueDate: values.dueDate,
        status: values.status,
        priority: values.priority,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return;
    }
    onOpenChange(false);
  };

  const close = (nextOpen: boolean) => {
    if (!nextOpen && !isSubmitting) {
      setError(null);
      setValues(toFormValues(null));
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" data-testid="assignment-form-dialog">
        <DialogHeader>
          <DialogTitle>{assignment ? 'Edit assignment' : 'New assignment'}</DialogTitle>
          <DialogDescription>
            {assignment
              ? 'Update the details of this assignment.'
              : 'Track homework, projects and coursework with a due date.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="assignment-title">
              Title
            </label>
            <Input
              id="assignment-title"
              value={values.title}
              onChange={(event) => setField('title', event.target.value)}
              placeholder="e.g. Calculus problem set 4"
              maxLength={120}
              aria-label="Assignment title"
              data-testid="assignment-title-input"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="assignment-subject">
              Subject
            </label>
            <Input
              id="assignment-subject"
              value={values.subject}
              onChange={(event) => setField('subject', event.target.value)}
              placeholder="e.g. Mathematics"
              maxLength={40}
              list="assignment-subject-suggestions"
              aria-label="Assignment subject"
              data-testid="assignment-subject-input"
            />
            <datalist id="assignment-subject-suggestions">
              {subjects.map((subject) => (
                <option key={subject} value={subject} />
              ))}
            </datalist>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="assignment-topic">
                Topic (optional)
              </label>
              <Select
                id="assignment-topic"
                value={values.topicId ?? ''}
                onChange={(event) => handleTopicChange(event.target.value)}
                options={[{ value: '', label: 'No linked topic' }, ...topicOptions]}
                aria-label="Link a Vault topic"
                data-testid="assignment-topic-select"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="assignment-due">
                Due date (optional)
              </label>
              <Input
                id="assignment-due"
                type="datetime-local"
                value={isoToLocalInput(values.dueDate)}
                onChange={(event) => setField('dueDate', localInputToIso(event.target.value))}
                aria-label="Assignment due date"
                data-testid="assignment-due-input"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="assignment-status">
                Status
              </label>
              <Select
                id="assignment-status"
                value={values.status}
                onChange={(event) =>
                  setField('status', event.target.value as AssignmentFormValues['status'])
                }
                options={STATUS_OPTIONS.map((value) => ({ value, label: statusLabel(value) }))}
                aria-label="Assignment status"
                data-testid="assignment-status-select-field"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="assignment-priority">
                Priority
              </label>
              <Select
                id="assignment-priority"
                value={values.priority}
                onChange={(event) =>
                  setField('priority', event.target.value as AssignmentFormValues['priority'])
                }
                options={PRIORITY_OPTIONS.map((value) => ({ value, label: priorityLabel(value) }))}
                aria-label="Assignment priority"
                data-testid="assignment-priority-select"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="assignment-description">
              Notes (optional)
            </label>
            <Textarea
              id="assignment-description"
              value={values.description}
              onChange={(event) => setField('description', event.target.value)}
              placeholder="Anything you need to remember about this assignment"
              rows={3}
              maxLength={2000}
              aria-label="Assignment description"
              data-testid="assignment-description-input"
            />
          </div>

          {selectedTopic && (
            <p className="text-xs text-ink-subtle" data-testid="assignment-topic-hint">
              Linked to {selectedTopic.subject} — {selectedTopic.title}
            </p>
          )}

          {error && (
            <p
              className="rounded-lg bg-coral-50 px-3 py-2 text-sm text-coral-700"
              role="alert"
              data-testid="assignment-form-error"
            >
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => close(false)}
            disabled={isSubmitting}
            data-testid="assignment-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            loading={isSubmitting}
            onClick={handleSubmit}
            data-testid="assignment-save"
          >
            {assignment ? 'Save changes' : 'Add assignment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
