// Learning Insights — topic/subject mastery card.
//
// Renders a single MasteryRecord produced by the intelligence layer. It shows
// the honest level (including "insufficient evidence") and exposes the record's
// own contributions as the observed evidence behind the estimate — it never
// re-computes anything.

import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { WhySection } from './WhySection';
import {
  CONFIDENCE_LABEL,
  MASTERY_LEVEL_PRESENTATION,
  SIGNAL_KIND_LABEL,
  formatScorePercent,
} from './insightsViewModel';
import type { MasteryRecord } from '../../types/gurugraph';

export interface MasteryCardProps {
  record: MasteryRecord;
  subjectLabel: string;
}

export function MasteryCard({ record, subjectLabel }: MasteryCardProps) {
  const level = MASTERY_LEVEL_PRESENTATION[record.level];
  const insufficient = record.level === 'insufficient_evidence';

  return (
    <Card elevation={1} padding="md" data-testid={`mastery-card-${record.key}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-ink">{record.label}</h3>
          <p className="text-sm text-ink-muted">{subjectLabel}</p>
        </div>
        <Badge
          variant={level.variant}
          size="sm"
          className="flex-shrink-0"
          data-testid={`mastery-level-${record.key}`}
        >
          {level.label}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        {insufficient ? (
          <span className="text-sm text-ink-muted" data-testid={`mastery-score-${record.key}`}>
            No measurable evidence yet
          </span>
        ) : (
          <>
            <span
              className="text-2xl font-bold text-ink"
              data-testid={`mastery-score-${record.key}`}
            >
              {record.score === null ? '—' : formatScorePercent(record.score)}
            </span>
            <span className="text-sm text-ink-muted">{CONFIDENCE_LABEL[record.confidence]}</span>
          </>
        )}
        <span className="text-xs text-ink-subtle" data-testid={`mastery-count-${record.key}`}>
          {record.evidenceCount} evidence {record.evidenceCount === 1 ? 'signal' : 'signals'}
        </span>
      </div>

      {insufficient && (
        <p className="mt-2 text-sm text-ink-muted" data-testid={`mastery-insufficient-${record.key}`}>
          There is not enough recorded evidence to estimate mastery yet. Log an assessment result,
          tick a study checklist step, or attach a resource to start building evidence.
        </p>
      )}

      <WhySection
        id={`mastery-${record.key}`}
        conclusionTitle="Inferred conclusion"
        conclusion={
          <ul
            className="space-y-1 text-sm text-ink"
            data-testid={`mastery-conclusion-${record.key}`}
          >
            <li>Level: {level.label}</li>
            <li>Score: {record.score === null ? 'not enough evidence' : formatScorePercent(record.score)}</li>
            <li>Confidence: {CONFIDENCE_LABEL[record.confidence]}</li>
            <li className="text-ink-muted">Computed by rule {record.ruleId}</li>
          </ul>
        }
        evidenceTitle="Observed evidence (recorded in Student-Vault)"
        evidence={
          record.contributions.length === 0 ? (
            <p className="text-sm text-ink-muted" data-testid={`mastery-evidence-${record.key}`}>
              No recorded signals contributed to this estimate.
            </p>
          ) : (
            <ul className="space-y-2" data-testid={`mastery-evidence-${record.key}`}>
              {record.contributions.map((contribution) => (
                <li
                  key={contribution.signalId}
                  className="rounded-md border border-border bg-canvas p-2"
                >
                  <p className="text-sm font-medium text-ink">
                    {SIGNAL_KIND_LABEL[contribution.kind]}
                  </p>
                  <p className="text-xs text-ink-muted">{contribution.reason}</p>
                  <p className="text-xs text-ink-subtle">
                    Weight {contribution.weight} · contribution {contribution.weightedValue}
                  </p>
                </li>
              ))}
            </ul>
          )
        }
        footerNote={record.disclaimer}
      />
    </Card>
  );
}
