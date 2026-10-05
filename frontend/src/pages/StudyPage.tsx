// Study Mode — a focused workspace around a single topic.
// Subjects, topics, notes, documents and videos all come from the existing
// systems (no duplicate stores); the only new pieces are the Pomodoro timer
// and the local study-session state, both stored in localStorage.

import { useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Calendar,
  Circle,
  CircleAlert,
  CircleCheck,
  FileText,
  Play,
  RefreshCw,
  StickyNote,
} from 'lucide-react';
import { PageContainer, ContentWrapper } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Textarea } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useToastHelpers } from '../components/ui/Toast';
import { FocusTimer } from '../features/study/FocusTimer';
import { useStudySession } from '../features/study/useStudySession';
import { useNotesAutosave } from '../features/vault/useNotesAutosave';
import { useAllTopics, topicsKey, getTopicsMode, resetTopicsMode } from '../hooks/useTopics';
import { useSubjects } from '../hooks/useSubjects';
import { useResources, getResourcesMode, resetResourcesMode, resourcesKey } from '../hooks/useResources';
import { useYouTubeSearch, useYouTubeStatus } from '../hooks/useYouTube';
import { openDocument } from '../services/resourceStore';
import { VideoCard } from '../features/youtube/VideoCard';
import { cn, formatDate, formatFileSize } from '../lib/utils';
import type { Topic } from '../types/api';

const CHECKLIST_STEPS = [
  { key: 'understand', label: 'Understand' },
  { key: 'practice', label: 'Practice' },
  { key: 'revise', label: 'Revise' },
] as const;

const STATUS_META: Record<Topic['status'], { label: string; variant: 'info' | 'warning' | 'success' }> = {
  learning: { label: 'Learning', variant: 'info' },
  reviewing: { label: 'Reviewing', variant: 'warning' },
  ready: { label: 'Ready', variant: 'success' },
};

function PickerSkeleton() {
  return (
    <div className="space-y-2" data-testid="study-picker-loading">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} variant="rectangular" height="2.25rem" />
      ))}
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="space-y-6" data-testid="study-loading">
      <div className="grid gap-4 md:grid-cols-2">
        <Card elevation={1} padding="md">
          <div className="space-y-3">
            <Skeleton variant="text" width="40%" height="0.75rem" />
            <Skeleton variant="text" width="75%" height="1.5rem" />
            <Skeleton variant="text" lines={2} />
            <Skeleton variant="rectangular" height="3rem" />
          </div>
        </Card>
        <Card elevation={1} padding="md">
          <div className="space-y-3">
            <Skeleton variant="text" width="50%" height="1.25rem" />
            <Skeleton variant="rectangular" height="7rem" />
            <div className="flex gap-2">
              <Skeleton variant="rectangular" width="6rem" height="2.5rem" />
              <Skeleton variant="rectangular" width="6rem" height="2.5rem" />
            </div>
          </div>
        </Card>
      </div>
      <Card elevation={1} padding="md">
        <Skeleton variant="text" lines={4} />
      </Card>
    </div>
  );
}

function ErrorCard({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <Card elevation={1} padding="lg" className="text-center" data-testid="study-error">
      <CircleAlert className="mx-auto mb-3 h-12 w-12 text-coral-500" aria-hidden="true" />
      <h2 className="mb-1 text-lg font-semibold text-ink">{title}</h2>
      <p className="mb-4 text-sm text-ink-muted" data-testid="study-error-message">
        {message}
      </p>
      <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={onRetry}>
        Try again
      </Button>
    </Card>
  );
}

function TopicSummary({ topic }: { topic: Topic }) {
  const statusMeta = STATUS_META[topic.status] ?? { label: 'Unknown', variant: 'info' as const };
  const done = CHECKLIST_STEPS.filter((step) => topic.checklist[step.key]).length;

  return (
    <Card elevation={1} padding="md" className="flex h-full flex-col gap-3" data-testid="study-topic-summary">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
          {topic.subject}
        </span>
        <Badge variant={statusMeta.variant} size="sm" dot data-testid="study-topic-status">
          {statusMeta.label}
        </Badge>
      </div>

      <div>
        <h2 className="text-xl font-bold leading-snug text-ink" data-testid="study-topic-title">
          {topic.title}
        </h2>
        {topic.examDate && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-ink-muted">
            <Calendar className="h-4 w-4" aria-hidden="true" />
            Exam {formatDate(topic.examDate)}
          </p>
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Progress</span>
          <span className="text-xs text-ink-muted" data-testid="study-topic-progress">
            {done}/{CHECKLIST_STEPS.length}
          </span>
        </div>
        <ul className="grid grid-cols-3 gap-2" role="list">
          {CHECKLIST_STEPS.map((step) => {
            const checked = topic.checklist[step.key];
            return (
              <li
                key={step.key}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-semibold',
                  checked
                    ? 'border-teal-200 bg-teal-50 text-teal-700'
                    : 'border-border bg-surface text-ink-muted'
                )}
                data-testid="study-checklist-step"
                data-step={step.key}
                data-checked={checked ? 'true' : 'false'}
              >
                {checked ? (
                  <CircleCheck className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                ) : (
                  <Circle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">{step.label}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <Link
          to={`/vault?topic=${encodeURIComponent(topic.id)}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 transition-colors hover:text-teal-800 hover:underline"
          data-testid="study-link-vault"
        >
          Open in My Vault
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        <Link
          to="/notes"
          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 transition-colors hover:text-teal-800 hover:underline"
          data-testid="study-link-notes"
        >
          Open Notes page
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </Card>
  );
}

function NotesPanel({ topic }: { topic: Topic }) {
  const { value, status, change, flush } = useNotesAutosave(topic);
  const statusLabel = { saving: 'Saving...', saved: 'Saved', error: 'Save failed', idle: '' }[status];

  return (
    <Card elevation={1} padding="md" className="space-y-3" data-testid="study-notes-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <StickyNote className="h-5 w-5 text-teal-600" aria-hidden="true" />
          Notes
        </h2>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'text-xs',
              status === 'error' ? 'text-coral-600' : status === 'saving' ? 'text-ink-muted' : 'text-teal-600'
            )}
            role="status"
            aria-live="polite"
            data-testid="study-notes-status"
          >
            {statusLabel}
          </span>
          <Link
            to="/notes"
            className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 transition-colors hover:text-teal-800 hover:underline"
            data-testid="study-notes-open"
          >
            Open in Notes
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
      <Textarea
        value={value}
        onChange={(event) => change(event.target.value)}
        onBlur={flush}
        placeholder="Add notes for this topic..."
        rows={6}
        aria-label={`Notes for ${topic.title}`}
        data-testid="study-notes"
      />
    </Card>
  );
}

function DocumentsPanel({ topic }: { topic: Topic }) {
  const toast = useToastHelpers();
  const query = useResources(topic.id);
  const documents = query.data?.resources ?? [];

  const handleOpen = (resource: (typeof documents)[number]) => {
    try {
      openDocument(resource);
    } catch (error) {
      toast.error('Could not open document', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <Card elevation={1} padding="md" className="flex h-full flex-col gap-3" data-testid="study-documents-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <FileText className="h-5 w-5 text-teal-600" aria-hidden="true" />
          Documents
        </h2>
        <Link
          to="/documents"
          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 transition-colors hover:text-teal-800 hover:underline"
          data-testid="study-documents-open-page"
        >
          Open Documents
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {query.isPending ? (
        <div className="space-y-2" data-testid="study-documents-loading">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} variant="rectangular" height="3rem" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="rounded-xl border border-coral-200 bg-coral-50 px-3 py-3 text-sm text-coral-700" data-testid="study-documents-error">
          <p className="mb-2">Could not load documents: {query.error.message}</p>
          <Button size="sm" variant="outline" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          size="sm"
          illustration="resources"
          title="No documents for this topic"
          description="Attach PDFs and images in Documents to have them ready here."
          data-testid="study-documents-empty"
          action={
            <Link
              to="/documents"
              className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
              data-testid="study-documents-add"
            >
              Add documents
            </Link>
          }
        />
      ) : (
        <ul className="space-y-2" role="list" data-testid="study-documents">
          {documents.map((resource) => (
            <li
              key={resource.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
              data-testid="study-document"
              data-document-name={resource.name}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink" title={resource.name}>
                  {resource.name}
                </p>
                <p className="text-xs text-ink-subtle">{formatFileSize(Number(resource.size) || 0)}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpen(resource)}
                aria-label={`Open document ${resource.name}`}
                data-testid="study-document-open"
              >
                Open
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function VideosPanel({ topic }: { topic: Topic }) {
  const statusQuery = useYouTubeStatus();
  const search = useYouTubeSearch();

  const statusData = statusQuery.data as { configured?: boolean; enabled?: boolean } | undefined;
  const configured = statusData ? !!(statusData.configured ?? statusData.enabled) : false;
  const videos = search.data?.videos ?? [];

  const error = search.error as { status?: number; code?: string; message?: string } | null;
  const unconfigured = error?.status === 503 || error?.code === 'service_unavailable';

  const handleSearch = () => {
    search.mutate({
      query: `${topic.title} ${topic.subject}`.trim(),
      maxResults: 6,
      order: 'relevance',
    });
  };

  return (
    <Card elevation={1} padding="md" className="flex h-full flex-col gap-3" data-testid="study-videos-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <Play className="h-5 w-5 text-coral-500" aria-hidden="true" />
          Videos
        </h2>
        <Link
          to="/youtube"
          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 transition-colors hover:text-teal-800 hover:underline"
          data-testid="study-videos-open-page"
        >
          Open YouTube search
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <p className="text-sm text-ink-muted">
        Find videos for <span className="font-semibold text-ink">{topic.title}</span> using the existing YouTube
        search.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={handleSearch}
          loading={search.isPending}
          aria-label={`Find videos for ${topic.title}`}
          data-testid="study-videos-search"
        >
          Find videos
        </Button>
        {statusQuery.isSuccess && !configured && (
          <span className="text-xs text-amber-700" data-testid="study-videos-unconfigured">
            Video search is not configured on this server.
          </span>
        )}
      </div>

      {search.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2" data-testid="study-videos-loading">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton variant="rectangular" height="7rem" />
              <Skeleton variant="text" width="80%" height="1rem" />
              <Skeleton variant="text" width="50%" height="0.75rem" />
            </div>
          ))}
        </div>
      ) : search.isError ? (
        <div className="rounded-xl border border-coral-200 bg-coral-50 px-3 py-3 text-sm text-coral-700" data-testid="study-videos-error">
          <p className="mb-1 font-semibold">
            {unconfigured ? 'Video search is not configured' : 'Video search failed'}
          </p>
          <p className="mb-2" data-testid="study-videos-error-message">
            {unconfigured
              ? 'Set YOUTUBE_API_KEY on the backend to enable video search.'
              : error?.message || 'Unknown error'}
          </p>
          <Button size="sm" variant="outline" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={handleSearch}>
            Try again
          </Button>
        </div>
      ) : search.isSuccess && videos.length === 0 ? (
        <EmptyState
          size="sm"
          illustration="youtube"
          title="No videos found"
          description="Try again with a shorter topic title, or search from the YouTube page."
          data-testid="study-videos-empty"
        />
      ) : videos.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2" data-testid="study-videos-results">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      ) : null}
    </Card>
  );
}

export function StudyPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlSubject = searchParams.get('subject');
  const urlTopicId = searchParams.get('topic');

  const {
    session,
    start,
    pause,
    reset,
    setFocusMinutes,
    setBreakMinutes,
    selectTopic,
  } = useStudySession();

  const topicsQuery = useAllTopics();
  const subjects = useSubjects();

  const topics = useMemo(() => topicsQuery.data?.topics ?? [], [topicsQuery.data]);
  const topic = useMemo(
    () => (urlTopicId ? topics.find((item) => item.id === urlTopicId) ?? null : null),
    [topics, urlTopicId]
  );
  const topicsForSubject = useMemo(
    () => (urlSubject ? topics.filter((item) => item.subject === urlSubject) : []),
    [topics, urlSubject]
  );

  const restoredRef = useRef(true);
  useEffect(() => {
    if (!restoredRef.current) return;
    restoredRef.current = false;
    // Deep links win; otherwise reopen the last studied topic after a reload.
    if (!urlTopicId && session.topicId) {
      const next = new URLSearchParams();
      if (session.subject) next.set('subject', session.subject);
      next.set('topic', session.topicId);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The URL is the source of truth for selection; mirror it into the session.
  useEffect(() => {
    if (session.subject === urlSubject && session.topicId === urlTopicId) return;
    selectTopic(urlSubject, urlTopicId);
  }, [urlSubject, urlTopicId, session.subject, session.topicId, selectTopic]);

  const setSelection = (subject: string | null, topicId: string | null) => {
    const next = new URLSearchParams();
    if (subject) next.set('subject', subject);
    if (topicId) next.set('topic', topicId);
    setSearchParams(next, { replace: true });
  };

  const localMode = getTopicsMode() === 'local' || getResourcesMode() === 'local';

  const handleRetryConnection = () => {
    resetTopicsMode();
    resetResourcesMode();
    queryClient.invalidateQueries({ queryKey: topicsKey });
    queryClient.invalidateQueries({ queryKey: ['subjects'] });
    queryClient.invalidateQueries({ queryKey: resourcesKey });
  };

  const renderWorkspace = () => {
    if (topicsQuery.isPending) return <WorkspaceSkeleton />;

    if (topicsQuery.isError) {
      return (
        <ErrorCard
          title="Could not load your topics"
          message={topicsQuery.error.message}
          onRetry={() => topicsQuery.refetch()}
        />
      );
    }

    if (!urlTopicId) {
      return (
        <EmptyState
          illustration="topics"
          title="Choose a topic to start"
          description="Pick a subject on the left, then a topic, to open your focused study workspace."
          data-testid="study-empty"
          action={
            <Button variant="outline" onClick={() => setSelection(subjects[0]?.name ?? null, null)}>
              {subjects.length > 0 ? `Browse ${subjects[0].name}` : 'Open My Vault'}
            </Button>
          }
        />
      );
    }

    if (!topic) {
      return (
        <EmptyState
          illustration="topics"
          title="Topic not found"
          description="That topic no longer exists. Pick another one from the list."
          data-testid="study-not-found"
          action={
            <Button variant="outline" onClick={() => setSelection(urlSubject, null)}>
              Choose another topic
            </Button>
          }
        />
      );
    }

    return (
      <div className="space-y-6" data-testid="study-workspace">
        <div className="grid gap-4 md:grid-cols-2">
          <TopicSummary topic={topic} />
          <FocusTimer
            session={session}
            onStart={start}
            onPause={pause}
            onReset={reset}
            onFocusMinutes={setFocusMinutes}
            onBreakMinutes={setBreakMinutes}
          />
        </div>
        <NotesPanel key={`notes-${topic.id}`} topic={topic} />
        <div className="grid gap-4 md:grid-cols-2">
          <DocumentsPanel key={`docs-${topic.id}`} topic={topic} />
          <VideosPanel key={`videos-${topic.id}`} topic={topic} />
        </div>
      </div>
    );
  };

  return (
    <PageContainer>
      <ContentWrapper className="max-w-6xl">
        <header className="page-header">
          <div>
            <h1 className="text-3xl font-extrabold text-ink">Study Mode</h1>
            <p className="text-ink-muted">
              One topic, all of its material, and a focus timer to keep you going
            </p>
          </div>
          <Badge variant="success" size="md" data-testid="study-session-badge">
            {session.completedFocusSessions} focus session
            {session.completedFocusSessions === 1 ? '' : 's'}
          </Badge>
        </header>

        {localMode && (
          <div
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            data-testid="study-local-banner"
          >
            <p>
              <strong>Working offline.</strong> The server is unreachable, so your study data is being read from
              this device.
            </p>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={handleRetryConnection}
            >
              Retry connection
            </Button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Subject + topic picker */}
          <aside className="lg:col-span-4 xl:col-span-3" data-testid="study-picker">
            <Card elevation={1} padding="md" className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">Subjects</h2>
                <p className="text-sm text-ink-muted">Pick a subject, then a topic</p>
              </div>

              {topicsQuery.isPending ? (
                <PickerSkeleton />
              ) : subjects.length === 0 ? (
                <div data-testid="study-no-subjects">
                  <p className="mb-2 text-sm text-ink-muted">No topics yet.</p>
                  <Link
                    to="/vault"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline"
                  >
                    Create your first topic
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              ) : (
                <ul className="space-y-1.5" role="list" data-testid="study-subjects">
                  {subjects.map((subject) => {
                    const active = urlSubject === subject.name;
                    return (
                      <li key={subject.name}>
                        <button
                          type="button"
                          onClick={() => setSelection(subject.name, null)}
                          aria-pressed={active}
                          className={cn(
                            'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                            active
                              ? 'border-teal-300 bg-teal-50 text-teal-700'
                              : 'border-border bg-surface text-ink-muted hover:border-teal-200 hover:text-teal-700'
                          )}
                          data-testid="study-subject"
                          data-subject={subject.name}
                        >
                          <span className="truncate">{subject.name}</span>
                          <span className="text-xs text-ink-subtle">{subject.topicCount}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {urlSubject && (
                <div className="space-y-2 border-t border-border pt-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Topics in {urlSubject}
                  </h3>

                  {topicsQuery.isPending ? (
                    <PickerSkeleton />
                  ) : topicsForSubject.length === 0 ? (
                    <div data-testid="study-subject-topics-empty">
                      <p className="mb-2 text-sm text-ink-muted">No topics in this subject yet.</p>
                      <Link
                        to="/vault"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline"
                      >
                        Add one in My Vault
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  ) : (
                    <ul className="space-y-1.5" role="list" data-testid="study-topics">
                      {topicsForSubject.map((item) => {
                        const active = urlTopicId === item.id;
                        const meta = STATUS_META[item.status];
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => setSelection(item.subject, item.id)}
                              aria-pressed={active}
                              className={cn(
                                'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                                active
                                  ? 'border-teal-300 bg-teal-50 text-teal-700'
                                  : 'border-border bg-surface text-ink-muted hover:border-teal-200 hover:text-teal-700'
                              )}
                              data-testid="study-topic"
                              data-topic-id={item.id}
                              data-topic-title={item.title}
                            >
                              <span className="truncate font-medium">{item.title}</span>
                              <Badge variant={meta.variant} size="sm">
                                {meta.label}
                              </Badge>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          </aside>

          {/* Workspace */}
          <section className="space-y-6 lg:col-span-8 xl:col-span-9">{renderWorkspace()}</section>
        </div>
      </ContentWrapper>
    </PageContainer>
  );
}
