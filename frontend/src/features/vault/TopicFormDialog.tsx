// Create / edit topic dialog
// Shared by the Vault list and any future "add topic" entry points.

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { SUBJECT_MAX_LENGTH } from '../../hooks/useSubjects';
import type { Topic } from '../../types/api';

const TITLE_MAX_LENGTH = 80;

export interface TopicFormValues {
  subject: string;
  title: string;
  examDate: string | null;
  notes: string;
  status: 'learning' | 'reviewing' | 'ready';
}

export interface TopicFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing topic to edit; omit to create a new one. */
  topic?: Topic | null;
  /** Prefill subject when creating. */
  defaultSubject?: string | null;
  /** Known subjects, offered as datalist suggestions. */
  subjects?: string[];
  onSubmit: (values: TopicFormValues) => Promise<void>;
  /** Override the dialog heading (defaults to New/Edit topic). */
  dialogTitle?: string;
  /** Override the dialog description. */
  dialogDescription?: string;
  /** Override the submit button label (defaults to Create topic/Save changes). */
  submitLabel?: string;
}

const STATUS_OPTIONS = [
  { value: 'learning', label: 'Learning' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'ready', label: 'Ready' },
];

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function fromDateInputValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function validate(values: TopicFormValues): Partial<Record<keyof TopicFormValues, string>> {
  const errors: Partial<Record<keyof TopicFormValues, string>> = {};
  const subject = values.subject.trim();
  const title = values.title.trim();

  if (!subject) errors.subject = 'Subject is required.';
  else if (subject.length > SUBJECT_MAX_LENGTH) errors.subject = `Subject is limited to ${SUBJECT_MAX_LENGTH} characters.`;

  if (!title) errors.title = 'Title is required.';
  else if (title.length > TITLE_MAX_LENGTH) errors.title = `Title is limited to ${TITLE_MAX_LENGTH} characters.`;

  return errors;
}

export function TopicFormDialog({
  open,
  onOpenChange,
  topic,
  defaultSubject,
  subjects = [],
  onSubmit,
  dialogTitle,
  dialogDescription,
  submitLabel,
}: TopicFormDialogProps) {
  const isEdit = !!topic;
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [examDate, setExamDate] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'learning' | 'reviewing' | 'ready'>('learning');
  const [errors, setErrors] = useState<Partial<Record<keyof TopicFormValues, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubject(topic?.subject ?? defaultSubject ?? '');
    setTitle(topic?.title ?? '');
    setExamDate(toDateInputValue(topic?.examDate ?? null));
    setNotes(topic?.notes ?? '');
    setStatus(topic?.status ?? 'learning');
    setErrors({});
    setSubmitError(null);
    setIsSubmitting(false);
  }, [open, topic, defaultSubject]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    const values: TopicFormValues = {
      subject: subject.trim(),
      title: title.trim(),
      examDate: fromDateInputValue(examDate),
      notes,
      status,
    };

    const validation = validate(values);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not save the topic.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle ?? (isEdit ? 'Edit topic' : 'New topic')}</DialogTitle>
          <DialogDescription>
            {dialogDescription ??
              (isEdit ? 'Update the details for this study topic.' : 'Add a topic to one of your subjects.')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <Input
              label="Subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              error={errors.subject}
              placeholder="e.g. Mathematics"
              maxLength={SUBJECT_MAX_LENGTH}
              list="topic-subject-options"
              autoComplete="off"
              autoFocus
            />
            <datalist id="topic-subject-options">
              {subjects.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <Input
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            error={errors.title}
            placeholder="e.g. Trigonometric identities"
            maxLength={TITLE_MAX_LENGTH}
            autoComplete="off"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Exam date"
              type="date"
              value={examDate}
              onChange={(event) => setExamDate(event.target.value)}
              hint="Optional"
            />
            <Select
              label="Status"
              value={status}
              onChange={(event) => setStatus(event.target.value as 'learning' | 'reviewing' | 'ready')}
              options={STATUS_OPTIONS}
            />
          </div>

          <Textarea
            label="Notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Key formulas, weak spots, links…"
            rows={4}
            hint="Notes autosave on the topic card as well."
          />

          {submitError && (
            <p className="text-sm text-coral-600" role="alert">
              {submitError}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {submitLabel ?? (isEdit ? 'Save changes' : 'Create topic')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
