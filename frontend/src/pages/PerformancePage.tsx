// Academic Performance Page — record quiz/test/exam/assignment results and
// understand them per subject and topic. Descriptive summaries only.

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CircleAlert, Plus, RefreshCw, Search, X } from 'lucide-react';
import { PageContainer, Section, ContentWrapper } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useToastHelpers } from '../components/ui/Toast';
import { ConfirmDialog } from '../features/vault/ConfirmDialog';
import { AssessmentCard } from '../features/performance/AssessmentCard';
import { AssessmentFormDialog } from '../features/performance/AssessmentFormDialog';
import { SubjectBreakdown } from '../features/performance/SubjectBreakdown';
import { TrendChart } from '../features/performance/TrendChart';
import {
  TYPE_OPTIONS,
  assessmentCountLabel,
  computeSummary,
  formatPercent,
  toCreatePayload,
  toUpdatePayload,
  typeLabel,
  type AssessmentFormValues,
} from '../features/performance/performanceUtils';
import {
  useAssessments,
  useCreateAssessment,
  useUpdateAssessment,
  useDeleteAssessment,
  getAssessmentsMode,
  resetAssessmentsMode,
  assessmentsKey,
} from '../hooks/useAssessments';
import { useAllTopics } from '../hooks/useTopics';
import { useSubjects } from '../hooks/useSubjects';
import type { Assessment, AssessmentType } from '../types/api';

function AssessmentSkeleton() {
  return (
    <Card elevation={1} padding="md">
      <div className="space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-8 w-full" />
      </div>
    </Card>
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
      <p className={`mt-1 text-2xl font-bold ${accent ? 'text-teal-600' : 'text-ink'}`} data-testid={`${testId}-value`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </Card>
  );
}

const ALL = 'all';

export function PerformancePage() {
  const toast = useToastHelpers();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const listQuery = useAssessments();
  const createMutation = useCreateAssessment();
  const updateMutation = useUpdateAssessment();
  const deleteMutation = useDeleteAssessment();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Assessment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Assessment | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [subjectFilter, setSubjectFilter] = useState(
    searchParams.get('subject') ?? ALL
  );
  const [typeFilter, setTypeFilter] = useState<AssessmentType | typeof ALL>(
    (searchParams.get('type') as AssessmentType | null) ?? ALL
  );
  const [topicFilter, setTopicFilter] = useState(searchParams.get('topic') ?? ALL);

  const localMode = getAssessmentsMode() === 'local';
  const assessments = useMemo(() => listQuery.data?.assessments ?? [], [listQuery.data]);

  const { data: topicsData } = useAllTopics();
  const allTopics = useMemo(() => topicsData?.topics ?? [], [topicsData]);
  const subjectRegistry = useSubjects();

  const topicOptions = useMemo(
    () =>
      allTopics.map((topic) => ({
        value: topic.id,
        label: `${topic.subject} — ${topic.title}`,
      })),
    [allTopics]
  );

  const topicTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const topic of allTopics) map.set(topic.id, `${topic.subject} — ${topic.title}`);
    return map;
  }, [allTopics]);

  const subjectOptions = useMemo(() => {
    const set = new Set<string>();
    for (const assessment of assessments) set.add(assessment.subject);
    for (const meta of subjectRegistry) set.add(meta.name);
    return Array.from(set)
      .filter((name) => name.trim().length > 0)
      .sort((a, b) => a.localeCompare(b));
  }, [assessments, subjectRegistry]);

  const filtered = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    return assessments.filter((assessment) => {
      if (subjectFilter !== ALL && assessment.subject !== subjectFilter) return false;
      if (typeFilter !== ALL && assessment.type !== typeFilter) return false;
      if (topicFilter !== ALL && assessment.topicId !== topicFilter) return false;
      if (query) {
        const haystack = `${assessment.title} ${assessment.subject}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [assessments, searchInput, subjectFilter, typeFilter, topicFilter]);

  const summary = useMemo(() => computeSummary(assessments), [assessments]);
  const filteredSummary = useMemo(() => computeSummary(filtered), [filtered]);

  const hasFilters =
    searchInput.trim() !== '' ||
    subjectFilter !== ALL ||
    typeFilter !== ALL ||
    topicFilter !== ALL;

  const clearFilters = () => {
    setSearchInput('');
    setSubjectFilter(ALL);
    setTypeFilter(ALL);
    setTopicFilter(ALL);
    if (searchParams.has('subject') || searchParams.has('type') || searchParams.has('topic')) {
      const next = new URLSearchParams(searchParams);
      next.delete('subject');
      next.delete('type');
      next.delete('topic');
      setSearchParams(next, { replace: true });
    }
  };

  const handleOpenCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (assessment: Assessment) => {
    setEditing(assessment);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: AssessmentFormValues) => {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, data: toUpdatePayload(values) });
      toast.success('Record updated', values.title);
    } else {
      await createMutation.mutateAsync(toCreatePayload(values));
      toast.success('Record added', values.title);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    try {
      await deleteMutation.mutateAsync(target.id);
      toast.success('Record deleted', target.title);
      setDeleteTarget(null);
    } catch (error) {
      toast.error('Could not delete record', error instanceof Error ? error.message : 'Unknown error');
      setDeleteTarget(null);
    }
  };

  const handleRetryConnection = () => {
    resetAssessmentsMode();
    queryClient.invalidateQueries({ queryKey: assessmentsKey });
  };

  const renderList = () => {
    if (listQuery.isPending) {
      return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="performance-loading">
          {Array.from({ length: 6 }, (_, index) => (
            <AssessmentSkeleton key={index} />
          ))}
        </div>
      );
    }

    if (listQuery.isError) {
      return (
        <Card elevation={1} padding="lg" className="text-center" data-testid="performance-error">
          <CircleAlert className="w-12 h-12 text-coral-500 mx-auto mb-3" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-ink mb-1">Could not load your results</h2>
          <p className="text-ink-muted mb-4 text-sm">
            {listQuery.error instanceof Error ? listQuery.error.message : 'Unknown error'}
          </p>
          <Button
            variant="outline"
            leftIcon={<RefreshCw className="w-4 h-4" />}
            onClick={() => listQuery.refetch()}
          >
            Try again
          </Button>
        </Card>
      );
    }

    if (assessments.length === 0) {
      return (
        <EmptyState
          title="No results recorded yet"
          description="Log your quizzes, tests, exams and assignment marks to see your performance."
          illustration="topics"
          action={
            <Button leftIcon={<Plus className="w-4 h-4" />} onClick={handleOpenCreate} data-testid="performance-empty-add">
              Add your first result
            </Button>
          }
          data-testid="performance-empty"
        />
      );
    }

    if (filtered.length === 0) {
      return (
        <EmptyState
          title="No records match your filters"
          description="Try a different search term, or clear the filters."
          illustration="topics"
          action={
            <Button variant="outline" onClick={clearFilters} leftIcon={<X className="w-4 h-4" />}>
              Clear filters
            </Button>
          }
          data-testid="performance-no-match"
        />
      );
    }

    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="performance-list">
        {filtered.map((assessment) => (
          <AssessmentCard
            key={assessment.id}
            assessment={assessment}
            topicTitle={assessment.topicId ? topicTitleById.get(assessment.topicId) : undefined}
            onEdit={handleOpenEdit}
            onDelete={setDeleteTarget}
          />
        ))}
      </div>
    );
  };

  return (
    <PageContainer>
      <ContentWrapper className="max-w-6xl">
        <header className="page-header">
          <div>
            <h1 className="text-3xl font-extrabold text-ink">Academic Performance</h1>
            <p className="text-ink-muted">
              {listQuery.data
                ? `${assessmentCountLabel(summary.count)} • Average ${formatPercent(summary.average)} • ${
                    summary.subjects.length
                  } ${summary.subjects.length === 1 ? 'subject' : 'subjects'}`
                : 'Track your results over time'}
            </p>
          </div>
          <Button leftIcon={<Plus className="w-4 h-4" />} onClick={handleOpenCreate} data-testid="performance-add">
            Add record
          </Button>
        </header>

        {localMode && (
          <div
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            data-testid="performance-local-banner"
          >
            <p>
              <strong>Working offline.</strong> The server is unreachable, so your changes are being
              saved on this device.
            </p>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={handleRetryConnection}
            >
              Retry connection
            </Button>
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            testId="performance-stat-average"
            label="Average score"
            value={summary.count > 0 ? formatPercent(summary.average) : '—'}
            hint={summary.count > 0 ? `Across ${assessmentCountLabel(summary.count)}` : 'No records yet'}
            accent
          />
          <StatCard testId="performance-stat-records" label="Records" value={summary.count} />
          <StatCard
            testId="performance-stat-subjects"
            label="Subjects"
            value={summary.subjects.length}
            hint={`${subjectRegistry.length} tracked subjects`}
          />
          <StatCard
            testId="performance-stat-best"
            label="Best result"
            value={summary.count > 0 ? formatPercent(summary.highest) : '—'}
            hint={summary.count > 0 ? `Lowest ${formatPercent(summary.lowest)}` : undefined}
          />
        </div>

        {summary.count > 0 && (
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <SubjectBreakdown summaries={summary.subjects} allSubjects={subjectOptions} />
            <TrendChart trend={summary.trend} average={summary.average} />
          </div>
        )}

        <Section className="mb-6">
          <Card elevation={1} padding="md">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-ink" htmlFor="performance-search-input">
                  Search
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-ink-subtle"
                    aria-hidden="true"
                  />
                  <Input
                    id="performance-search-input"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search records"
                    aria-label="Search records"
                    className="pl-9"
                    data-testid="performance-search"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:w-auto lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink" htmlFor="performance-subject-filter">
                    Subject
                  </label>
                  <Select
                    id="performance-subject-filter"
                    value={subjectFilter}
                    onChange={(event) => setSubjectFilter(event.target.value)}
                    options={[
                      { value: ALL, label: 'All subjects' },
                      ...subjectOptions.map((subject) => ({ value: subject, label: subject })),
                    ]}
                    aria-label="Filter records by subject"
                    data-testid="performance-subject-filter"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-ink" htmlFor="performance-type-filter">
                    Type
                  </label>
                  <Select
                    id="performance-type-filter"
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value as AssessmentType | typeof ALL)}
                    options={[
                      { value: ALL, label: 'All types' },
                      ...TYPE_OPTIONS.map((value) => ({ value, label: typeLabel(value) })),
                    ]}
                    aria-label="Filter records by type"
                    data-testid="performance-type-filter"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-ink" htmlFor="performance-topic-filter">
                    Topic
                  </label>
                  <Select
                    id="performance-topic-filter"
                    value={topicFilter}
                    onChange={(event) => setTopicFilter(event.target.value)}
                    options={[
                      { value: ALL, label: 'All topics' },
                      ...topicOptions.map((option) => ({ value: option.value, label: option.label })),
                    ]}
                    aria-label="Filter records by topic"
                    data-testid="performance-topic-filter"
                  />
                </div>
              </div>

              {hasFilters && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  leftIcon={<X className="w-4 h-4" />}
                  data-testid="performance-clear"
                >
                  Clear
                </Button>
              )}
            </div>
          </Card>
        </Section>

        <Section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-ink-muted" data-testid="performance-count">
              {filtered.length} of {assessments.length} {assessments.length === 1 ? 'record' : 'records'}
            </p>
            {hasFilters && (
              <Badge variant="default" size="sm" data-testid="performance-filtered-badge">
                Filtered • Avg {formatPercent(filteredSummary.average)}
              </Badge>
            )}
          </div>

          {renderList()}
        </Section>

        <AssessmentFormDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditing(null);
          }}
          assessment={editing}
          subjects={subjectOptions}
          topics={allTopics}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          onSubmit={handleSubmit}
        />

        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title={deleteTarget ? `Delete ${deleteTarget.title}?` : ''}
          description="This record will be removed permanently. This cannot be undone."
          confirmLabel="Delete record"
          destructive
          loading={deleteMutation.isPending}
          onConfirm={handleDelete}
        />
      </ContentWrapper>
    </PageContainer>
  );
}
