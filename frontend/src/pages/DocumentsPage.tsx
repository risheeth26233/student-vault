// Documents Page — every PDF and image resource across the Vault.
// Reuses the existing Resource model and resource store, so documents persist
// through the API when it is reachable and fall back to IndexedDB (the
// established local/demo storage, shared with the legacy app) when it is not.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CircleAlert, Plus, RefreshCw, Search, X } from 'lucide-react';
import { PageContainer, Section, ContentWrapper } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useToastHelpers } from '../components/ui/Toast';
import { DocumentCard } from '../features/documents/DocumentCard';
import { AddDocumentDialog } from '../features/documents/AddDocumentDialog';
import { documentKind } from '../features/documents/documentUtils';
import { ConfirmDialog } from '../features/vault/ConfirmDialog';
import { useAllTopics } from '../hooks/useTopics';
import {
  useAddDocuments,
  useDeleteResource,
  useResources,
} from '../hooks/useResources';
import {
  getResourcesMode,
  openDocument,
  resetResourcesMode,
  resourcesKey,
} from '../services/resourceStore';
import type { Resource } from '../types/api';

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Images' },
];

export function DocumentsPage() {
  const toast = useToastHelpers();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'pdf' | 'image'>('all');

  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Resource | null>(null);

  // Debounce search so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const listQuery = useResources();
  const topicsQuery = useAllTopics();
  const addMutation = useAddDocuments();
  const deleteMutation = useDeleteResource();

  const topics = topicsQuery.data?.topics ?? [];
  const topicById = useMemo(() => {
    const map = new Map<string, (typeof topics)[number]>();
    for (const topic of topics) map.set(topic.id, topic);
    return map;
  }, [topics]);

  const localMode = getResourcesMode() === 'local';
  const total = listQuery.data?.total ?? 0;

  // Server list is unfiltered; search/type/subject filters run client-side.
  const documents = useMemo(() => {
    const withTopics = (listQuery.data?.resources ?? []).map((resource) => {
      const topic = topicById.get(resource.topicId);
      return { resource, topic, subject: topic?.subject ?? '', topicTitle: topic?.title ?? '' };
    });

    let filtered = withTopics;
    if (subjectFilter !== 'all') {
      filtered = filtered.filter((entry) => entry.subject === subjectFilter);
    }
    if (typeFilter !== 'all') {
      filtered = filtered.filter((entry) => documentKind(entry.resource) === typeFilter);
    }
    if (search) {
      const needle = search.toLowerCase();
      filtered = filtered.filter(
        (entry) =>
          entry.resource.name.toLowerCase().includes(needle) ||
          entry.topicTitle.toLowerCase().includes(needle) ||
          entry.subject.toLowerCase().includes(needle)
      );
    }

    return filtered.sort(
      (a, b) => new Date(b.resource.createdAt).getTime() - new Date(a.resource.createdAt).getTime()
    );
  }, [listQuery.data, topicById, search, subjectFilter, typeFilter]);

  const hasActiveFilters = !!search || subjectFilter !== 'all' || typeFilter !== 'all';

  const subjectOptions = useMemo(() => {
    const names = new Set<string>();
    for (const topic of topics) names.add(topic.subject);
    for (const entry of documents) if (entry.subject) names.add(entry.subject);
    return [
      { value: 'all', label: 'All subjects' },
      ...Array.from(names)
        .sort()
        .map((name) => ({ value: name, label: name })),
    ];
  }, [topics, documents]);

  // Preselect a topic matching the active subject filter when opening the dialog.
  const defaultTopicId = useMemo(() => {
    if (subjectFilter === 'all') return topics[0]?.id ?? null;
    return topics.find((topic) => topic.subject === subjectFilter)?.id ?? null;
  }, [topics, subjectFilter]);

  const handleAdd = async (files: File[], topicId: string) => {
    await addMutation.mutateAsync({ files, topicId });
    toast.success(
      `${files.length} document${files.length > 1 ? 's' : ''} added`,
      files.map((file) => file.name).join(', ')
    );
    if (subjectFilter !== 'all') {
      const topic = topicById.get(topicId);
      if (topic && topic.subject !== subjectFilter) setSubjectFilter(topic.subject);
    }
    if (typeFilter !== 'all') setTypeFilter('all');
  };

  const handleOpen = (resource: Resource) => {
    try {
      openDocument(resource);
    } catch (error) {
      toast.error('Could not open document', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    await deleteMutation.mutateAsync(target.id);
    toast.success('Document deleted', target.name);
    setDeleteTarget(null);
  };

  const confirmDelete = () => {
    handleDelete().catch((error: unknown) => {
      toast.error('Could not delete document', error instanceof Error ? error.message : 'Unknown error');
      setDeleteTarget(null);
    });
  };

  const handleRetryConnection = () => {
    resetResourcesMode();
    queryClient.invalidateQueries({ queryKey: resourcesKey });
    queryClient.invalidateQueries({ queryKey: ['topics'] });
    queryClient.invalidateQueries({ queryKey: ['subjects'] });
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setSubjectFilter('all');
    setTypeFilter('all');
  };

  const renderList = () => {
    if (listQuery.isPending || topicsQuery.isPending) {
      return (
        <div className="grid gap-4 md:grid-cols-2" data-testid="documents-loading">
          {Array.from({ length: 4 }, (_, index) => (
            <Card key={index} elevation={1} padding="md">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton variant="rectangular" width="6rem" height="1.5rem" />
                  <Skeleton variant="text" width="5rem" height="0.75rem" />
                </div>
                <Skeleton variant="text" width="70%" height="1.25rem" />
                <Skeleton variant="text" lines={2} />
              </div>
            </Card>
          ))}
        </div>
      );
    }

    if (listQuery.isError) {
      return (
        <Card elevation={1} padding="lg" className="text-center" data-testid="documents-error">
          <CircleAlert className="w-12 h-12 text-coral-500 mx-auto mb-3" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-ink mb-1">Could not load your documents</h2>
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

    if (documents.length === 0) {
      if (hasActiveFilters) {
        return (
          <EmptyState
            illustration="resources"
            title="No documents match your filters"
            description="Try a different search term, subject or file type."
            data-testid="documents-empty-filtered"
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
          illustration="resources"
          title="No documents yet"
          description="Upload PDFs and images to keep your study materials linked to a subject and topic."
          data-testid="documents-empty"
          action={
            <Button
              onClick={() => setAddOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
              data-testid="documents-empty-add"
            >
              Add document
            </Button>
          }
        />
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2" data-testid="documents-list">
        {documents.map(({ resource, subject, topicTitle }) => (
          <DocumentCard
            key={resource.id}
            resource={resource}
            topicTitle={topicTitle}
            subject={subject}
            onOpen={handleOpen}
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
            <h1 className="text-3xl font-extrabold text-ink">Documents</h1>
            <p className="text-ink-muted">
              {listQuery.data
                ? `Showing ${documents.length} of ${total} ${total === 1 ? 'document' : 'documents'}${
                    subjectFilter !== 'all' ? ` in ${subjectFilter}` : ''
                  }`
                : 'PDFs and images linked to your subjects and topics'}
            </p>
          </div>
          <Button
            onClick={() => setAddOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            data-testid="documents-add"
          >
            Add document
          </Button>
        </header>

        {topics.length === 0 && !topicsQuery.isPending && (
          <div
            className="mb-6 rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-ink-muted"
            data-testid="documents-no-topics-banner"
          >
            Documents attach to a topic — create your first topic in{' '}
            <button
              type="button"
              className="font-semibold text-teal-700 underline hover:text-teal-800"
              onClick={() => navigate('/vault')}
            >
              My Vault
            </button>{' '}
            to start uploading.
          </div>
        )}

        {localMode && (
          <div
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            data-testid="documents-local-banner"
          >
            <p>
              <strong>Working offline.</strong> The server is unreachable, so your documents are being
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
                placeholder="Search documents by file name, topic or subject"
                aria-label="Search documents"
                data-testid="documents-search"
                className="pl-9"
              />
            </div>
            <div className="sm:w-48">
              <Select
                value={subjectFilter}
                onChange={(event) => setSubjectFilter(event.target.value)}
                options={subjectOptions}
                aria-label="Filter documents by subject"
                data-testid="documents-subject-filter"
              />
            </div>
            <div className="sm:w-40">
              <Select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as 'all' | 'pdf' | 'image')}
                options={TYPE_OPTIONS}
                aria-label="Filter documents by file type"
                data-testid="documents-type-filter"
              />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} leftIcon={<X className="w-4 h-4" />}>
                Clear
              </Button>
            )}
          </div>

          {renderList()}
        </Section>

        <AddDocumentDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          topics={topics}
          defaultTopicId={defaultTopicId}
          isSubmitting={addMutation.isPending}
          onSubmit={handleAdd}
        />

        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title={deleteTarget ? `Delete "${deleteTarget.name}"?` : ''}
          description="This document will be removed from your Vault. This cannot be undone."
          confirmLabel="Delete document"
          destructive
          loading={deleteMutation.isPending}
          onConfirm={confirmDelete}
        />
      </ContentWrapper>
    </PageContainer>
  );
}
