// Subject-wise breakdown of academic performance — descriptive averages only.

import { Card } from '../../components/ui/Card';
import { formatPercent, type SubjectSummary } from './performanceUtils';

export interface SubjectBreakdownProps {
  /** Subjects that have at least one record, ordered by average. */
  summaries: SubjectSummary[];
  /** Every known subject (registry + topics) so empty subjects stay visible. */
  allSubjects: string[];
}

interface Row {
  subject: string;
  count: number;
  average: number;
}

export function SubjectBreakdown({ summaries, allSubjects }: SubjectBreakdownProps) {
  const bySubject = new Map<string, SubjectSummary>();
  for (const summary of summaries) bySubject.set(summary.subject, summary);

  const rows: Row[] = [...new Set([...allSubjects, ...bySubject.keys()])]
    .filter((subject) => subject.trim().length > 0)
    .map((subject) => {
      const summary = bySubject.get(subject);
      return {
        subject,
        count: summary?.count ?? 0,
        average: summary?.average ?? 0,
      };
    })
    .sort((a, b) => b.average - a.average || b.count - a.count || a.subject.localeCompare(b.subject));

  return (
    <Card elevation={1} padding="md" data-testid="performance-subject-breakdown">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-ink">Subject breakdown</h3>
        <span className="text-xs text-ink-muted" data-testid="performance-subject-count">
          {rows.length} {rows.length === 1 ? 'subject' : 'subjects'}
        </span>
      </div>

      <div className="space-y-4">
        {rows.map((row) => (
          <div
            key={row.subject}
            className="space-y-1.5"
            data-testid="performance-subject-row"
            data-subject={row.subject}
            data-count={row.count}
            data-average={row.average}
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-ink truncate">{row.subject}</span>
              <span className="flex-shrink-0 text-ink-muted" data-testid="performance-subject-meta">
                {row.count === 0
                  ? 'No records yet'
                  : `${row.count} ${row.count === 1 ? 'record' : 'records'} • ${formatPercent(row.average)}`}
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-surface border border-border"
              role="presentation"
            >
              <div
                className={`h-full rounded-full transition-all ${
                  row.count === 0 ? 'bg-transparent' : row.average >= 70 ? 'bg-teal-500' : 'bg-amber-500'
                }`}
                style={{ width: `${row.count === 0 ? 0 : Math.min(row.average, 100)}%` }}
                data-testid="performance-subject-bar"
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
