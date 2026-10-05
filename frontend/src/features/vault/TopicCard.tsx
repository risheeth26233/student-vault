// Topic card — status, exam date, checklist progress and inline notes editing

import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Textarea } from '../../components/ui/Input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '../../components/ui/DropdownMenu';
import { useToastHelpers } from '../../components/ui/Toast';
import { useUpdateTopic, useUpdateTopicChecklist } from '../../hooks/useTopics';
import { useNotesAutosave } from './useNotesAutosave';
import { cn, formatDate } from '../../lib/utils';
import { Calendar, Circle, CircleCheck, Pencil, Trash, EllipsisVertical, StickyNote, ChevronDown } from 'lucide-react';
import type { Topic } from '../../types/api';

type TopicStatus = Topic['status'];

const STATUS_META: Record<TopicStatus, { label: string; variant: 'info' | 'warning' | 'success' }> = {
  learning: { label: 'Learning', variant: 'info' },
  reviewing: { label: 'Reviewing', variant: 'warning' },
  ready: { label: 'Ready', variant: 'success' },
};

const STATUS_OPTIONS: { value: TopicStatus; label: string }[] = [
  { value: 'learning', label: 'Learning' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'ready', label: 'Ready' },
];

const CHECKLIST_STEPS = [
  { key: 'understand', label: 'Understand' },
  { key: 'practice', label: 'Practice' },
  { key: 'revise', label: 'Revise' },
] as const;

function examCountdown(iso: string): { text: string; urgent: boolean; overdue: boolean } {
  const examDay = new Date(iso);
  examDay.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((examDay.getTime() - today.getTime()) / 86400000);

  if (days < 0) {
    const count = Math.abs(days);
    return { text: `${count} day${count === 1 ? '' : 's'} overdue`, urgent: true, overdue: true };
  }
  if (days === 0) return { text: 'Exam today', urgent: true, overdue: false };
  if (days === 1) return { text: 'Exam tomorrow', urgent: true, overdue: false };
  if (days <= 7) return { text: `In ${days} days`, urgent: days <= 3, overdue: false };
  return { text: `In ${days} days`, urgent: false, overdue: false };
}

export interface TopicCardProps {
  topic: Topic;
  onEdit: (topic: Topic) => void;
  onDelete: (topic: Topic) => void;
  onSelectSubject: (subject: string) => void;
}

export function TopicCard({ topic, onEdit, onDelete, onSelectSubject }: TopicCardProps) {
  const toast = useToastHelpers();
  const updateTopic = useUpdateTopic();
  const updateChecklist = useUpdateTopicChecklist();
  const [notesOpen, setNotesOpen] = useState(false);
  const { value: notesValue, status: notesStatus, change: changeNotes, flush: flushNotes } = useNotesAutosave(topic);

  const statusMeta = STATUS_META[topic.status] ?? { label: 'Unknown', variant: 'info' as const };
  const checklistDone = CHECKLIST_STEPS.filter((step) => topic.checklist[step.key]).length;
  const exam = topic.examDate ? examCountdown(topic.examDate) : null;

  const handleStatusChange = (status: string) => {
    updateTopic.mutate(
      { id: topic.id, data: { status: status as TopicStatus } },
      {
        onError: (error) => toast.error('Could not update status', error.message),
      }
    );
  };

  const handleToggleStep = (key: (typeof CHECKLIST_STEPS)[number]['key']) => {
    updateChecklist.mutate({
      id: topic.id,
      checklist: { ...topic.checklist, [key]: !topic.checklist[key] },
    });
  };

  const handleNotesToggle = () => {
    if (notesOpen) flushNotes();
    setNotesOpen((open) => !open);
  };

  const notesStatusLabel = {
    saving: 'Saving...',
    saved: 'Saved',
    error: 'Save failed',
    idle: '',
  }[notesStatus];

  return (
    <Card elevation={1} padding="md" className="space-y-3">
      {/* Header: subject + status + actions */}
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onSelectSubject(topic.subject)}
          className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          title={`Filter by ${topic.subject}`}
        >
          {topic.subject}
        </button>

        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Status: ${statusMeta.label}. Change status`}
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <Badge variant={statusMeta.variant} size="sm" dot>
                  {statusMeta.label}
                </Badge>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Set status</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={topic.status} onValueChange={handleStatusChange}>
                {STATUS_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Actions for ${topic.title}`}
                className="p-1.5 rounded-md text-ink-muted hover:bg-gray-100 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <EllipsisVertical className="w-4 h-4" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit(topic)}>
                <Pencil className="w-4 h-4 mr-2" aria-hidden="true" />
                Edit topic
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onDelete(topic)} className="text-coral-600 focus:text-coral-700">
                <Trash className="w-4 h-4 mr-2" aria-hidden="true" />
                Delete topic
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Title + exam date */}
      <div>
        <h3 className="font-semibold text-ink leading-snug">{topic.title}</h3>
        {topic.examDate && exam && (
          <p
            className={cn(
              'mt-1.5 inline-flex items-center gap-1.5 text-sm',
              exam.overdue
                ? 'text-coral-600 font-semibold'
                : exam.urgent
                  ? 'text-amber-600 font-medium'
                  : 'text-ink-muted'
            )}
          >
            <Calendar className="w-4 h-4" aria-hidden="true" />
            {formatDate(topic.examDate)} - {exam.text}
          </p>
        )}
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Progress</span>
          <span className="text-xs text-ink-muted">
            {checklistDone}/{CHECKLIST_STEPS.length}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {CHECKLIST_STEPS.map((step) => {
            const checked = topic.checklist[step.key];
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => handleToggleStep(step.key)}
                aria-pressed={checked}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                  checked
                    ? 'border-teal-200 bg-teal-50 text-teal-700'
                    : 'border-border bg-surface text-ink-muted hover:border-teal-300 hover:text-teal-700'
                )}
              >
                {checked ? (
                  <CircleCheck className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                ) : (
                  <Circle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleNotesToggle}
            aria-expanded={notesOpen}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-teal-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
          >
            <StickyNote className="w-4 h-4" aria-hidden="true" />
            Notes
            <ChevronDown
              className={cn('w-3.5 h-3.5 transition-transform', notesOpen && 'rotate-180')}
              aria-hidden="true"
            />
          </button>
          <span
            className={cn(
              'text-xs',
              notesStatus === 'error'
                ? 'text-coral-600'
                : notesStatus === 'saving'
                  ? 'text-ink-muted'
                  : 'text-teal-600'
            )}
            role="status"
            aria-live="polite"
          >
            {notesStatusLabel}
          </span>
        </div>

        {notesOpen ? (
          <Textarea
            value={notesValue}
            onChange={(event) => changeNotes(event.target.value)}
            onBlur={flushNotes}
            placeholder="Add notes for this topic..."
            rows={4}
            className="mt-2 text-sm"
            aria-label={`Notes for ${topic.title}`}
          />
        ) : (
          <p
            className="mt-1.5 text-sm text-ink-muted line-clamp-2 cursor-pointer hover:text-ink"
            onClick={handleNotesToggle}
          >
            {notesValue ? notesValue : 'No notes yet - click to add.'}
          </p>
        )}
      </div>
    </Card>
  );
}
