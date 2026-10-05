// Search Page — Phase 1 unified search foundation.
// One query box with three scopes: My Vault (local content: subjects, topics,
// notes, documents, assignments, performance, attendance), Web (Brave via the
// backend) and Videos (YouTube Data API). Vault search works offline through
// the existing local-first stores; web/video scopes report configuration and
// connectivity problems instead of silently returning nothing.

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleAlert, RefreshCw, Search as SearchIcon, X } from 'lucide-react';
import { PageContainer, Section, ContentWrapper } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { VaultSearchLoading, VaultSearchResults } from '../features/search/VaultSearchResults';
import {
  SCOPE_LABELS,
  SEARCH_SCOPES,
  countResults,
  normalizeScope,
  searchVault,
  type SearchScope,
} from '../features/search/searchUtils';
import { VideoCard } from '../features/youtube/VideoCard';
import { useAllTopics } from '../hooks/useTopics';
import { useSubjects } from '../hooks/useSubjects';
import { useResources } from '../hooks/useResources';
import { useAssignments } from '../hooks/useAssignments';
import { useAssessments } from '../hooks/useAssessments';
import { useAttendanceSubjects } from '../hooks/useAttendance';
import { useSearchStatus, useWebSearch } from '../hooks/useSearch';
import { useYouTubeSearch, useYouTubeStatus, formatPublishedDate } from '../hooks/useYouTube';
import { getTopicsMode } from '../services/topicStore';
import type { SearchOptions } from '../types/api';

const WEB_MAX_OPTIONS = [
  { value: '10', label: '10' },
  { value: '20', label: '20' },
  { value: '30', label: '30' },
  { value: '50', label: '50' },
];

const SAFE_SEARCH_OPTIONS = [
  { value: 'moderate', label: 'Moderate' },
  { value: 'off', label: 'Off' },
  { value: 'strict', label: 'Strict' },
];

const FRESHNESS_OPTIONS = [
  { value: '', label: 'Any time' },
  { value: 'day', label: 'Past day' },
  { value: 'week', label: 'Past week' },
  { value: 'month', label: 'Past month' },
  { value: 'year', label: 'Past year' },
];

const ORDER_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'date', label: 'Date' },
  { value: 'viewCount', label: 'View count' },
  { value: 'title', label: 'Title' },
];

type FailureKind = 'unconfigured' | 'offline';

function classifyFailure(error: unknown): FailureKind {
  const err = error as { status?: number; code?: string } | null;
  if (err?.status === 503 || err?.code === 'service_unavailable') return 'unconfigured';
  return 'offline';
}

function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function FailureCard({
  kind,
  message,
  onRetry,
  testId,
}: {
  kind: FailureKind;
  message: string;
  onRetry: () => void;
  testId: string;
}) {
  return (
    <Card elevation={1} padding="lg" className="text-center" data-testid={testId}>
      <CircleAlert className="mx-auto mb-3 h-12 w-12 text-coral-500" aria-hidden="true" />
      <h2 className="mb-1 text-lg font-semibold text-ink">
        {kind === 'unconfigured' ? 'Search service is not configured' : 'Could not reach the server'}
      </h2>
      <p className="mb-4 text-sm text-ink-muted" data-testid={`${testId}-message`}>
        {kind === 'unconfigured'
          ? message
          : `${message} Check your connection — vault search still works offline.`}
      </p>
      <Button
        variant="outline"
        leftIcon={<RefreshCw className="h-4 w-4" />}
        onClick={onRetry}
        data-testid={`${testId}-retry`}
      >
        Try again
      </Button>
    </Card>
  );
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialQuery = (searchParams.get('q') ?? '').trim();
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<SearchScope>(() => normalizeScope(searchParams.get('scope')));
  // The last query actually submitted to a remote scope (web / videos).
  const [submitted, setSubmitted] = useState(initialQuery);

  const [maxResults, setMaxResults] = useState('10');
  const [safeSearch, setSafeSearch] = useState('moderate');
  const [freshness, setFreshness] = useState('');
  const [order, setOrder] = useState('relevance');

  const topicsQuery = useAllTopics();
  const subjectRegistry = useSubjects();
  const resourcesQuery = useResources();
  const assignmentsQuery = useAssignments();
  const assessmentsQuery = useAssessments();
  const attendanceQuery = useAttendanceSubjects();

  const webStatus = useSearchStatus();
  const webSearch = useWebSearch();
  const videoStatus = useYouTubeStatus();
  const videoSearch = useYouTubeSearch();

  const localMode = getTopicsMode() === 'local';

  const topics = useMemo(() => topicsQuery.data?.topics ?? [], [topicsQuery.data]);
  const resources = useMemo(() => resourcesQuery.data?.resources ?? [], [resourcesQuery.data]);
  const assignments = useMemo(() => assignmentsQuery.data?.assignments ?? [], [assignmentsQuery.data]);
  const assessments = useMemo(() => assessmentsQuery.data?.assessments ?? [], [assessmentsQuery.data]);
  const attendanceSubjects = useMemo(
    () => (attendanceQuery.data?.subjects ?? []).map((subject) => subject.name),
    [attendanceQuery.data]
  );

  const vaultGroups = useMemo(
    () =>
      searchVault({
        query,
        topics,
        subjects: subjectRegistry.map((subject) => subject.name),
        resources,
        assignments,
        assessments,
        attendanceSubjects,
      }),
    [query, topics, subjectRegistry, resources, assignments, assessments, attendanceSubjects]
  );

  const vaultPending =
    topicsQuery.isPending ||
    resourcesQuery.isPending ||
    assignmentsQuery.isPending ||
    assessmentsQuery.isPending ||
    attendanceQuery.isPending;
  const vaultFailed =
    topicsQuery.isError &&
    resourcesQuery.isError &&
    assignmentsQuery.isError &&
    assessmentsQuery.isError;
  const vaultTotal = countResults(vaultGroups);

  // Keep the box in sync when the URL changes (topbar search, back/forward).
  const urlQuery = (searchParams.get('q') ?? '').trim();
  const urlScope = normalizeScope(searchParams.get('scope'));
  useEffect(() => {
    setQuery((current) => (current.trim() === urlQuery ? current : urlQuery));
    setScope((current) => (current === urlScope ? current : urlScope));
  }, [urlQuery, urlScope]);

  const webConfigured = !!webStatus.data?.configured;
  const videoStatusData = videoStatus.data as { configured?: boolean; enabled?: boolean } | undefined;
  const videoConfigured = !!(videoStatusData ? (videoStatusData.configured ?? videoStatusData.enabled) : false);

  const statusPill =
    scope === 'web' ? (
      webStatus.isPending ? (
        <Badge variant="default" size="sm" data-testid="search-status">
          Checking web search...
        </Badge>
      ) : webStatus.isError ? (
        <Badge variant="danger" size="sm" data-testid="search-status">
          Web search: Offline
        </Badge>
      ) : webConfigured ? (
        <Badge variant="success" size="sm" data-testid="search-status">
          Web search: Connected
        </Badge>
      ) : (
        <Badge variant="warning" size="sm" data-testid="search-status">
          Web search: Not configured
        </Badge>
      )
    ) : scope === 'videos' ? (
      videoStatus.isPending ? (
        <Badge variant="default" size="sm" data-testid="search-status">
          Checking videos...
        </Badge>
      ) : videoStatus.isError ? (
        <Badge variant="danger" size="sm" data-testid="search-status">
          Videos: Offline
        </Badge>
      ) : videoConfigured ? (
        <Badge variant="success" size="sm" data-testid="search-status">
          Videos: Connected
        </Badge>
      ) : (
        <Badge variant="warning" size="sm" data-testid="search-status">
          Videos: Not configured
        </Badge>
      )
    ) : (
      <Badge variant={localMode ? 'warning' : 'success'} size="sm" data-testid="search-status">
        {localMode ? 'Vault: Offline data' : 'Vault: Ready'}
      </Badge>
    );

  const syncParams = (nextScope: SearchScope, nextQuery: string) => {
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        if (nextQuery.trim()) next.set('q', nextQuery.trim());
        else next.delete('q');
        if (nextScope === 'vault') next.delete('scope');
        else next.set('scope', nextScope);
        return next;
      },
      { replace: true }
    );
  };

  const runWebSearch = (value: string) => {
    const options: SearchOptions = {
      query: value,
      maxResults: Math.min(50, Math.max(1, Number(maxResults) || 10)),
      safeSearch: safeSearch as SearchOptions['safeSearch'],
      ...(freshness ? { freshness: freshness as SearchOptions['freshness'] } : {}),
    };
    setSubmitted(value);
    webSearch.mutate(options);
  };

  const runVideoSearch = (value: string) => {
    setSubmitted(value);
    videoSearch.mutate({
      query: value,
      maxResults: Math.min(50, Math.max(1, Number(maxResults) || 10)),
      order: order as 'relevance' | 'date' | 'viewCount' | 'title',
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    syncParams(scope, trimmed);
    if (scope === 'web') runWebSearch(trimmed);
    else if (scope === 'videos') runVideoSearch(trimmed);
  };

  const handleScopeChange = (next: SearchScope) => {
    setScope(next);
    syncParams(next, query);
    if (next === 'web' && query.trim()) runWebSearch(query.trim());
    if (next === 'videos' && query.trim()) runVideoSearch(query.trim());
  };

  const clearQuery = () => {
    setQuery('');
    setSubmitted('');
    syncParams(scope, '');
  };

  // Deep link support: /search?q=...&scope=web runs the remote search once.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    if (!initialQuery) return;
    if (scope === 'web') runWebSearch(initialQuery);
    else if (scope === 'videos') runVideoSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retryRemote = () => {
    if (scope === 'web' && submitted) runWebSearch(submitted);
    if (scope === 'videos' && submitted) runVideoSearch(submitted);
  };

  const webResults = webSearch.data?.results ?? [];
  const videoResults = videoSearch.data?.videos ?? [];

  const renderVault = () => {
    if (vaultFailed) {
      return (
        <Card elevation={1} padding="lg" className="text-center" data-testid="search-error">
          <CircleAlert className="mx-auto mb-3 h-12 w-12 text-coral-500" aria-hidden="true" />
          <h2 className="mb-1 text-lg font-semibold text-ink">Could not search your vault</h2>
          <p className="mb-4 text-sm text-ink-muted">
            {topicsQuery.error instanceof Error ? topicsQuery.error.message : 'Unknown error'}
          </p>
          <Button
            variant="outline"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={() => {
              topicsQuery.refetch();
              resourcesQuery.refetch();
              assignmentsQuery.refetch();
              assessmentsQuery.refetch();
            }}
            data-testid="search-error-retry"
          >
            Try again
          </Button>
        </Card>
      );
    }

    if (vaultPending) return <VaultSearchLoading />;

    if (!query.trim()) {
      return (
        <EmptyState
          illustration="search"
          title="Search everything in your vault"
          description="Find subjects, topics, notes, documents, assignments, results and attendance in one place."
          data-testid="search-initial"
        />
      );
    }

    if (vaultTotal === 0) {
      return (
        <EmptyState
          illustration="search"
          title="No matches in your vault"
          description={`Nothing matched "${query.trim()}". Try fewer words or a different spelling.`}
          data-testid="search-no-results"
          action={
            <Button variant="outline" onClick={clearQuery} leftIcon={<X className="h-4 w-4" />}>
              Clear search
            </Button>
          }
        />
      );
    }

    return <VaultSearchResults groups={vaultGroups} />;
  };

  const renderWeb = () => {
    if (webSearch.isPending && submitted) {
      return (
        <div className="space-y-4" data-testid="search-loading">
          {[0, 1, 2].map((index) => (
            <Card key={index} elevation={1} padding="md">
              <div className="space-y-3">
                <div className="h-5 w-2/3 animate-pulse rounded bg-border" />
                <div className="h-4 w-full animate-pulse rounded bg-border" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-border" />
              </div>
            </Card>
          ))}
        </div>
      );
    }

    if (webSearch.isError && submitted) {
      return (
        <FailureCard
          kind={classifyFailure(webSearch.error)}
          message={
            classifyFailure(webSearch.error) === 'unconfigured'
              ? 'The server reported that BRAVE_SEARCH_API_KEY is missing. Set it on the backend to enable web search.'
              : failureMessage(webSearch.error)
          }
          onRetry={retryRemote}
          testId="search-error"
        />
      );
    }

    if (!submitted) {
      return (
        <EmptyState
          illustration="search"
          title="Search the web for study resources"
          description="Find explanations, articles and references without leaving Student Vault."
          data-testid="search-initial"
        />
      );
    }

    if (webResults.length === 0) {
      return (
        <EmptyState
          illustration="search"
          title="No web results"
          description={`No results for "${submitted}". Try a different search term.`}
          data-testid="search-no-results"
          action={
            <Button variant="outline" onClick={clearQuery} leftIcon={<X className="h-4 w-4" />}>
              Clear search
            </Button>
          }
        >
          <p className="mt-3 max-w-md text-xs text-ink-subtle" data-testid="search-web-hint">
            The server reported no matches — if you expected results, it may be running without a
            BRAVE_SEARCH_API_KEY.
          </p>
        </EmptyState>
      );
    }

    return (
      <div className="space-y-3" data-testid="search-web-results">
        {webResults.map((result) => (
          <Card key={`${result.url}-${result.title}`} elevation={1} padding="md" data-testid="search-web-result">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-lg"
            >
              <p className="text-xs text-ink-subtle">
                {result.source}
                {result.publishedAt ? ` • ${formatPublishedDate(result.publishedAt)}` : ''}
              </p>
              <h3 className="mt-1 text-base font-semibold text-teal-700 hover:underline">{result.title}</h3>
              <p className="mt-1 break-all text-xs text-ink-subtle">{result.url}</p>
            </a>
            <p className="mt-2 text-sm text-ink-muted">{result.snippet}</p>
          </Card>
        ))}
      </div>
    );
  };

  const renderVideos = () => {
    if (videoSearch.isPending && submitted) {
      return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="search-loading">
          {[0, 1, 2].map((index) => (
            <Card key={index} elevation={1} padding="md">
              <div className="space-y-3">
                <div className="h-36 w-full animate-pulse rounded bg-border" />
                <div className="h-4 w-4/5 animate-pulse rounded bg-border" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-border" />
              </div>
            </Card>
          ))}
        </div>
      );
    }

    if (videoSearch.isError && submitted) {
      return (
        <FailureCard
          kind={classifyFailure(videoSearch.error)}
          message={
            classifyFailure(videoSearch.error) === 'unconfigured'
              ? 'The server reported that the YouTube Data API key is missing. Set YOUTUBE_API_KEY on the backend to enable video search.'
              : failureMessage(videoSearch.error)
          }
          onRetry={retryRemote}
          testId="search-error"
        />
      );
    }

    if (!submitted) {
      return (
        <EmptyState
          illustration="youtube"
          title="Find videos to study"
          description="Search educational videos without leaving Student Vault."
          data-testid="search-initial"
        />
      );
    }

    if (videoResults.length === 0) {
      const serviceDown = videoStatus.isSuccess && !videoConfigured;
      if (serviceDown) {
        return (
          <FailureCard
            kind="unconfigured"
            message="The server reports that the YouTube Data API key is missing. Set YOUTUBE_API_KEY on the backend to enable video search."
            onRetry={retryRemote}
            testId="search-error"
          />
        );
      }
      return (
        <EmptyState
          illustration="youtube"
          title="No videos found"
          description={`No results for "${submitted}". Try a different search term.`}
          data-testid="search-no-results"
          action={
            <Button variant="outline" onClick={clearQuery} leftIcon={<X className="h-4 w-4" />}>
              Clear search
            </Button>
          }
        >
          <p className="mt-3 max-w-md text-xs text-ink-subtle" data-testid="search-video-hint">
            The server reported no matches — if you expected videos, it may be running without a
            YOUTUBE_API_KEY.
          </p>
        </EmptyState>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="search-video-results">
        {videoResults.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
    );
  };

  const resultDescription =
    scope === 'vault'
      ? query.trim()
        ? `${vaultTotal} match${vaultTotal === 1 ? '' : 'es'} in your vault`
        : 'Subjects, topics, notes, documents, assignments, results and attendance'
      : submitted
        ? `Results for "${submitted}"`
        : 'Results from the web';

  return (
    <PageContainer>
      <ContentWrapper className="max-w-6xl">
        <header className="page-header">
          <div>
            <h1 className="text-3xl font-extrabold text-ink">Search</h1>
            <p className="text-ink-muted">Find anything in your vault, the web or video libraries</p>
          </div>
          {statusPill}
        </header>

        <Section>
          <Card elevation={1} padding="md">
            <form onSubmit={handleSubmit} noValidate className="space-y-4" data-testid="search-form">
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Search scope">
                {SEARCH_SCOPES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={scope === value}
                    onClick={() => handleScopeChange(value)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                      scope === value
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                    }`}
                    data-testid={`search-scope-${value}`}
                  >
                    {SCOPE_LABELS[value]}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="relative">
                  <SearchIcon
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
                    aria-hidden="true"
                  />
                  <Input
                    id="search-query"
                    label="Search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={
                      scope === 'vault'
                        ? 'e.g., limits notes'
                        : scope === 'web'
                          ? 'e.g., photosynthesis explanation'
                          : 'e.g., calculus derivatives'
                    }
                    aria-required="true"
                    className="pl-9"
                    data-testid="search-input"
                  />
                </div>
                <div className="flex gap-2">
                  {query && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={clearQuery}
                      leftIcon={<X className="h-4 w-4" />}
                      data-testid="search-clear"
                    >
                      Clear
                    </Button>
                  )}
                  <Button
                    type="submit"
                    loading={scope === 'web' ? webSearch.isPending : scope === 'videos' ? videoSearch.isPending : false}
                    leftIcon={<SearchIcon className="h-4 w-4" />}
                    data-testid="search-submit"
                  >
                    Search
                  </Button>
                </div>
              </div>

              {scope === 'web' && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Select
                    label="Max results"
                    value={maxResults}
                    onChange={(event) => setMaxResults(event.target.value)}
                    options={WEB_MAX_OPTIONS}
                    aria-label="Maximum web results"
                    data-testid="search-max-results"
                  />
                  <Select
                    label="Safe search"
                    value={safeSearch}
                    onChange={(event) => setSafeSearch(event.target.value)}
                    options={SAFE_SEARCH_OPTIONS}
                    aria-label="Safe search level"
                    data-testid="search-safe-search"
                  />
                  <Select
                    label="Freshness"
                    value={freshness}
                    onChange={(event) => setFreshness(event.target.value)}
                    options={FRESHNESS_OPTIONS}
                    aria-label="Result freshness"
                    data-testid="search-freshness"
                  />
                </div>
              )}

              {scope === 'videos' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    label="Max results"
                    value={maxResults}
                    onChange={(event) => setMaxResults(event.target.value)}
                    options={WEB_MAX_OPTIONS}
                    aria-label="Maximum video results"
                    data-testid="search-max-results"
                  />
                  <Select
                    label="Order"
                    value={order}
                    onChange={(event) => setOrder(event.target.value)}
                    options={ORDER_OPTIONS}
                    aria-label="Sort videos by"
                    data-testid="search-order"
                  />
                </div>
              )}
            </form>
          </Card>

          <p
            className="mt-3 min-h-5 text-sm text-ink-muted"
            aria-live="polite"
            data-testid="search-notice"
          >
            {scope === 'vault' && localMode
              ? 'Server unreachable — searching the copy stored on this device.'
              : ''}
          </p>
        </Section>

        <Section title={SCOPE_LABELS[scope]} description={resultDescription}>
          {scope === 'vault' && renderVault()}
          {scope === 'web' && renderWeb()}
          {scope === 'videos' && renderVideos()}
        </Section>
      </ContentWrapper>
    </PageContainer>
  );
}
