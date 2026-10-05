// YouTube / Learning Resources page — preserves the legacy search experience:
// status pill, query + max results + order form, result cards with thumbnail,
// channel, view count, date and description, opening on youtube.com in a new tab.
// Discovery only: results are never persisted, downloaded or re-categorised.

import { useState, type FormEvent } from 'react';
import { CircleAlert, RefreshCw, Search } from 'lucide-react';
import { PageContainer, Section, ContentWrapper } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { VideoCard } from '../features/youtube/VideoCard';
import { useYouTubeSearch, useYouTubeStatus } from '../hooks/useYouTube';
import type { YouTubeSearchOptions } from '../types/api';

const ORDER_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'date', label: 'Date' },
  { value: 'rating', label: 'Rating' },
  { value: 'viewCount', label: 'View count' },
  { value: 'title', label: 'Title' },
];

type FailureKind = 'unconfigured' | 'unreachable';

function classifyFailure(error: unknown): FailureKind {
  const err = error as { status?: number; code?: string } | null;
  if (err?.status === 503 || err?.code === 'service_unavailable') return 'unconfigured';
  return 'unreachable';
}

function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function YouTubePage() {
  const [query, setQuery] = useState('');
  const [maxResults, setMaxResults] = useState('10');
  const [order, setOrder] = useState('relevance');

  // The submitted options are kept so "Try again" re-runs the last search.
  const [submitted, setSubmitted] = useState<YouTubeSearchOptions | null>(null);

  const statusQuery = useYouTubeStatus();
  const search = useYouTubeSearch();

  const statusData = statusQuery.data as { configured?: boolean; enabled?: boolean } | undefined;
  const configured = statusData ? !!(statusData.configured ?? statusData.enabled) : false;

  const statusPill = statusQuery.isPending ? (
    <Badge variant="default" size="sm" data-testid="youtube-status">
      Checking YouTube...
    </Badge>
  ) : statusQuery.isError ? (
    <Badge variant="danger" size="sm" data-testid="youtube-status">
      YouTube: Error
    </Badge>
  ) : configured ? (
    <Badge variant="success" size="sm" data-testid="youtube-status">
      YouTube: Connected
    </Badge>
  ) : (
    <Badge variant="warning" size="sm" data-testid="youtube-status">
      YouTube: Not configured
    </Badge>
  );

  const videos = search.data?.videos ?? [];
  const hasResults = !!submitted && search.isSuccess;
  const isSearching = search.isPending;

  let notice = '';
  if (isSearching) notice = 'Searching...';
  else if (search.isError && submitted) notice = 'Search failed: ' + failureMessage(search.error);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    const options: YouTubeSearchOptions = {
      query: trimmed,
      maxResults: Math.min(50, Math.max(1, Number(maxResults) || 10)),
      order: order as YouTubeSearchOptions['order'],
    };
    setSubmitted(options);
    search.mutate(options);
  };

  const handleRetry = () => {
    if (submitted) search.mutate(submitted);
  };

  const renderResults = () => {
    if (search.isError && submitted) {
      const kind = classifyFailure(search.error);
      return (
        <Card elevation={1} padding="lg" className="text-center" data-testid="youtube-error">
          <CircleAlert className="mx-auto mb-3 h-12 w-12 text-coral-500" aria-hidden="true" />
          <h2 className="mb-1 text-lg font-semibold text-ink">
            {kind === 'unconfigured' ? 'YouTube search is not configured' : 'Search failed'}
          </h2>
          <p className="mb-4 text-sm text-ink-muted" data-testid="youtube-error-message">
            {kind === 'unconfigured'
              ? 'The server responded that the YouTube Data API key is missing. Set YOUTUBE_API_KEY on the backend to enable video search.'
              : failureMessage(search.error)}
          </p>
          <Button
            variant="outline"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={handleRetry}
            data-testid="youtube-retry"
          >
            Try again
          </Button>
        </Card>
      );
    }

    if (isSearching) {
      return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="youtube-loading">
          {Array.from({ length: 3 }, (_, index) => (
            <Card key={index} elevation={1} padding="md">
              <div className="space-y-3">
                <Skeleton variant="rectangular" width="100%" height="9rem" />
                <Skeleton variant="text" width="85%" height="1.1rem" />
                <Skeleton variant="text" width="55%" height="0.75rem" />
                <Skeleton variant="text" lines={2} />
              </div>
            </Card>
          ))}
        </div>
      );
    }

    // An empty list is only a real "no results" when the service is actually
    // available — otherwise report the configuration problem instead of silently
    // pretending nothing matched the query.
    const serviceDown = statusQuery.isSuccess && !configured;

    if (hasResults && videos.length === 0 && serviceDown) {
      return (
        <Card elevation={1} padding="lg" className="text-center" data-testid="youtube-error">
          <CircleAlert className="mx-auto mb-3 h-12 w-12 text-coral-500" aria-hidden="true" />
          <h2 className="mb-1 text-lg font-semibold text-ink">YouTube search is not configured</h2>
          <p className="mb-4 text-sm text-ink-muted" data-testid="youtube-error-message">
            The server reports that the YouTube Data API key is missing. Set YOUTUBE_API_KEY on the
            backend to enable video search.
          </p>
          <Button
            variant="outline"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={handleRetry}
            data-testid="youtube-retry"
          >
            Try again
          </Button>
        </Card>
      );
    }

    if (hasResults && videos.length === 0) {
      return (
        <EmptyState
          illustration="youtube"
          title="No videos found"
          description={`No results for "${submitted?.query}". Try a different search term.`}
          data-testid="youtube-empty"
          action={
            <Button variant="outline" onClick={() => setQuery('')} leftIcon={<Search className="h-4 w-4" />}>
              Clear search
            </Button>
          }
        >
          {configured && (
            <p className="mt-3 text-xs text-ink-subtle" data-testid="youtube-empty-hint">
              The server reported no matches — if you expected videos, it may be running without a
              YouTube API key.
            </p>
          )}
        </EmptyState>
      );
    }

    if (hasResults) {
      return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="youtube-results">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      );
    }

    return (
      <EmptyState
        illustration="youtube"
        title="Find videos to study"
        description="Search for educational videos to supplement your studies."
        data-testid="youtube-initial"
      />
    );
  };

  return (
    <PageContainer>
      <ContentWrapper className="max-w-6xl">
        <header className="page-header">
          <div>
            <h1 className="text-3xl font-extrabold text-ink">YouTube Search</h1>
            <p className="text-ink-muted">
              Find educational videos to supplement your studies
            </p>
          </div>
          {statusPill}
        </header>

        <Section>
          <Card elevation={1} padding="md">
            <form
              onSubmit={handleSubmit}
              noValidate
              className="space-y-4"
              data-testid="youtube-search-form"
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_11rem_auto] sm:items-end">
                <Input
                  label="Search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="e.g., calculus derivatives"
                  aria-required="true"
                  data-testid="youtube-search-input"
                />
                <Input
                  label="Max results"
                  type="number"
                  min={1}
                  max={50}
                  value={maxResults}
                  onChange={(event) => setMaxResults(event.target.value)}
                  data-testid="youtube-max-results"
                />
                <Select
                  label="Order"
                  value={order}
                  onChange={(event) => setOrder(event.target.value)}
                  options={ORDER_OPTIONS}
                  aria-label="Sort results by"
                  data-testid="youtube-order"
                />
                <Button
                  type="submit"
                  loading={isSearching}
                  leftIcon={<Search className="h-4 w-4" />}
                  data-testid="youtube-search-button"
                >
                  Search
                </Button>
              </div>
            </form>
          </Card>

          <p
            className="mt-3 min-h-5 text-sm text-ink-muted"
            aria-live="polite"
            data-testid="youtube-notice"
          >
            {notice}
          </p>
        </Section>

        <Section
          title="Videos"
          description={
            hasResults
              ? `${videos.length} result${videos.length === 1 ? '' : 's'} for "${submitted?.query}"`
              : 'Results from the YouTube Data API'
          }
        >
          {renderResults()}
        </Section>
      </ContentWrapper>
    </PageContainer>
  );
}
