// Progress panel — honest before/after measurement and a labelled timeline.
//
// Honesty rules enforced here (see progressModel.ts for the logic):
// - only definite observations (a definite evaluation, or a graded check)
//   support a direction claim; anything weaker reports as
//   "not enough evidence" with a statement of what is missing;
// - the caveat text is always rendered with the summary.

import { CalendarClock, LineChart } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { buildTimeline, summarizeProgress } from '../progressModel';
import type { HandwritingSubmission, ProgressDirection } from '../handwritingTypes';

const DIRECTION_LABEL: Record<ProgressDirection, string> = {
  improved: 'improved',
  unchanged: 'unchanged',
  declined: 'declined',
  not_enough_evidence: 'not enough evidence yet',
};

const DIRECTION_VARIANT: Record<ProgressDirection, 'success' | 'default' | 'danger' | 'warning'> = {
  improved: 'success',
  unchanged: 'default',
  declined: 'danger',
  not_enough_evidence: 'warning',
};

const STAGE_ORDER = [
  'submitted',
  'extracted',
  'confirmed',
  'evaluated',
  'practiced',
  'reassessed',
] as const;

const TONE_CLASS: Record<string, string> = {
  default: 'bg-gray-200',
  success: 'bg-teal-500',
  warning: 'bg-amber-400',
  danger: 'bg-coral-500',
};

function formatTime(at: string): string {
  try {
    return new Date(at).toLocaleString();
  } catch {
    return at;
  }
}

export interface ProgressPanelProps {
  submission: HandwritingSubmission;
}

export function ProgressPanel({ submission }: ProgressPanelProps) {
  const summary = summarizeProgress(submission);
  const timeline = buildTimeline(submission);

  return (
    <Card elevation={1} padding="md" data-testid="progress-panel">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <LineChart className="h-5 w-5 text-teal-600" aria-hidden="true" />
            Progress on this work
          </h2>
          <p className="text-sm text-ink-muted">
            Measured only from definite observations — evaluations with a definite result and
            checked answers. Everything else is recorded but cannot move this indicator.
          </p>
        </div>
        {summary && (
          <Badge variant={DIRECTION_VARIANT[summary.direction]} data-testid="progress-direction">
            {DIRECTION_LABEL[summary.direction]}
          </Badge>
        )}
      </div>

      {summary ? (
        <div className="mb-4 space-y-2" data-testid="progress-summary">
          <p className="text-base text-ink" data-testid="progress-statement">
            {summary.statement}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
            <span>Confidence: {summary.confidence === 'none' ? 'none' : summary.confidence}</span>
            <span aria-hidden="true">·</span>
            <span>
              {summary.definiteObservations} definite observation
              {summary.definiteObservations === 1 ? '' : 's'}
            </span>
          </div>
          <p className="rounded-xl border border-border bg-gray-50 px-3 py-2 text-sm italic text-ink-muted" data-testid="progress-caveat">
            {summary.caveat}
          </p>
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-border bg-gray-50 p-3" data-testid="progress-empty">
          <p className="text-sm text-ink-muted">
            No definite observations yet — evaluate the confirmed text, then answer a practice or
            reassessment question to see measured change.
          </p>
        </div>
      )}

      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
        What happened, in order
      </p>
      {timeline.length === 0 ? (
        <p className="text-sm text-ink-muted" data-testid="timeline-empty">
          Nothing recorded yet.
        </p>
      ) : (
        <ol className="space-y-0" data-testid="progress-timeline">
          {timeline.map((item) => {
            const stageIndex = STAGE_ORDER.indexOf(item.stage);
            return (
              <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0" data-testid={`timeline-${item.stage}`}>
                <div className="flex flex-col items-center">
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${TONE_CLASS[item.tone] ?? TONE_CLASS.default}`}
                    aria-hidden="true"
                  />
                  {stageIndex < STAGE_ORDER.length - 1 && (
                    <span className="w-px flex-1 bg-border" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-semibold text-ink">{item.label}</p>
                    <time className="text-xs text-ink-subtle" dateTime={item.at}>
                      {formatTime(item.at)}
                    </time>
                  </div>
                  <p className="text-sm text-ink-muted">{item.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
