// Assignments Page — homework, projects and coursework with due dates,
// priorities, statuses and Vault topic links.

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
import { AssignmentCard } from '../features/assignments/AssignmentCard';
import { AssignmentFormDialog } from '../features/assignments/AssignmentFormDialog';
import {
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  assignmentCountLabel,
  dueTreatment,
  priorityLabel,
  statusLabel,
  toCreatePayload,
  toUpdatePayload,
  type AssignmentFormValues,
} from '../features/assignments/assignmentUtils';
import {
  useAssignments,
  useCreateAssignment,
  useUpdateAssignment,
  useDeleteAssignment,
  getAssignmentsMode,
  resetAssignmentsMode,
  assignmentsKey,
} from '../hooks/useAssignments';
import { useAllTopics } from '../hooks/useTopics';
import { useSubjects } from '../hooks/useSubjects';
import type { Assignment, AssignmentPriority, AssignmentStatus } from '../types/api';

function AssignmentSkeleton() {
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

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <Card elevation={1} padding="md">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? 'text-coral-600' : 'text-ink'}`}>{value}</p>
    </Card>
  );
}

const ALL = 'all';

export function AssignmentsPage() {
  const toast = useToastHelpers();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const listQuery = useAssignments();
  const createMutation = useCreateAssignment();
  const updateMutation = useUpdateAssignment();
  const deleteMutation = useDeleteAssignment();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [subjectFilter, setSubjectFilter] = useState(ALL);
  const [topicFilter, setTopicFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | typeof ALL>(
    (searchParams.get('status') as AssignmentStatus | null) ?? ALL
  );
  const [priorityFilter, setPriorityFilter] = useState<AssignmentPriority | typeof ALL>(ALL);

  const localMode = getAssignmentsMode() === 'local';
  const assignments = useMemo(() => listQuery.data?.assignments ?? [], [listQuery.data]);

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
    for (const assignment of assignments) set.add(assignment.subject);
    for (const meta of subjectRegistry) set.add(meta.name);
    return Array.from(set)
      .filter((name) => name.trim().length > 0)
      .sort((a, b) => a.localeCompare(b));
  }, [assignments, subjectRegistry]);

  const filtered = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    return assignments.filter((assignment) => {
      if (subjectFilter !== ALL && assignment.subject !== subjectFilter) return false;
      if (topicFilter !== ALL && assignment.topicId !== topicFilter) return false;
      if (statusFilter !== ALL && assignment.status !== statusFilter) return false;
      if (priorityFilter !== ALL && assignment.priority !== priorityFilter) return false;
      if (query) {
        const haystack = `${assignment.title} ${assignment.subject} ${assignment.description}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [assignments, searchInput, subjectFilter, topicFilter, statusFilter, priorityFilter]);

  const stats = useMemo(() => {
    let overdue = 0;
    let dueSoon = 0;
    let completed = 0;
    for (const assignment of assignments) {
      if (assignment.status === 'completed') {
        completed += 1;
        continue;
      }
      const kind = dueTreatment(assignment.dueDate, assignment.status).kind;
      if (kind === 'overdue') overdue += 1;
      else if (kind === 'today' || kind === 'tomorrow' || kind === 'soon') dueSoon += 1;
    }
    return { overdue, dueSoon, completed, total: assignments.length };
  }, [assignments]);

  const hasFilters =
    searchInput.trim() !== '' ||
    subjectFilter !== ALL ||
    topicFilter !== ALL ||
    statusFilter !== ALL ||
    priorityFilter !== ALL;

  const clearFilters = () => {
    setSearchInput('');
    setSubjectFilter(ALL);
    setTopicFilter(ALL);
    setPriorityFilter(ALL);
    setStatusFilter(ALL);
    if (searchParams.has('status')) {
      searchParams.delete('status');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const handleOpenCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (assignment: Assignment) => {
    setEditing(assignment);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: AssignmentFormValues) => {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, data: toUpdatePayload(values) });
      toast.success('Assignment updated', values.title);
    } else {
      await createMutation.mutateAsync(toCreatePayload(values));
      toast.success('Assignment added', values.title);
    }
  };

  const handleStatusChange = async (assignment: Assignment, status: AssignmentStatus) => {
    try {
      await updateMutation.mutateAsync({ id: assignment.id, data: { status } });
      toast.success('Status updated', `${assignment.title} → ${statusLabel(status)}`);
    } catch (error) {
      toast.error('Could not update status', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    try {
      await deleteMutation.mutateAsync(target.id);
      toast.success('Assignment deleted', target.title);
      setDeleteTarget(null);
    } catch (error) {
      toast.error('Could not delete assignment', error instanceof Error ? error.message : 'Unknown error');
      setDeleteTarget(null);
    }
  };

  const handleRetryConnection = () => {
    resetAssignmentsMode();
    queryClient.invalidateQueries({ queryKey: assignmentsKey });
  };

  const renderList = () => {
    if (listQuery.isPending) {
      return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="assignments-loading">
          {Array.from({ length: 6 }, (_, index) => (
            <AssignmentSkeleton key={index} />
          ))}
        </div>
      );
    }

    if (listQuery.isError) {
      return (
        <Card elevation={1} padding="lg" className="text-center" data-testid="assignments-error">
          <CircleAlert className="w-12 h-12 text-coral-500 mx-auto mb-3" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-ink mb-1">Could not load your assignments</h2>
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

    if (assignments.length === 0) {
      return (
        <EmptyState
          title="No assignments yet"
          description="Add homework, projects and coursework to keep every deadline in one place."
          illustration="topics"
          action={
            <Button leftIcon={<Plus className="w-4 h-4" />} onClick={handleOpenCreate} data-testid="assignments-empty-add">
              Add your first assignment
            </Button>
          }
          data-testid="assignments-empty"
        />
      );
    }

    if (filtered.length === 0) {
      return (
        <EmptyState
          title="No assignments match your filters"
          description="Try a different search term, or clear the filters."
          illustration="topics"
          action={
            <Button variant="outline" onClick={clearFilters} leftIcon={<X className="w-4 h-4" />}>
              Clear filters
            </Button>
          }
          data-testid="assignments-no-match"
        />
      );
    }

    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="assignments-list">
        {filtered.map((assignment) => (
          <AssignmentCard
            key={assignment.id}
            assignment={assignment}
            topicTitle={assignment.topicId ? topicTitleById.get(assignment.topicId) : undefined}
            onEdit={handleOpenEdit}
            onDelete={setDeleteTarget}
            onStatusChange={handleStatusChange}
            statusBusy={updateMutation.isPending}
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
            <h1 className="text-3xl font-extrabold text-ink">Assignments</h1>
            <p className="text-ink-muted">
              {listQuery.data
                ? `${assignmentCountLabel(stats.total)} • ${stats.dueSoon} due soon • ${stats.overdue} overdue`
                : 'Keep every deadline in one place'}
            </p>
          </div>
          <Button leftIcon={<Plus className="w-4 h-4" />} onClick={handleOpenCreate} data-testid="assignments-add">
            Add assignment
          </Button>
        </header>

        {localMode && (
          <div
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            data-testid="assignments-local-banner"
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
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Due soon" value={stats.dueSoon} />
          <StatCard label="Overdue" value={stats.overdue} accent={stats.overdue > 0} />
          <StatCard label="Completed" value={stats.completed} />
        </div>

        <Section className="mb-6">
          <Card elevation={1} padding="md">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-ink" htmlFor="assignments-search-input">
                  Search
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-ink-subtle"
                    aria-hidden="true"
                  />
                  <Input
                    id="assignments-search-input"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search assignments"
                    aria-label="Search assignments"
                    className="pl-9"
                    data-testid="assignments-search"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink" htmlFor="assignments-subject-filter">
                    Subject
                  </label>
                  <Select
                    id="assignments-subject-filter"
                    value={subjectFilter}
                    onChange={(event) => setSubjectFilter(event.target.value)}
                    options={[
                      { value: ALL, label: 'All subjects' },
                      ...subjectOptions.map((subject) => ({ value: subject, label: subject })),
                    ]}
                    aria-label="Filter assignments by subject"
                    data-testid="assignments-subject-filter"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-ink" htmlFor="assignments-status-filter">
                    Status
                  </label>
                  <Select
                    id="assignments-status-filter"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as AssignmentStatus | typeof ALL)}
                    options={[
                      { value: ALL, label: 'All statuses' },
                      ...STATUS_OPTIONS.map((value) => ({ value, label: statusLabel(value) })),
                    ]}
                    aria-label="Filter assignments by status"
                    data-testid="assignments-status-filter"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-ink" htmlFor="assignments-priority-filter">
                    Priority
                  </label>
                  <Select
                    id="assignments-priority-filter"
                    value={priorityFilter}
                    onChange={(event) => setPriorityFilter(event.target.value as AssignmentPriority | typeof ALL)}
                    options={[
                      { value: ALL, label: 'All priorities' },
                      ...PRIORITY_OPTIONS.map((value) => ({ value, label: priorityLabel(value) })),
                    ]}
                    aria-label="Filter assignments by priority"
                    data-testid="assignments-priority-filter"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-ink" htmlFor="assignments-topic-filter">
                    Topic
                  </label>
                  <Select
                    id="assignments-topic-filter"
                    value={topicFilter}
                    onChange={(event) => setTopicFilter(event.target.value)}
                    options={[
                      { value: ALL, label: 'All topics' },
                      ...topicOptions.map((option) => ({ value: option.value, label: option.label })),
                    ]}
                    aria-label="Filter assignments by topic"
                    data-testid="assignments-topic-filter"
                  />
                </div>
              </div>

              {hasFilters && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  leftIcon={<X className="w-4 h-4" />}
                  data-testid="assignments-clear"
                >
                  Clear
                </Button>
              )}
            </div>
          </Card>
        </Section>

        <Section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-ink-muted" data-testid="assignments-count">
              {filtered.length} of {assignments.length} {assignments.length === 1 ? 'assignment' : 'assignments'}
            </p>
            {hasFilters && (
              <Badge variant="default" size="sm">
                Filtered
              </Badge>
            )}
          </div>

          {renderList()}
        </Section>

        <AssignmentFormDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditing(null);
          }}
          assignment={editing}
          subjects={subjectOptions}
          topics={allTopics}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          onSubmit={handleSubmit}
        />

        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title={deleteTarget ? `Delete ${deleteTarget.title}?` : ''}
          description="This assignment will be removed permanently. This cannot be undone."
          confirmLabel="Delete assignment"
          destructive
          loading={deleteMutation.isPending}
          onConfirm={handleDelete}
        />
      </ContentWrapper>
    </PageContainer>
  );
}
