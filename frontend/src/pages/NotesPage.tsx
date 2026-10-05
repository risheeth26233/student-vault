// Notes Page — every study topic surfaced through its notes field.
// Reuses the existing Topic model (Topic.notes) and the topic store, so notes
// persist through the API when it is reachable and fall back to localStorage
// (the established local/demo mode) when it is not.

import { useEffect, useMemo, useState } from 'react';
import { PageContainer, Section, ContentWrapper } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { useToastHelpers } from '../components/ui/Toast';
import { Skeleton } from '../components/ui/Skeleton';
import { NoteCard } from '../features/notes/NoteCard';
import { TopicFormDialog, type TopicFormValues } from '../features/vault/TopicFormDialog';
import { ConfirmDialog } from '../features/vault/ConfirmDialog';
import {
  useTopics,
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

type ShowFilter = 'all' | 'with' | 'without';

const SHOW_OPTIONS = [
  { value: 'all', label: 'All topics' },
  { value: 'with', label: 'With notes' },
  { value: 'without', label: 'Needs notes' },
];

function sortByUpdated(topics: Topic[]): Topic[] {
  return [...topics].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function NotesPage() {
  const toast = useToastHelpers();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [showFilter, setShowFilter] = useState<ShowFilter>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Topic | null>(null);

  // Debounce search so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const listQuery = useTopics({
    subject: subjectFilter === 'all' ? undefined : subjectFilter,
    search: search || undefined,
  });
  const subjects = useSubjects();

  const createMutation = useCreateTopic();
  const updateMutation = useUpdateTopic();
  const deleteMutation = useDeleteTopic();

  const localMode = getTopicsMode() === 'local';
  const total = listQuery.data?.total ?? 0;

  // Server-side subject/search filters + client-side presence filter & ordering.
  const notes = useMemo(() => {
    const sorted = sortByUpdated(listQuery.data?.topics ?? []);
    if (showFilter === 'with') return sorted.filter((topic) => topic.notes.trim().length > 0);
    if (showFilter === 'without') return sorted.filter((topic) => topic.notes.trim().length === 0);
    return sorted;
  }, [listQuery.data, showFilter]);

  const hasActiveFilters = !!search || subjectFilter !== 'all' || showFilter !== 'all';

  const subjectOptions = useMemo(
    () => [
      { value: 'all', label: 'All subjects' },
      ...subjects.map((subject) => ({ value: subject.name, label: subject.name })),
    ],
    [subjects]
  );

  const handleCreate = async (values: TopicFormValues) => {
    await createMutation.mutateAsync(values);
    toast.success('Note created', `${values.subject} - ${values.title}`);
    // Keep the new note visible even when another subject is filtered.
    if (subjectFilter !== 'all' && subjectFilter !== values.subject) {
      setSubjectFilter(values.subject);
    }
    if (showFilter === 'without' && values.notes.trim()) setShowFilter('all');
  };

  const handleUpdate = async (values: TopicFormValues) => {
    if (!editing) return;
    const id = editing.id;
    await updateMutation.mutateAsync({ id, data: values });
    toast.success('Note updated', `${values.subject} - ${values.title}`);
    if (subjectFilter !== 'all' && subjectFilter !== values.subject) {
      setSubjectFilter(values.subject);
    }
    if (showFilter !== 'all') setShowFilter('all');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    await deleteMutation.mutateAsync(target.id);
    toast.success('Note deleted', `${target.subject} - ${target.title}`);
    if (editing?.id === target.id) setEditing(null);
    setDeleteTarget(null);
  };

  const confirmDelete = () => {
    handleDelete().catch((error: unknown) => {
      toast.error('Could not delete note', error instanceof Error ? error.message : 'Unknown error');
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
    setSubjectFilter('all');
    setShowFilter('all');
  };

  const renderNoteList = () => {
    if (listQuery.isPending) {
      return (
        <div className="grid gap-4 md:grid-cols-2" data-testid="notes-loading">
          {Array.from({ length: 4 }, (_, index) => (
            <Card key={index} elevation={1} padding="md">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton variant="rectangular" width="6rem" height="1.5rem" />
                  <Skeleton variant="text" width="5rem" height="0.75rem" />
                </div>
                <Skeleton variant="text" width="70%" height="1.25rem" />
                <Skeleton variant="text" lines={3} />
              </div>
            </Card>
          ))}
        </div>
      );
    }

    if (listQuery.isError) {
      return (
        <Card elevation={1} padding="lg" className="text-center" data-testid="notes-error">
          <CircleAlert className="w-12 h-12 text-coral-500 mx-auto mb-3" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-ink mb-1">Could not load your notes</h2>
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

    if (notes.length === 0) {
      if (hasActiveFilters) {
        return (
          <EmptyState
            illustration="topics"
            title="No notes match your filters"
            description="Try a different search term, subject or note filter."
            data-testid="notes-empty-filtered"
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
          title="No notes yet"
          description="Write your first note — every note stays linked to a subject and a topic in your Vault."
          data-testid="notes-empty"
          action={
            <Button onClick={() => setCreateOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
              New note
            </Button>
          }
        />
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2" data-testid="notes-list">
        {notes.map((topic) => (
          <NoteCard
            key={topic.id}
            topic={topic}
            onEdit={setEditing}
            onDelete={setDeleteTarget}
            onSelectSubject={setSubjectFilter}
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
            <h1 className="text-3xl font-extrabold text-ink">Notes</h1>
            <p className="text-ink-muted">
              {listQuery.data
                ? `Showing ${notes.length} of ${total} ${total === 1 ? 'note' : 'notes'}${
                    subjectFilter !== 'all' ? ` in ${subjectFilter}` : ''
                  }`
                : 'Quick notes linked to your subjects and topics'}
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            data-testid="notes-create"
          >
            New note
          </Button>
        </header>

        {localMode && (
          <div
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            data-testid="notes-local-banner"
          >
            <p>
              <strong>Working offline.</strong> The server is unreachable, so your notes are being saved
              on this device.
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

        <Section>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-ink-subtle"
                aria-hidden="true"
              />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search notes by title, subject or content"
                aria-label="Search notes"
                data-testid="notes-search"
                className="pl-9"
              />
            </div>
            <div className="sm:w-48">
              <Select
                value={subjectFilter}
                onChange={(event) => setSubjectFilter(event.target.value)}
                options={subjectOptions}
                aria-label="Filter notes by subject"
                data-testid="notes-subject-filter"
              />
            </div>
            <div className="sm:w-44">
              <Select
                value={showFilter}
                onChange={(event) => setShowFilter(event.target.value as ShowFilter)}
                options={SHOW_OPTIONS}
                aria-label="Filter notes by note content"
                data-testid="notes-show-filter"
              />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} leftIcon={<X className="w-4 h-4" />}>
                Clear
              </Button>
            )}
          </div>

          {renderNoteList()}
        </Section>

        {/* Create note — reuses the topic form (a note is a topic's notes field). */}
        <TopicFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          defaultSubject={subjectFilter === 'all' ? null : subjectFilter}
          subjects={subjects.map((subject) => subject.name)}
          onSubmit={handleCreate}
          dialogTitle="New note"
          dialogDescription="Capture a note — it is saved as a study topic so it stays linked to your Vault."
          submitLabel="Create note"
        />

        {/* Edit note */}
        {editing && (
          <TopicFormDialog
            open
            onOpenChange={(open) => !open && setEditing(null)}
            topic={editing}
            subjects={subjects.map((subject) => subject.name)}
            onSubmit={handleUpdate}
            dialogTitle="Edit note"
            dialogDescription="Update this note and the topic it belongs to."
            submitLabel="Save note"
          />
        )}

        {/* Delete note */}
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title={deleteTarget ? `Delete "${deleteTarget.title}"?` : ''}
          description="This note and the topic it belongs to will be removed from your Vault. This cannot be undone."
          confirmLabel="Delete note"
          destructive
          loading={deleteMutation.isPending}
          onConfirm={confirmDelete}
        />
      </ContentWrapper>
    </PageContainer>
  );
}
