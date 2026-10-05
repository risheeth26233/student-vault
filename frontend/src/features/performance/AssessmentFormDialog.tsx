// Assessment form dialog — create or edit a single academic performance record.
// The topic is optional; when chosen it locks the subject to the topic's subject
// so the record and its Vault topic stay consistent.

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
import { Input, Select } from '../../components/ui/Input';
import {
  TYPE_OPTIONS,
  formatPercent,
  percentageOf,
  toFormValues,
  typeLabel,
  validateAssessmentValues,
  type AssessmentFormValues,
} from './performanceUtils';
import type { Assessment, Topic } from '../../types/api';

export interface AssessmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessment: Assessment | null;
  subjects: string[];
  topics: Topic[];
  isSubmitting: boolean;
  onSubmit: (values: AssessmentFormValues) => Promise<void>;
}

export function AssessmentFormDialog({
  open,
  onOpenChange,
  assessment,
  subjects,
  topics,
  isSubmitting,
  onSubmit,
}: AssessmentFormDialogProps) {
  const [values, setValues] = useState<AssessmentFormValues>(() => toFormValues(null));
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setValues(toFormValues(assessment));
    setError(null);
  }, [open, assessment]);

  const topicOptions = useMemo(
    () =>
      topics.map((topic) => ({
        value: topic.id,
        label: `${topic.subject} — ${topic.title}`,
      })),
    [topics]
  );

  const selectedTopic = topics.find((topic) => topic.id === values.topicId) ?? null;

  const previewPercent = useMemo(() => {
    const score = Number(values.score);
    const max = Number(values.maxScore);
    if (!values.score.trim() || !values.maxScore.trim() || !Number.isFinite(score) || !Number.isFinite(max)) {
      return null;
    }
    if (max <= 0 || score < 0) return null;
    return formatPercent(percentageOf(score, max));
  }, [values.score, values.maxScore]);

  const setField = <K extends keyof AssessmentFormValues>(key: K, value: AssessmentFormValues[K]) => {
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
    const validationError = validateAssessmentValues(values);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    try {
      await onSubmit(values);
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
      <DialogContent className="sm:max-w-md" data-testid="performance-form-dialog">
        <DialogHeader>
          <DialogTitle>{assessment ? 'Edit record' : 'New record'}</DialogTitle>
          <DialogDescription>
            {assessment
              ? 'Update this academic performance record.'
              : 'Log a quiz, test, exam or assignment result.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="performance-title">
              Title
            </label>
            <Input
              id="performance-title"
              value={values.title}
              onChange={(event) => setField('title', event.target.value)}
              placeholder="e.g. Unit test 3"
              maxLength={120}
              aria-label="Record title"
              data-testid="performance-title-input"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="performance-subject">
              Subject
            </label>
            <Input
              id="performance-subject"
              value={values.subject}
              onChange={(event) => setField('subject', event.target.value)}
              placeholder="e.g. Mathematics"
              maxLength={40}
              list="performance-subject-suggestions"
              aria-label="Record subject"
              data-testid="performance-subject-input"
            />
            <datalist id="performance-subject-suggestions">
              {subjects.map((subject) => (
                <option key={subject} value={subject} />
              ))}
            </datalist>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="performance-topic">
                Topic (optional)
              </label>
              <Select
                id="performance-topic"
                value={values.topicId ?? ''}
                onChange={(event) => handleTopicChange(event.target.value)}
                options={[{ value: '', label: 'No linked topic' }, ...topicOptions]}
                aria-label="Link a Vault topic"
                data-testid="performance-topic-select"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="performance-type">
                Type
              </label>
              <Select
                id="performance-type"
                value={values.type}
                onChange={(event) => setField('type', event.target.value as AssessmentFormValues['type'])}
                options={TYPE_OPTIONS.map((value) => ({ value, label: typeLabel(value) }))}
                aria-label="Assessment type"
                data-testid="performance-type-select"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="performance-score">
                Score
              </label>
              <Input
                id="performance-score"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={values.score}
                onChange={(event) => setField('score', event.target.value)}
                placeholder="e.g. 42"
                aria-label="Score achieved"
                data-testid="performance-score-input"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="performance-max">
                Out of
              </label>
              <Input
                id="performance-max"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={values.maxScore}
                onChange={(event) => setField('maxScore', event.target.value)}
                placeholder="e.g. 50"
                aria-label="Maximum score"
                data-testid="performance-max-input"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="performance-date">
                Date
              </label>
              <Input
                id="performance-date"
                type="date"
                value={values.date}
                onChange={(event) => setField('date', event.target.value)}
                aria-label="Assessment date"
                data-testid="performance-date-input"
              />
            </div>
          </div>

          {previewPercent && (
            <p className="text-xs text-ink-subtle" data-testid="performance-percent-preview">
              That is {previewPercent}
            </p>
          )}

          {selectedTopic && (
            <p className="text-xs text-ink-subtle" data-testid="performance-topic-hint">
              Linked to {selectedTopic.subject} — {selectedTopic.title}
            </p>
          )}

          {error && (
            <p
              className="rounded-lg bg-coral-50 px-3 py-2 text-sm text-coral-700"
              role="alert"
              data-testid="performance-form-error"
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
            data-testid="performance-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            loading={isSubmitting}
            onClick={handleSubmit}
            data-testid="performance-save"
          >
            {assessment ? 'Save changes' : 'Add record'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
