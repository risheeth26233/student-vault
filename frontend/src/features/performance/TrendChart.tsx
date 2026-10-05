// Score trend over time — a small chronological bar chart of recorded results.

import { Card } from '../../components/ui/Card';
import { formatPercent, type TrendPoint } from './performanceUtils';

export interface TrendChartProps {
  trend: TrendPoint[];
  average: number;
}

function shortLabel(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function TrendChart({ trend, average }: TrendChartProps) {
  return (
    <Card elevation={1} padding="md" data-testid="performance-trend">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-ink">Score trend</h3>
        <span className="text-xs text-ink-muted" data-testid="performance-trend-average">
          Average {formatPercent(average)}
        </span>
      </div>

      <div className="flex h-40 items-end gap-1.5 sm:gap-2" data-testid="performance-trend-bars">
        {trend.map((point) => {
          const height = Math.max(Math.min(point.percentage, 100), 4);
          const strong = point.percentage >= 70;
          return (
            <div key={point.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] font-medium text-ink-muted" aria-hidden="true">
                {Math.round(point.percentage)}
              </span>
              <div
                className={`w-full rounded-t-md ${strong ? 'bg-teal-500' : 'bg-amber-500'}`}
                style={{ height: `${height}%` }}
                title={`${point.subject} — ${point.title}: ${formatPercent(point.percentage)}`}
                data-testid="performance-trend-bar"
                data-percent={point.percentage}
                data-subject={point.subject}
                data-title={point.title}
              />
              <span className="w-full truncate text-center text-[10px] text-ink-subtle" aria-hidden="true">
                {shortLabel(point.date)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        Chronological view of your last {trend.length} {trend.length === 1 ? 'result' : 'results'}.
      </p>
    </Card>
  );
}
