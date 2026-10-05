// Video result card — mirrors the legacy YouTube result markup: thumbnail,
// title, channel, view count / published date and a short description snippet.
// Videos are always opened on YouTube itself; nothing is downloaded or stored.

import { ExternalLink, Play } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';
import { formatDuration, formatPublishedDate, formatViewCount } from '../../hooks/useYouTube';
import type { YouTubeVideo } from '../../types/api';

export interface VideoCardProps {
  video: YouTubeVideo;
}

const WATCH_URL = (id: string) => `https://www.youtube.com/watch?v=${id}`;

export function VideoCard({ video }: VideoCardProps) {
  const url = WATCH_URL(video.id);
  const views = video.viewCount ? `${formatViewCount(video.viewCount)} views` : '';
  const published = video.publishedAt ? formatPublishedDate(video.publishedAt) : '';
  const duration = video.duration ? formatDuration(video.duration) : '';
  const meta = [views, duration, published].filter(Boolean).join(' | ');
  const description = (video.description || '').slice(0, 200);

  return (
    <Card
      elevation={1}
      padding="md"
      className="flex h-full flex-col gap-3"
      data-testid="video-card"
      data-video-id={video.id}
      data-video-title={video.title}
      data-video-channel={video.channelTitle}
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block overflow-hidden rounded-xl bg-surface-muted"
        aria-label={`Watch ${video.title} on YouTube`}
        data-testid="video-thumbnail"
      >
        <img
          src={video.thumbnailUrl}
          alt=""
          loading="lazy"
          className="aspect-video w-full object-cover"
        />
        <span
          className={cn(
            'absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5',
            'text-xs font-semibold text-white'
          )}
          aria-hidden="true"
        >
          <Play className="mr-1 inline h-3 w-3" fill="currentColor" />
          {duration || 'Watch'}
        </span>
      </a>

      <div className="min-w-0 space-y-1">
        <h3 className="text-base font-semibold leading-snug text-ink" data-testid="video-title">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-teal-700"
          >
            {video.title}
          </a>
        </h3>
        <p className="truncate text-sm text-ink-muted" data-testid="video-channel">
          {video.channelTitle}
        </p>
        <p className="text-xs text-ink-subtle" data-testid="video-meta">
          {meta}
        </p>
        {description && (
          <p className="line-clamp-2 text-sm text-ink-muted" data-testid="video-description">
            {description}
            {(video.description || '').length > 200 ? '...' : ''}
          </p>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Play className="h-3.5 w-3.5" />}
          onClick={() => window.open(url, '_blank', 'noopener')}
          aria-label={`Watch ${video.title}`}
          data-testid="video-watch"
        >
          Watch
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 transition-colors hover:text-teal-800 hover:underline"
          aria-label={`Open ${video.title} on YouTube`}
          data-testid="video-open-youtube"
        >
          Open on YouTube
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </Card>
  );
}
