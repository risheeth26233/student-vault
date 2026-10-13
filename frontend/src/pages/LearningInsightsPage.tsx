// Learning Insights Page — read-only GuruGraph intelligence surface.
//
// Consumes the existing `useGuruGraphIntelligence` integration (never
// re-implements it) and renders deterministic mastery estimates and candidate
// learning gaps. It never writes back to any Student-Vault store and never
// claims a conclusion the intelligence layer did not reach.

import { CircleAlert, Lightbulb, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { PageContainer, Section, ContentWrapper } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useGuruGraphIntelligence } from '../gurugraph';
import { buildInsightsViewModel } from '../features/insights/insightsViewModel';
import { MasteryCard } from '../features/insights/MasteryCard';
import { GapCard } from '../features/insights/GapCard';

function InsightsSkeleton() {
  return (
    <div className="space-y-6" data-testid="insights-loading">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} elevation={1} padding="md">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-2 h-8 w-1/2" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index} elevation={1} padding="md">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-2 h-4 w-1/3" />
            <Skeleton className="mt-3 h-10 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
  testId,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
  testId: string;
}) {
  return (
    <Card elevation={1} padding="md" data-testid={testId}>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${accent ? 'text-teal-600' : 'text-ink'}`}
        data-testid={`${testId}-value`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </Card>
  );
}

export function LearningInsightsPage() {
  const { snapshot, isLoading, error } = useGuruGraphIntelligence();
  const queryClient = useQueryClient();
  const vm = buildInsightsViewModel(snapshot);

  const handleRetry = () => {
    queryClient.invalidateQueries();
  };

  const showError = Boolean(error) && !snapshot;
  const showStaleBanner = Boolean(error) && Boolean(snapshot);

  return (
    <PageContainer>
      <ContentWrapper className="max-w-6xl">
        <header className="page-header">
          <div>
            <h1 className="text-3xl font-extrabold text-ink">Learning Insights</h1>
            <p className="text-ink-muted">
              Deterministic mastery estimates and candidate learning gaps, derived only from the
              records already in your vault.
            </p>
          </div>
          <span className="hidden h-12 w-12 flex-shrink-0 rounded-xl bg-teal-50 items-center justify-center sm:flex" aria-hidden="true">
            <Lightbulb className="h-6 w-6 text-teal-600" />
          </span>
        </header>

        {showStaleBanner && (
          <div
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            data-testid="insights-stale-banner"
          >
            <p>
              <strong>Some data could not be refreshed.</strong> Showing the last insights computed
              on this device.
            </p>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={handleRetry}
              data-testid="insights-stale-retry"
            >
              Try again
            </Button>
          </div>
        )}

        {isLoading ? (
          <InsightsSkeleton />
        ) : showError ? (
          <Card elevation={1} padding="lg" className="text-center" data-testid="insights-error">
            <CircleAlert className="mx-auto mb-3 h-12 w-12 text-coral-500" aria-hidden="true" />
            <h2 className="mb-1 text-lg font-semibold text-ink">Could not load your insights</h2>
            <p className="mb-4 text-sm text-ink-muted">
              {error instanceof Error ? error.message : 'Your records could not be reached.'}
            </p>
            <Button
              variant="outline"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={handleRetry}
              data-testid="insights-error-retry"
            >
              Try again
            </Button>
          </Card>
        ) : !vm.hasAnyRecords ? (
          <EmptyState
            title="No learning data yet"
            description="Add topics, log assessment results, or track attendance and your insights will appear here."
            illustration="topics"
            data-testid="insights-empty"
          />
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                testId="insights-stat-topics"
                label="Topics analysed"
                value={vm.topics}
                hint={`${vm.subjects} ${vm.subjects === 1 ? 'subject' : 'subjects'}`}
              />
              <StatCard
                testId="insights-stat-evidence"
                label="With mastery evidence"
                value={vm.topicsWithEvidence}
                hint={
                  vm.topicsInsufficientEvidence > 0
                    ? `${vm.topicsInsufficientEvidence} still insufficient`
                    : undefined
                }
                accent
              />
              <StatCard
                testId="insights-stat-gaps"
                label="Candidate gaps"
                value={vm.potentialGapCount}
                hint={vm.gapCount > vm.potentialGapCount ? `${vm.gapCount} findings total` : undefined}
              />
              <StatCard
                testId="insights-stat-signals"
                label="Signals considered"
                value={vm.signals}
                hint="Read-only from your records"
              />
            </div>

            {vm.subjectMastery.length > 0 && (
              <Section
                className="mb-8"
                title="Subject overview"
                description="Rolling mastery estimate per subject, from the same evidence."
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {vm.subjectMastery.map(({ record, subjectLabel }) => (
                    <MasteryCard key={record.key} record={record} subjectLabel={subjectLabel} />
                  ))}
                </div>
              </Section>
            )}

            <Section
              className="mb-8"
              title="Topic mastery"
              description="An honest estimate per topic. Where evidence is thin it says so rather than guessing."
            >
              {vm.topicMastery.length === 0 ? (
                <Card elevation={0} padding="md" data-testid="insights-no-topics">
                  <p className="text-sm text-ink-muted">
                    No topics were recognised in your records yet.
                  </p>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {vm.topicMastery.map(({ record, subjectLabel }) => (
                    <MasteryCard key={record.key} record={record} subjectLabel={subjectLabel} />
                  ))}
                </div>
              )}
            </Section>

            <Section
              className="mb-8"
              title="Learning gaps"
              description="Candidate findings grouped by their state. None are confirmed diagnoses."
            >
              {vm.gapCount === 0 ? (
                <Card elevation={0} padding="md" data-testid="insights-no-gaps">
                  <p className="text-sm text-ink-muted">
                    No learning-gap candidates were detected from your current records.
                  </p>
                </Card>
              ) : (
                <div className="space-y-6">
                  {vm.gapGroups.map((group) => (
                    <div key={group.category}>
                      <div className="mb-3 flex items-center gap-2">
                        <Badge variant={group.variant} size="sm">
                          {group.label}
                        </Badge>
                        <span className="text-sm text-ink-muted">
                          {group.gaps.length} {group.gaps.length === 1 ? 'finding' : 'findings'}
                        </span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {group.gaps.map((gap) => (
                          <GapCard key={gap.id} gap={gap} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section
              title="Supported gap categories"
              description="GuruGraph keeps five states deliberately distinguishable. Only candidate findings are ever shown."
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {vm.supportedCategories.map((category) => (
                  <Card key={category.category} elevation={0} padding="sm" data-testid={`insights-legend-${category.category}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{category.label}</span>
                      <Badge
                        size="sm"
                        variant={category.reserved ? 'default' : category.emitted ? 'info' : 'default'}
                      >
                        {category.reserved ? 'Reserved' : category.emitted ? 'Present' : 'None now'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">{category.description}</p>
                  </Card>
                ))}
              </div>
            </Section>

            <p className="mt-8 text-xs text-ink-subtle" data-testid="insights-disclaimer">
              Insights are deterministic summaries of the records already in your vault. They are
              study guidance, not a validated assessment of what you know.
            </p>
          </>
        )}
      </ContentWrapper>
    </PageContainer>
  );
}
