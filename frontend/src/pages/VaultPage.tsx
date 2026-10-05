// Vault Page — subjects, topics, notes, checklist and filters

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageContainer, Section, ContentWrapper } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { useToastHelpers } from '../components/ui/Toast';
import { TopicCardSkeleton } from '../components/ui/Skeleton';
import { TopicCard } from '../features/vault/TopicCard';
import { TopicFormDialog, type TopicFormValues } from '../features/vault/TopicFormDialog';
import { SubjectPanel } from '../features/vault/SubjectPanel';
import { ConfirmDialog } from '../features/vault/ConfirmDialog';
import {
  useTopics,
  useAllTopics,
  useTopic,
  useCreateTopic,
  useUpdateTopic,
  useDeleteTopic,
  topicsKey,
  getTopicsMode,
  resetTopicsMode,
} from '../hooks/useTopics';
import { useSubjects } from '../hooks/useSubjects';
import { useQueryClient } from '@tanstack/react-query';
import { CircleAlert, Plus, RefreshCw, Search, X } from 'lucide-react';
import type { Topic } from '../types/api';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'learning', label: 'Learning' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'ready', label: 'Ready' },
];

export function VaultPage() {
  const toast = useToastHelpers();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedSubject = searchParams.get('subject');
  const linkedTopicId = searchParams.get('topic');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'learning' | 'reviewing' | 'ready'>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Topic | null>(null);

  // Debounce search so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const listQuery = useTopics({
    subject: selectedSubject ?? undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: search || undefined,
  });
  const allTopicsQuery = useAllTopics();
  const subjects = useSubjects();

  // Support /vault?topic=<id> deep links (used by the dashboard).
  const { data: linkedTopic } = useTopic(linkedTopicId ?? '');
  useEffect(() => {
    if (linkedTopicId && linkedTopic && !editing) setEditing(linkedTopic);
  }, [linkedTopicId, linkedTopic, editing]);

  const createMutation = useCreateTopic();
  const updateMutation = useUpdateTopic();
  const deleteMutation = useDeleteTopic();

  const localMode = getTopicsMode() === 'local';
  const topics = useMemo(() => listQuery.data?.topics ?? [], [listQuery.data]);
  const hasActiveFilters = !!selectedSubject || statusFilter !== 'all' || !!search;

  const setSubject = (subject: string | null) => {
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        if (subject) next.set('subject', subject);
        else next.delete('subject');
        return next;
      },
      { replace: true }
    );
  };

  const clearLinkedTopic = () => {
    if (!linkedTopicId) return;
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        next.delete('topic');
        return next;
      },
      { replace: true }
    );
  };

  const closeCreate = () => {
    setCreateOpen(false);
  };

  const closeEdit = () => {
    setEditing(null);
    clearLinkedTopic();
  };

  const handleCreate = async (values: TopicFormValues) => {
    await createMutation.mutateAsync(values);
    toast.success('Topic created', `${values.subject} - ${values.title}`);
    // Make sure the new topic is visible even when another subject is filtered.
    if (selectedSubject && selectedSubject !== values.subject) setSubject(values.subject);
  };

  const handleUpdate = async (values: TopicFormValues) => {
    if (!editing) return;
    const id = editing.id;
    await updateMutation.mutateAsync({ id, data: values });
    toast.success('Topic updated', `${values.subject} - ${values.title}`);
    if (selectedSubject && selectedSubject !== values.subject) setSubject(values.subject);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    await deleteMutation.mutateAsync(target.id);
    toast.success('Topic deleted', `${target.subject} - ${target.title}`);
    if (editing?.id === target.id) closeEdit();
    setDeleteTarget(null);
  };

  const confirmDelete = () => {
    handleDelete().catch((error: unknown) => {
      toast.error('Could not delete topic', error instanceof Error ? error.message : 'Unknown error');
      setDeleteTarget(null);
    });
  };

  const handleRetryConnection = () => {
    resetTopicsMode();
    queryClient.invalidateQueries({ queryKey: topicsKey });
    queryClient.invalidateQueries({ queryKey: ['subjects'] });
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatusFilter('all');
    setSubject(null);
  };

  const renderTopicList = () => {
    if (listQuery.isPending) {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Card key={index} elevation={1} padding="md">
              <TopicCardSkeleton />
            </Card>
          ))}
        </div>
      );
    }

    if (listQuery.isError) {
      return (
        <Card elevation={1} padding="lg" className="text-center">
          <CircleAlert className="w-12 h-12 text-coral-500 mx-auto mb-3" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-ink mb-1">Could not load your topics</h2>
          <p className="text-ink-muted mb-4 text-sm">{listQuery.error.message}</p>
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

    if (topics.length === 0) {
      if (hasActiveFilters) {
        return (
          <EmptyState
            illustration="topics"
            title="No topics match your filters"
            description="Try a different search term, status or subject."
            action={
              <Button variant="outline" onClick={clearFilters} leftIcon={<X className="w-4 h-4" />}>
                Clear filters
              </Button>
            }
          />
        );
      }
      return (
        <EmptyState
          illustration="topics"
          title="No study topics yet"
          description="Create your first topic to start organizing your studies."
          action={
            <Button onClick={() => setCreateOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
              New topic
            </Button>
          }
        />
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2">
        {topics.map((topic) => (
          <TopicCard
            key={topic.id}
            topic={topic}
            onEdit={setEditing}
            onDelete={setDeleteTarget}
            onSelectSubject={setSubject}
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
            <h1 className="text-3xl font-extrabold text-ink">My Vault</h1>
            <p className="text-ink-muted">
              {listQuery.data
                ? `Showing ${topics.length} of ${listQuery.data.total} ${
                    listQuery.data.total === 1 ? 'topic' : 'topics'
                  }${selectedSubject ? ` in ${selectedSubject}` : ''}`
                : 'Subjects, topics, notes and exam prep in one place'}
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
            New topic
          </Button>
        </header>

        {localMode && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p>
              <strong>Working offline.</strong> The server is unreachable, so your changes are being saved
              on this device.
            </p>
            <Button size="sm" variant="outline" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={handleRetryConnection}>
              Retry connection
            </Button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Subjects */}
          <aside className="lg:col-span-3">
            <SubjectPanel selected={selectedSubject} onSelect={setSubject} isLoading={allTopicsQuery.isPending} />
          </aside>

          {/* Topics */}
          <Section className="lg:col-span-9">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-ink-subtle"
                  aria-hidden="true"
                />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search topics, subjects or notes"
                  aria-label="Search topics"
                  className="pl-9"
                />
              </div>
              <div className="sm:w-48">
                <Select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                  options={STATUS_OPTIONS}
                  aria-label="Filter by status"
                />
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} leftIcon={<X className="w-4 h-4" />}>
                  Clear
                </Button>
              )}
            </div>

            {renderTopicList()}
          </Section>
        </div>

        {/* Create topic */}
        <TopicFormDialog
          open={createOpen}
          onOpenChange={closeCreate}
          defaultSubject={selectedSubject}
          subjects={subjects.map((subject) => subject.name)}
          onSubmit={handleCreate}
        />

        {/* Edit topic */}
        {editing && (
          <TopicFormDialog
            open
            onOpenChange={(open) => !open && closeEdit()}
            topic={editing}
            subjects={subjects.map((subject) => subject.name)}
            onSubmit={handleUpdate}
          />
        )}

        {/* Delete topic */}
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title={deleteTarget ? `Delete ${deleteTarget.title}?` : ''}
          description="The topic, its notes and any attached resources will be removed. This cannot be undone."
          confirmLabel="Delete topic"
          destructive
          loading={deleteMutation.isPending}
          onConfirm={confirmDelete}
        />
      </ContentWrapper>
    </PageContainer>
  );
}
