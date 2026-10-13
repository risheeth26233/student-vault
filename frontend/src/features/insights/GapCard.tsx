// Learning Insights — candidate learning-gap card.
//
// Renders a single LearningGap produced by the intelligence layer. The finding
// is always framed as a candidate with one of five distinguishable states, and
// the card shows the exact records behind it as observed evidence.

import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { WhySection } from './WhySection';
import {
  GAP_CATEGORY_PRESENTATION,
  SEVERITY_PRESENTATION,
  activeDistinguishers,
} from './insightsViewModel';
import type { EvidenceRef, LearningGap } from '../../types/gurugraph';

function evidenceLine(evidence: EvidenceRef): string {
  return `${evidence.detail}${evidence.observedAt ? ` · ${evidence.observedAt.slice(0, 10)}` : ''}`;
}

export function GapCard({ gap }: { gap: LearningGap }) {
  const category = GAP_CATEGORY_PRESENTATION[gap.category];
  const severity = SEVERITY_PRESENTATION[gap.severity];
  const distinguishers = activeDistinguishers(gap);

  return (
    <Card elevation={1} padding="md" data-testid={`gap-card-${gap.id}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-base font-semibold text-ink">{gap.label}</h3>
        <div className="flex flex-shrink-0 gap-1.5">
          <Badge variant={category.variant} size="sm" data-testid={`gap-category-${gap.id}`}>
            {category.label}
          </Badge>
          <Badge variant={severity.variant} size="sm" data-testid={`gap-severity-${gap.id}`}>
            {severity.label}
          </Badge>
        </div>
      </div>

      <p className="mt-2 text-sm font-medium text-ink">{gap.reason}</p>
      <p className="mt-1 text-sm text-ink-muted" data-testid={`gap-detail-${gap.id}`}>
        {gap.detail}
      </p>

      <WhySection
        id={`gap-${gap.id}`}
        conclusionTitle="Classified conclusion"
        conclusion={
          <ul className="space-y-1 text-sm text-ink" data-testid={`gap-conclusion-${gap.id}`}>
            <li>Category: {category.label}</li>
            <li>Severity: {severity.label}</li>
            <li>Status: candidate (not confirmed)</li>
            <li className="text-ink-muted">
              Flags: {distinguishers.length > 0 ? distinguishers.join(', ') : 'none'}
            </li>
            <li className="text-ink-muted">Rule: {gap.ruleId}</li>
          </ul>
        }
        evidenceTitle="Observed evidence (recorded in Student-Vault)"
        evidence={
          gap.evidence.length === 0 ? (
            <p className="text-sm text-ink-muted" data-testid={`gap-evidence-${gap.id}`}>
              No individual records were referenced for this finding.
            </p>
          ) : (
            <ul className="space-y-2" data-testid={`gap-evidence-${gap.id}`}>
              {gap.evidence.map((evidence, index) => (
                <li
                  key={`${evidence.sourceId}-${index}`}
                  className="rounded-md border border-border bg-canvas p-2"
                >
                  <p className="text-sm font-medium text-ink">{evidence.label}</p>
                  <p className="text-xs text-ink-muted">{evidenceLine(evidence)}</p>
                </li>
              ))}
            </ul>
          )
        }
        footerNote={gap.disclaimer}
      />
    </Card>
  );
}
