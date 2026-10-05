// Assessment card — title, subject, type, score and date with edit/delete.

import { CalendarDays, Pencil, Trash2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../lib/utils';
import { formatPercent, scoreBand, typeLabel, typeVariant } from './performanceUtils';
import type { Assessment } from '../../types/api';

export interface AssessmentCardProps {
  assessment: Assessment;
  topicTitle?: string;
  onEdit: (assessment: Assessment) => void;
  onDelete: (assessment: Assessment) => void;
}

export function AssessmentCard({ assessment, topicTitle, onEdit, onDelete }: AssessmentCardProps) {
  const band = scoreBand(assessment.percentage);
  const dateLabel = new Date(assessment.date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Card
      elevation={1}
      padding="md"
      className="flex h-full flex-col gap-3"
      data-testid="assessment-card"
      data-assessment-id={assessment.id}
      data-assessment-title={assessment.title}
      data-assessment-subject={assessment.subject}
      data-assessment-type={assessment.type}
      data-assessment-percent={assessment.percentage}
      data-assessment-score={`${assessment.score}/${assessment.maxScore}`}
      data-assessment-date={assessment.date}
      data-assessment-topic={topicTitle ?? ''}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h3
            className="truncate text-base font-semibold leading-snug text-ink"
            title={assessment.title}
            data-testid="assessment-title-text"
          >
            {assessment.title}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700"
              data-testid="assessment-subject-label"
            >
              {assessment.subject}
            </span>
            <Badge variant={typeVariant(assessment.type)} size="sm" data-testid="assessment-type-badge">
              {typeLabel(assessment.type)}
            </Badge>
          </div>
        </div>
        <Badge variant={band.variant} size="sm" data-testid="assessment-percent-badge">
          {formatPercent(assessment.percentage)}
        </Badge>
      </div>

      <p className="text-sm text-ink-muted" data-testid="assessment-score-text">
        Score: <span className="font-semibold text-ink">{assessment.score}</span> / {assessment.maxScore}
        <span className={cn('ml-2 font-medium', band.kind === 'weak' ? 'text-coral-600' : 'text-teal-600')}>
          {formatPercent(assessment.percentage)}
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1" data-testid="assessment-date-label">
          <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
          {dateLabel}
        </span>
        {topicTitle && (
          <span className="truncate text-ink-subtle" data-testid="assessment-topic-label">
            Topic: {topicTitle}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-end gap-1 border-t border-border pt-3">
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<Pencil className="w-3.5 h-3.5" />}
          onClick={() => onEdit(assessment)}
          aria-label={`Edit record ${assessment.title}`}
          data-testid="assessment-edit"
        >
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-coral-600 hover:bg-coral-50"
          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          onClick={() => onDelete(assessment)}
          aria-label={`Delete record ${assessment.title}`}
          data-testid="assessment-delete"
        >
          Delete
        </Button>
      </div>
    </Card>
  );
}
